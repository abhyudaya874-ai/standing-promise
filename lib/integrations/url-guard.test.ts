import { describe, expect, it } from "vitest";
import { assertPublicHttpUrl } from "./url-guard";

describe("assertPublicHttpUrl", () => {
  it.each(["https://example.com/p?x=1", "http://shop.example.org"])("allows %s", (u) => expect(assertPublicHttpUrl(u)).toContain("://"));
  it.each([
    "file:///etc/passwd", "ftp://example.com", "http://localhost:3000", "http://127.0.0.1", "http://10.1.2.3", "http://192.168.0.5",
    "http://172.20.0.1", "http://169.254.169.254/latest/meta-data", "http://[::1]/", "http://user:pw@example.com", "http://db.internal", "nonsense",
  ])("blocks %s", (u) => expect(() => assertPublicHttpUrl(u)).toThrow());
});
