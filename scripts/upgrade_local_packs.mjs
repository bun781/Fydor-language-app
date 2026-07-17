import fs from "node:fs";
import path from "node:path";

const COURSE_FILES = [
  "german-beginner-v1",
  "korean-beginner-v1",
  "spanish-beginner-v1",
  "humongous-mandarin-v1",
  "humongous-vietnamese-v1"
];
const UPDATED_AT = "2026-07-17T00:00:00.000Z";

for (const stem of COURSE_FILES) {
  const legacyPath = path.resolve("packs", `${stem}.json`);
  const packPath = path.resolve("packs", `${stem}.fydorpack`);
  const sourcePath = fs.existsSync(packPath) ? packPath : legacyPath;
  const source = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
  const pack = upgradePack(source);
  fs.writeFileSync(packPath, `${JSON.stringify(pack, null, 2)}\n`);
  if (sourcePath === legacyPath) fs.unlinkSync(legacyPath);
  console.log(`Wrote ${path.relative(process.cwd(), packPath)}`);
}

function upgradePack(source) {
  const lessons = source.lessons.map((lesson) => ({
    ...lesson,
    sentences: lesson.sentences.map((sentence) => ({
      ...sentence,
      grammar: sentence.grammar?.map((grammar) => ({ ...grammar, ruleId: grammar.ruleId ?? ruleIdFor(grammar.pattern) }))
    }))
  }));
  const grammarGuide = source.grammarGuide ?? buildGrammarGuide(lessons);

  return {
    type: "fydor_pack",
    schemaVersion: 1,
    id: source.id,
    title: source.title,
    ...(source.description ? { description: source.description } : {}),
    author: source.author ?? { name: "Fydor Community" },
    version: "2.0.0",
    license: source.license ?? "CC BY 4.0",
    language: source.language,
    baseLanguage: source.baseLanguage,
    ...(source.level ? { level: source.level } : {}),
    ...(source.tags?.length ? { tags: source.tags } : {}),
    createdAt: source.createdAt ?? UPDATED_AT,
    updatedAt: source.updatedAt ?? UPDATED_AT,
    unitManifest: {
      schemaVersion: 1,
      units: lessons.map((lesson, position) => ({ id: `unit-${String(position + 1).padStart(2, "0")}`, title: lesson.title, position, lessonIndexes: [position] }))
    },
    ...(grammarGuide ? { grammarGuide } : {}),
    lessons
  };
}

function buildGrammarGuide(lessons) {
  const ruleEntries = new Map();
  lessons.forEach((lesson, lessonIndex) => lesson.sentences.forEach((sentence) => sentence.grammar?.forEach((grammar) => {
    const key = normalizedPattern(grammar.pattern);
    const current = ruleEntries.get(key) ?? {
      id: grammar.ruleId,
      title: grammar.pattern.trim(),
      overview: firstText(grammar.explanation, grammar.meaning, grammar.pattern),
      unitIndexes: new Set()
    };
    current.unitIndexes.add(lessonIndex);
    ruleEntries.set(key, current);
  })));
  return ruleEntries.size ? {
    schemaVersion: 1,
    rules: [...ruleEntries.values()].map((rule) => ({
      id: rule.id,
      title: rule.title,
      overview: rule.overview,
      situations: [{ title: "Course usage", explanation: rule.overview, unitIndexes: [...rule.unitIndexes].sort((a, b) => a - b) }]
    }))
  } : undefined;
}

function normalizedPattern(value) {
  return value.normalize("NFC").trim().toLocaleLowerCase();
}

function ruleIdFor(pattern) {
  const slug = normalizedPattern(pattern).normalize("NFD").replace(/\p{Mark}/gu, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 56) || "rule";
  let hash = 2166136261;
  for (const character of normalizedPattern(pattern)) hash = Math.imul(hash ^ character.codePointAt(0), 16777619);
  return `grammar-${slug}-${(hash >>> 0).toString(36)}`;
}

function firstText(...values) {
  return values.find((value) => typeof value === "string" && value.trim())?.trim() ?? "Grammar pattern used in this course.";
}
