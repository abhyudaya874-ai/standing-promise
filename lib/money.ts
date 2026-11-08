// Money is integer minor units everywhere. Strings only at the edges
// (user input, PayPal JSON). No parseFloat, no toFixed, no floats. Ever.

/**
 * Currencies a PAYER can commit in. INR is deliberately absent: PayPal stopped domestic payment services in India
 * (1 April 2021) and the Orders API rejects INR with CURRENCY_NOT_SUPPORTED. Use USD for the sandbox demo.
 */
export const SUPPORTED_CURRENCIES = ["USD", "EUR", "GBP", "CAD", "AUD", "JPY"] as const;
export type Currency = (typeof SUPPORTED_CURRENCIES)[number];

/**
 * Currencies we can PARSE (decimal places per ISO 4217). Superset of the payable ones, because a vendor such as
 * Channel3 may return an INR price. That is read fine and then fails the verdict with CURRENCY_MISMATCH (WAIT).
 */
const EXPONENT: Record<string, number> = { USD: 2, EUR: 2, GBP: 2, CAD: 2, AUD: 2, JPY: 0, INR: 2 };

export function exponentOf(currency: string): number {
  const e = EXPONENT[currency];
  if (e === undefined) throw new Error(`unsupported currency "${currency}"`);
  return e;
}

/** "10.5" + USD -> 1050. Throws on junk, too many decimals, or unsafe size. */
export function parseMinor(value: string, currency: string): number {
  const exp = exponentOf(currency);
  const m = /^(\d{1,9})(?:\.(\d+))?$/.exec(value.trim());
  if (!m) throw new Error(`bad amount "${value}"`);
  const whole = m[1];
  const frac = m[2] ?? "";
  if (frac.length > exp) throw new Error(`too many decimals for ${currency}: "${value}"`);
  const minor = Number(whole + frac.padEnd(exp, "0")); // digit string -> integer
  if (!Number.isSafeInteger(minor)) throw new Error(`amount out of range: "${value}"`);
  return minor;
}

/** 1050 + USD -> "10.50". The only way to build a PayPal amount string. */
export function formatMajor(minor: number, currency: string): string {
  if (!Number.isInteger(minor) || minor < 0) throw new Error(`bad minor amount ${minor}`);
  const exp = exponentOf(currency);
  if (exp === 0) return String(minor);
  const s = String(minor).padStart(exp + 1, "0");
  return `${s.slice(0, -exp)}.${s.slice(-exp)}`;
}

/**
 * Vendor JSON gives prices as JSON numbers (399.99). Never multiply by 100.
 * Go through the number's decimal STRING and the same strict parser as user input.
 * Rejects exponent notation (1e21), NaN, negatives and >2 decimals by throwing, so a
 * caller can turn it into a degraded result instead of a wrong price.
 */
export function minorFromJson(value: number | string, currency: string): number {
  const s = typeof value === "number" ? String(value) : value.trim();
  if (typeof value === "number" && !Number.isFinite(value)) throw new Error("non-finite price");
  return parseMinor(s, currency);
}
