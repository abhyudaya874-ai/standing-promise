// Sandbox buyer approval automation via KERNEL cloud browser.
// Usage: node kapprove.mjs <paypalOrderId>
// Locale-agnostic: uses stable element ids (#email, #password, #one-time-cta) and Enter submits.
import Kernel from "@onkernel/sdk";
import { readFileSync } from "fs";

for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
  const m = /^([A-Z_]+)=(.*)$/.exec(line.trim());
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
}

const orderId = process.argv[2];
if (!orderId) { console.error("usage: node kapprove.mjs <orderId>"); process.exit(1); }
const EMAIL = process.env.PAYPAL_SANDBOX_BUYER_EMAIL;
const PASSWORD = process.env.PAYPAL_SANDBOX_BUYER_PASSWORD;
if (!EMAIL || !PASSWORD) { console.error("missing buyer creds in .env.local"); process.exit(1); }

const kernel = new Kernel({ apiKey: process.env.KERNEL_API_KEY });
const browser = await kernel.browsers.create({ headless: false, timeout_seconds: 180 });
const id = browser.session_id;
const J = (s) => JSON.stringify(s);

async function exec(code, timeout = 60) {
  const r = await kernel.browsers.playwright.execute(id, { timeout_sec: timeout, code });
  if (!r.success) throw new Error(`exec failed: ${r.error}`);
  return r.result;
}
const state = () => exec(`return { url: page.url(), text: (await page.innerText("body")).slice(0, 800) };`);
const hasSel = (sel) => exec(`return await page.locator(${J(sel)}).count() > 0;`);

try {
  await exec(`await page.goto("https://www.sandbox.paypal.com/checkoutnow?token=${orderId}", { waitUntil: "domcontentloaded", timeout: 30000 }); await page.waitForTimeout(3000);`);
  if (!(await hasSel("#email"))) {
    const s = await state();
    throw new Error("email field missing: " + s.text.slice(0, 200));
  }

  await exec(`await page.fill("#email", ${J(EMAIL)}); await page.keyboard.press("Enter"); await page.waitForTimeout(3500);`);
  if (!(await hasSel("#password"))) {
    // Enter may not submit; try the primary button whatever its label
    await exec(`const b = page.locator("button[type=submit], button").first(); await b.click().catch(()=>{}); await page.waitForTimeout(3000);`);
  }
  if (!(await hasSel("#password"))) {
    const s = await state();
    throw new Error("password field missing: " + s.text.slice(0, 300));
  }

  await exec(`await page.fill("#password", ${J(PASSWORD)}); await page.keyboard.press("Enter"); await page.waitForTimeout(5000);`);
  if (!(await hasSel("#one-time-cta"))) {
    await exec(`const b = page.locator("button[type=submit]").first(); await b.click().catch(()=>{}); await page.waitForTimeout(4000);`);
  }
  if (!(await hasSel("#one-time-cta"))) {
    const s = await state();
    throw new Error("pay button missing: " + s.text.slice(0, 300));
  }

  await exec(`await page.locator("#one-time-cta").click(); await page.waitForTimeout(6000);`);
  const s = await state();
  const approved = s.url.includes("ERR_CONNECTION_REFUSED") || s.url.includes("chrome-error") || /return|confirm|thank|obrigado/i.test(s.text);
  console.log(JSON.stringify({ orderId, approved, url: s.url, text: s.text.slice(0, 300) }, null, 1));
} finally {
  await kernel.browsers.deleteByID(id).catch(() => undefined);
}
