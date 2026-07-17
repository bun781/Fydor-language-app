import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { parseFydorPack } from "@/lib/fydor-pack";

const packs = [
  "german-beginner-v1.fydorpack",
  "korean-beginner-v1.fydorpack",
  "spanish-beginner-v1.fydorpack",
  "humongous-mandarin-v1.fydorpack",
  "humongous-vietnamese-v1.fydorpack"
];

describe("bundled Fydor Packs", () => {
  it.each(packs)("validates %s as a complete current-format pack", (file) => {
    const validation = parseFydorPack(readFileSync(`packs/${file}`, "utf8"));
    expect(validation.errors).toEqual([]);
    expect(validation.lessonErrors).toEqual([]);
    expect(validation.annexErrors).toEqual([]);
    expect(validation.pack).toBeDefined();
    expect(validation.pack?.version).toBe("2.0.0");
    expect(validation.pack?.unitManifest?.units).toHaveLength(validation.lessonCount);
    expect(new Set(validation.pack?.unitManifest?.units.flatMap((unit) => unit.lessonIndexes))).toEqual(new Set(validation.pack?.lessons.map((_, index) => index)));
    const rules = validation.pack?.grammarGuide?.rules ?? [];
    expect(rules.length).toBeGreaterThan(0);
    expect(validation.pack?.lessons.flatMap((lesson) => lesson.sentences).flatMap((sentence) => sentence.grammar ?? []).every((grammar) => grammar.ruleId && rules.some((rule) => rule.id === grammar.ruleId))).toBe(true);
  });
});
