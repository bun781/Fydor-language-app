import { describe, expect, it } from "vitest";
import { parseStrictJson } from "@/lib/safeJson";

describe("strict JSON parser", () => {
  it("parses ordinary data", () => {
    expect(parseStrictJson('{"lesson":{"title":"Safe"}}')).toEqual({ lesson: { title: "Safe" } });
  });

  it.each([
    '{"a":1,"a":2}',
    '{"__proto__":{"polluted":true}}',
    '{"constructor":{}}',
    '{"safe":1} trailing'
  ])("rejects ambiguous or dangerous JSON: %s", (source) => {
    expect(() => parseStrictJson(source)).toThrow();
  });

  it("enforces size and nesting limits", () => {
    expect(() => parseStrictJson(JSON.stringify({ text: "x".repeat(100) }), { maxBytes: 20 })).toThrow(/byte limit/);
    let deep = "null";
    for (let index = 0; index < 30; index += 1) deep = `[${deep}]`;
    expect(() => parseStrictJson(deep, { maxDepth: 10 })).toThrow(/nesting/);
  });
});
