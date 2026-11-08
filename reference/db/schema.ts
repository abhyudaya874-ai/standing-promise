import { char, index, integer, jsonb, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import type { Condition, ConditionFact } from "@/lib/verdict";

export const PROMISE_STATES = ["open", "captured", "capture_pending", "declined", "released"] as const;
export type PromiseState = (typeof PROMISE_STATES)[number];

export const CAPTURE_STATUSES = ["pending", "completed", "declined"] as const;
export type CaptureStatus = (typeof CAPTURE_STATUSES)[number];

// @invariant:money-integer-minor-units
// Money = integer minor units + currency char(3). Never numeric, never real.
export const promise = pgTable("promise", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  amountMinor: integer("amount_minor").notNull(),
  currency: char("currency", { length: 3 }).notNull(),
  windowEndsAt: timestamp("window_ends_at", { withTimezone: true }).notNull(),
  paypalOrderId: text("paypal_order_id"),
  payerName: text("payer_name").notNull().default("anonymous"), // Bryntum row + scoreboard label
  payerEmail: text("payer_email"), // optional; only used by the Zapier nudge
  condition: jsonb("condition").$type<Condition>().notNull().default({ kind: "none" }),
  state: text("state").$type<PromiseState>().notNull().default("open"), // a projection of the event log
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// @invariant:append-only-events
// Rows are inserted, never updated or deleted. The log is the source of truth.
export const promiseEvent = pgTable(
  "promise_event",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    promiseId: uuid("promise_id").notNull().references(() => promise.id),
    attempt: integer("attempt").notNull().default(1),
    kind: text("kind").notNull(), // closed set: see lib/events.ts EVENT_KINDS
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("promise_event_promise_idx").on(t.promiseId, t.createdAt)],
);

// @invariant:capture-unique-per-attempt
// The storage-level idempotency guarantee. A second insert for the same
// (promise_id, attempt) hits the unique constraint and is treated as a duplicate.
export const capture = pgTable(
  "capture",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    promiseId: uuid("promise_id").notNull().references(() => promise.id),
    attempt: integer("attempt").notNull(),
    requestId: text("request_id").notNull(), // `${promiseId}:${attempt}` = PayPal-Request-Id
    status: text("status").$type<CaptureStatus>().notNull(),
    paypalCaptureId: text("paypal_capture_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("capture_promise_attempt_uq").on(t.promiseId, t.attempt)],
);

// @invariant:snapshots-immutable
// What a vendor (Channel3 / KERNEL / manual entry) saw, frozen. Insert only, never update.
// computeVerdict reads the fact stored here (via the verdict event), never the vendor.
export const conditionSnapshot = pgTable(
  "condition_snapshot",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    promiseId: uuid("promise_id").notNull().references(() => promise.id),
    attempt: integer("attempt").notNull(),
    source: text("source").$type<"channel3" | "kernel" | "fetch" | "manual">().notNull(),
    fact: jsonb("fact").$type<ConditionFact>().notNull(),
    evidenceUrl: text("evidence_url"), // KERNEL replay / merchant link. Evidence only, never an input.
    capturedAt: timestamp("captured_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("condition_snapshot_promise_idx").on(t.promiseId, t.capturedAt)],
);
