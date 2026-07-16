import { describe, expect, it } from "vitest";
import { computeFydorPackChecksum, parseFydorPack } from "@/lib/fydor-pack";

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
});
