import { formatMajor } from "@/lib/money";

/**
 * Every user-facing string for the "Still to come" widget lives here so the copy can be
 * unit-tested against the friendly-register word list (no overdue / owe / collections / penalty).
 */
export const STILL_TO_COME_TITLE = "Still to come";
export const STILL_TO_COME_EMPTY = "Nothing waiting. All caught up.";

/** Invoice statuses that mean "money is still expected". Everything else is settled history. */
const WAITING = new Set(["SENT", "UNPAID", "PAYMENT_PENDING", "PARTIALLY_PAID", "SCHEDULED"]);

const STATUS_LABEL: Record<string, string> = {
  SENT: "sent, waiting on them",
  UNPAID: "waiting on payment",
  PAYMENT_PENDING: "payment in progress",
  PARTIALLY_PAID: "partly there",
  SCHEDULED: "scheduled",
};

export interface StillToComeSource {
  customer: string;
  amountMinor: number;
  currency: string;
  status: string;
  dueAt: string | null;
}

export interface StillToComeItem {
  label: string;
  detail: string;
}

export interface StillToComeCopy {
  title: string;
  empty: string;
  items: StillToComeItem[];
}

function dueLabel(dueAt: string | null): string | null {
  if (!dueAt) return null;
  const d = new Date(dueAt);
  if (Number.isNaN(d.getTime())) return null;
  return `due ${d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}`;
}

export function stillToComeCopy(rows: StillToComeSource[]): StillToComeCopy {
  const items = rows
    .filter((r) => WAITING.has(r.status))
    .map((r) => ({
      label: r.customer || "A customer",
      detail: [
        `${formatMajor(r.amountMinor, r.currency)} ${r.currency}`,
        STATUS_LABEL[r.status] ?? "waiting",
        dueLabel(r.dueAt),
      ]
        .filter(Boolean)
        .join(" · "),
    }));
  return { title: STILL_TO_COME_TITLE, empty: STILL_TO_COME_EMPTY, items };
}
