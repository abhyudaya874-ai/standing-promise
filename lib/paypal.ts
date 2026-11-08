import { z } from "zod";
import { getEnv } from "@/lib/env";
import { formatMajor, parseMinor } from "@/lib/money";

const BASE = "https://api-m.sandbox.paypal.com"; // sandbox host only. A live host here is a bug.

export type CaptureOutcome =
  | { kind: "completed"; captureId: string }
  | { kind: "declined"; issue: string }
  | { kind: "already_captured" }
  | { kind: "error"; status: number; issue: string; retryable: boolean };

export type OrderResult =
  | { ok: true; orderStatus: string; amountMinor: number; currency: string }
  | { ok: false; status: number; issue: string };

export type CreateResult = { ok: true; orderId: string } | { ok: false; status: number; issue: string };

interface Opts {
  signal?: AbortSignal;
}

// ---- token (cached until 60s before expiry, refreshed once on 401) ----
let cached: { value: string; expiresAtMs: number } | undefined;

async function getToken(signal?: AbortSignal): Promise<string> {
  if (cached && Date.now() < cached.expiresAtMs - 60_000) return cached.value;
  const { PAYPAL_CLIENT_ID: id, PAYPAL_CLIENT_SECRET: secret } = getEnv();
  const res = await fetch(`${BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
    signal,
  });
  if (!res.ok) throw new Error(`paypal token ${res.status}`);
  const body = z.object({ access_token: z.string(), expires_in: z.number() }).parse(await res.json());
  cached = { value: body.access_token, expiresAtMs: Date.now() + body.expires_in * 1000 };
  return cached.value;
}

export async function call(
  method: "GET" | "POST",
  path: string,
  o: { body?: unknown; requestId?: string; prefer?: string; signal?: AbortSignal },
): Promise<{ status: number; body: unknown }> {
  for (let pass = 0; pass < 2; pass++) {
    const token = await getToken(o.signal);
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...(o.requestId ? { "PayPal-Request-Id": o.requestId } : {}),
        ...(o.prefer ? { Prefer: o.prefer } : {}),
      },
      body: o.body === undefined ? undefined : JSON.stringify(o.body),
      signal: o.signal,
    });
    if (res.status === 401 && pass === 0) {
      cached = undefined; // refresh once, then fail loudly
      continue;
    }
    const body: unknown = await res.json().catch(() => null);
    return { status: res.status, body };
  }
  throw new Error("paypal auth failed after refresh");
}

const ErrBody = z.object({ details: z.array(z.object({ issue: z.string() })).min(1) });
const issueOf = (body: unknown, fallback: string) => {
  const p = ErrBody.safeParse(body);
  return p.success ? p.data.details[0].issue : fallback;
};

// ---- create ----
export async function createOrder(
  i: { promiseId: string; amountMinor: number; currency: string; returnUrl: string },
  o: Opts = {},
): Promise<CreateResult> {
  const { status, body } = await call("POST", "/v2/checkout/orders", {
    requestId: `create:${i.promiseId}`, // retrying creation cannot make two orders
    signal: o.signal,
    body: {
      intent: "CAPTURE",
      purchase_units: [
        { reference_id: i.promiseId, amount: { currency_code: i.currency, value: formatMajor(i.amountMinor, i.currency) } },
      ],
      payment_source: {
        paypal: {
          experience_context: {
            return_url: i.returnUrl,
            cancel_url: i.returnUrl,
            user_action: "PAY_NOW",
            shipping_preference: "NO_SHIPPING",
          },
        },
      },
    },
  });
  const p = z.object({ id: z.string() }).safeParse(body);
  if ((status === 200 || status === 201) && p.success) return { ok: true, orderId: p.data.id };
  return { ok: false, status, issue: issueOf(body, "CREATE_FAILED") };
}

// ---- read ----
const OrderBody = z.object({
  status: z.string(),
  purchase_units: z.array(z.object({ amount: z.object({ currency_code: z.string(), value: z.string() }) })).min(1),
});

export async function getOrder(orderId: string, o: Opts = {}): Promise<OrderResult> {
  const { status, body } = await call("GET", `/v2/checkout/orders/${encodeURIComponent(orderId)}`, { signal: o.signal });
  const p = OrderBody.safeParse(body);
  if (status !== 200 || !p.success) return { ok: false, status, issue: issueOf(body, "ORDER_READ_FAILED") };
  const amount = p.data.purchase_units[0].amount;
  return {
    ok: true,
    orderStatus: p.data.status,
    amountMinor: parseMinor(amount.value, amount.currency_code), // string -> integer at the boundary
    currency: amount.currency_code,
  };
}

// ---- capture ----
const CaptureBody = z.object({
  status: z.string(),
  purchase_units: z
    .array(z.object({ payments: z.object({ captures: z.array(z.object({ id: z.string(), status: z.string() })).min(1) }) }))
    .min(1),
});

/** Pure. Unit-tested. Maps a raw PayPal response to one of four outcomes. */
export function normalizeCapture(status: number, body: unknown): CaptureOutcome {
  if (status === 200 || status === 201) {
    const p = CaptureBody.safeParse(body);
    if (!p.success) return { kind: "error", status, issue: "UNEXPECTED_CAPTURE_BODY", retryable: false };
    const cap = p.data.purchase_units[0].payments.captures[0];
    if (cap.status === "DECLINED") return { kind: "declined", issue: "CAPTURE_DECLINED" };
    if (p.data.status === "COMPLETED" && cap.status === "COMPLETED") return { kind: "completed", captureId: cap.id };
    return { kind: "error", status, issue: `CAPTURE_STATUS_${cap.status}`, retryable: false };
  }
  if (status === 422) {
    const issue = issueOf(body, "UNKNOWN_422");
    if (issue === "INSTRUMENT_DECLINED") return { kind: "declined", issue };
    if (issue === "ORDER_ALREADY_CAPTURED") return { kind: "already_captured" };
    return { kind: "error", status, issue, retryable: false };
  }
  return { kind: "error", status, issue: issueOf(body, `HTTP_${status}`), retryable: status >= 500 };
}

export async function captureOrder(orderId: string, requestId: string, o: Opts = {}): Promise<CaptureOutcome> {
  const { status, body } = await call("POST", `/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, {
    requestId, // SAME key on every retry of the same attempt
    prefer: "return=representation",
    body: {},
    signal: o.signal,
  });
  return normalizeCapture(status, body);
}

export const approveUrlFor = (orderId: string) => `https://www.sandbox.paypal.com/checkoutnow?token=${encodeURIComponent(orderId)}`;

export const paypal = { createOrder, getOrder, captureOrder };
