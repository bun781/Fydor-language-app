import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { computeFydorPackChecksum, parseFydorPack, prepareLessonsForImport } from "@/lib/fydor-pack";

const source = {
  type: "fydor_pack",
  schemaVersion: 1,
  id: "korean-greetings",
  title: "Korean greetings",
  version: "1.0.0",
  language: "ko",
  baseLanguage: "en",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  lessons: [{
    language: "ko",
    baseLanguage: "en",
    title: "Greetings",
    sentences: [{ text: "안녕하세요", translation: "Hello" }]
  }]
};

describe("Fydor Pack Exchange integrity", () => {
  it("rejects a lesson whose direction differs from its package", () => {
    const result = parseFydorPack(JSON.stringify({
      ...source,
      lessons: [{ ...source.lessons[0], baseLanguage: "vi" }]
    }));

    expect(result.errors).toEqual(["One or more lessons in this pack need attention."]);
    expect(result.lessonErrors[0]?.errors[0]).toContain("ko → vi");
  });

  it("uses a stable content checksum that excludes mutable package metadata", async () => {
    const first = parseFydorPack(JSON.stringify(source)).pack;
    const second = parseFydorPack(JSON.stringify({ ...source, title: "Renamed", updatedAt: "2026-02-01T00:00:00.000Z" })).pack;

    expect(first).toBeDefined();
    expect(second).toBeDefined();
    await expect(computeFydorPackChecksum(first!)).resolves.toBe(await computeFydorPackChecksum(second!));
  });

  it("accepts the Humongous Mandarin pack with all units and grammar links", () => {
    const packResult = parseFydorPack(readFileSync("packs/humongous-mandarin-v1.fydorpack", "utf8"));

    expect(packResult.errors).toEqual([]);
    expect(packResult.annexErrors).toEqual([]);
    expect(packResult.lessonCount).toBe(20);
    expect(packResult.sentenceCount).toBe(440);
    expect(packResult.pack?.unitManifest?.units).toHaveLength(20);
    expect(packResult.pack?.grammarGuide?.rules.length).toBeGreaterThan(10);

    const prepared = prepareLessonsForImport(packResult.pack!);
    expect(prepared).toHaveLength(20);
    expect(prepared.flatMap((lesson) => lesson.sentences)).toHaveLength(440);
    expect(JSON.stringify(prepared)).not.toContain("ruleId");
    expect(prepared.flatMap((lesson) => lesson.sentences).every((sentence) => sentence.chunks?.some((chunk) => chunk.type === "pinyin"))).toBe(true);
  });

  it("rejects overlapping or incomplete unit manifests", () => {
    const result = parseFydorPack(JSON.stringify({
      ...source,
      lessons: [...source.lessons, { ...source.lessons[0], title: "Second" }],
      unitManifest: {
        schemaVersion: 1,
        units: [
          { id: "one", title: "One", position: 0, lessonIndexes: [0] },
          { id: "two", title: "Two", position: 1, lessonIndexes: [0] }
        ]
      }
    }));

    expect(result.errors).toEqual(["One or more pack annexes need attention."]);
    expect(result.annexErrors).toContain("Lesson index 0 appears in more than one unit.");
    expect(result.annexErrors).toContain("Unit manifest must assign every lesson exactly once.");
  });
});
