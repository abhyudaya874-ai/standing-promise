import { describe, expect, it } from "vitest";
import { normalizeCapture } from "./paypal";

const okBody = (capStatus: string, orderStatus = "COMPLETED") => ({
  status: orderStatus,
  purchase_units: [{ payments: { captures: [{ id: "CAP1", status: capStatus }] } }],
});
const err = (issue: string) => ({ details: [{ issue }] });

describe("normalizeCapture", () => {
  const rows: [string, number, unknown, string][] = [
    ["201 completed", 201, okBody("COMPLETED"), "completed"],
    ["201 declined capture", 201, okBody("DECLINED"), "declined"],
    ["201 pending capture", 201, okBody("PENDING", "PAYER_ACTION_REQUIRED"), "error"],
    ["422 instrument declined", 422, err("INSTRUMENT_DECLINED"), "declined"],
    ["422 already captured", 422, err("ORDER_ALREADY_CAPTURED"), "already_captured"],
    ["422 other", 422, err("ORDER_NOT_APPROVED"), "error"],
    ["500", 500, null, "error"],
    ["200 garbage", 200, { nope: true }, "error"],
  ];
  it.each(rows)("%s -> %s", (_n, status, body, kind) => expect(normalizeCapture(status, body).kind).toBe(kind));

  it("only 5xx is retryable", () => {
    expect(normalizeCapture(500, null)).toMatchObject({ kind: "error", retryable: true });
    expect(normalizeCapture(422, err("ORDER_NOT_APPROVED"))).toMatchObject({ kind: "error", retryable: false });
  });
  it("completed carries the capture id", () => {
    expect(normalizeCapture(201, okBody("COMPLETED"))).toEqual({ kind: "completed", captureId: "CAP1" });
  });
});
