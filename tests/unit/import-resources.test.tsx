import { describe, expect, it } from "vitest";
import {
  formatLanguageLabel,
  groupLessonsByLanguage,
  importGuideSections,
  importPromptTemplates
} from "@/lib/language/importResources";

describe("import resources", () => {
  it("contains guide coverage for format, fields, examples, and mistakes", () => {
    expect(importGuideSections.map((section) => section.title)).toEqual([
      "Supported JSON format",
      "Required fields",
      "Optional fields",
      "Examples",
      "Common mistakes",
      "Overlapping annotations"
    ]);
  });

  it("provides copyable prompt templates for each lesson type", () => {
    expect(importPromptTemplates.map((template) => template.id)).toEqual([
      "beginner",
      "intermediate",
      "vocabulary",
      "grammar"
    ]);

    for (const template of importPromptTemplates) {
      expect(template.prompt).toContain("Return JSON only");
      expect(template.prompt).toContain("Word and grammar annotations may overlap");
      expect(template.prompt.length).toBeGreaterThan(200);
    }
  });

  it("groups saved lessons by language in a preferred order", () => {
    const groups = groupLessonsByLanguage([
      { id: "3", language: "vi", baseLanguage: "en", title: "Vietnamese", description: null, level: null, tags: [], sentenceCount: 1 },
      { id: "1", language: "ko", baseLanguage: "en", title: "Korean", description: null, level: null, tags: [], sentenceCount: 2 },
      { id: "2", language: "ja", baseLanguage: "en", title: "Japanese", description: null, level: null, tags: [], sentenceCount: 3 },
      { id: "4", language: "fr", baseLanguage: "en", title: "French", description: null, level: null, tags: [], sentenceCount: 4 }
    ]);

    expect(groups.map((group) => group.language)).toEqual(["ko", "ja", "vi", "fr"]);
    expect(groups[0].label).toBe("Korean");
    expect(formatLanguageLabel("zh")).toBe("Chinese");
  });
});
