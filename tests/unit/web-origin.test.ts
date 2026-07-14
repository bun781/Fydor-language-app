import { describe, expect, it } from "vitest";
import { normalizeFydorWebOrigin } from "@/lib/webOrigin";

describe("Fydor website origin", () => {
  it("normalizes HTTPS website origins", () => {
    expect(normalizeFydorWebOrigin("https://fydor.example///")).toBe("https://fydor.example");
    expect(normalizeFydorWebOrigin("https://preview.vercel.app/")).toBe("https://preview.vercel.app");
    expect(() => normalizeFydorWebOrigin("http://localhost:8080/")).toThrow("must use HTTPS");
  });

  it.each([
    "javascript:alert(1)",
    "http://fydor.example",
    "https://user:password@fydor.example",
    "https://fydor.example?callback=https://evil.test",
    "https://fydor.example/subpath",
    "//fydor.example"
  ])("rejects unsafe origin %s", (origin) => {
    expect(() => normalizeFydorWebOrigin(origin)).toThrow();
  });
});
