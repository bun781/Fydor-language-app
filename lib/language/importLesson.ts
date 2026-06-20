import { and, eq, inArray } from "drizzle-orm";
import {
  drills,
  learningItems,
  lessons,
  reviewStates,
  sentenceItemLinks,
  sentenceTokens,
  sentences
} from "@/db/schema";
import { db } from "@/lib/server/db";
import { generateSentenceForgeDrills } from "@/lib/language/generateDrills";
import { hashLessonSource, normalizeSentenceText } from "@/lib/language/normalize";
import type {
  ImportPreviewResult,
  ImportWarning,
  LearningItemPreview,
  LessonImportInput,
} from "@/lib/language/types";

interface BuildPreviewOptions {
  lesson: LessonImportInput;
  warnings: ImportWarning[];
}

export async function buildImportPreview({
  lesson,
  warnings
}: BuildPreviewOptions): Promise<ImportPreviewResult> {
  const sourceHash = hashLessonSource(lesson);
  const [duplicateImport] = await db
    .select({ id: lessons.id })
    .from(lessons)
    .where(eq(lessons.sourceHash, sourceHash))
    .limit(1);

  const normalizedTexts = lesson.sentences.map((sentence) => normalizeSentenceText(sentence.text));
  const existingSentences = normalizedTexts.length
    ? await db
      .select({ normalizedText: sentences.normalizedText })
      .from(sentences)
      .where(and(
        eq(sentences.language, lesson.targetLanguage),
        inArray(sentences.normalizedText, normalizedTexts)
      ))
    : [];

  const itemCandidates = collectLearningItemCandidates(lesson);
  const canonicalKeys = itemCandidates.map((item) => item.canonicalKey);
  const existingItems = canonicalKeys.length
    ? await db
      .select()
      .from(learningItems)
      .where(inArray(learningItems.canonicalKey, canonicalKeys))
    : [];

  const existingByKey = new Map(existingItems.map((item) => [item.canonicalKey, item]));
  const itemPreviews = itemCandidates.map<LearningItemPreview>((candidate) => {
    const existing = existingByKey.get(candidate.canonicalKey);
    if (!existing) {
      return { ...candidate, status: "new" };
    }

    const conflict = existing.type !== candidate.type ||
      existing.displayText !== candidate.displayText ||
      (existing.meaning ?? "") !== (candidate.meaning ?? "");

    return {
      ...candidate,
      status: conflict ? "conflict" : "existing",
      existingId: existing.id,
      conflictMessage: conflict ? "Canonical key matches an existing item with different details." : undefined
    };
  });

  const sentenceSet = new Set(existingSentences.map((sentence) => sentence.normalizedText));
  const conflictWarnings = itemPreviews
    .filter((item) => item.status === "conflict")
    .map((item) => ({
      code: "canonical_conflict",
      message: item.conflictMessage ?? "Canonical key conflicts with an existing learning item.",
      canonicalKey: item.canonicalKey
    }));

  return {
    sourceHash,
    lesson,
    duplicateImport: Boolean(duplicateImport),
    warnings: [...warnings, ...conflictWarnings],
    learningItems: itemPreviews,
    sentences: lesson.sentences.map((sentence, index) => ({
      index,
      text: sentence.text,
      translation: sentence.translation,
      focus: sentence.focus,
      tokens: sentence.tokens ?? [],
      drills: generateSentenceForgeDrills(sentence),
      duplicateSentence: sentenceSet.has(normalizeSentenceText(sentence.text))
    }))
  };
}

export async function importApprovedLesson(lesson: LessonImportInput) {
  const preview = await buildImportPreview({ lesson, warnings: [] });

  if (preview.duplicateImport) {
    throw new Error("This lesson has already been imported.");
  }

  if (preview.sentences.some((sentence) => sentence.duplicateSentence)) {
    throw new Error("One or more sentences already exist for this language.");
  }

  if (preview.learningItems.some((item) => item.status === "conflict")) {
    throw new Error("Resolve canonical key conflicts before importing.");
  }

  return db.transaction(async (tx) => {
    const [lessonRow] = await tx.insert(lessons).values({
      targetLanguage: lesson.targetLanguage,
      baseLanguage: lesson.baseLanguage,
      level: lesson.level,
      title: lesson.title,
      sourceHash: preview.sourceHash
    }).returning();

    const existingItems = preview.learningItems.filter((item) => item.status === "existing");
    const itemByKey = new Map(existingItems.map((item) => [item.canonicalKey, item.existingId as string]));
    const newItems = preview.learningItems.filter((item) => item.status === "new");

    if (newItems.length) {
      const insertedItems = await tx.insert(learningItems).values(newItems.map((item) => ({
        language: lesson.targetLanguage,
        type: item.type,
        canonicalKey: item.canonicalKey,
        displayText: item.displayText,
        meaning: item.meaning,
        explanation: item.explanation,
        commonMistakes: item.commonMistakes
      }))).returning();

      for (const item of insertedItems) {
        itemByKey.set(item.canonicalKey, item.id);
      }
    }

    for (const sentence of lesson.sentences) {
      const focusItemId = sentence.focus ? itemByKey.get(sentence.focus.canonicalKey) : undefined;
      const [sentenceRow] = await tx.insert(sentences).values({
        lessonId: lessonRow.id,
        language: lesson.targetLanguage,
        text: sentence.text,
        normalizedText: normalizeSentenceText(sentence.text),
        translation: sentence.translation,
        focusCanonicalKey: sentence.focus?.canonicalKey,
        focusDisplayText: sentence.focus?.displayText,
        focusMeaning: sentence.focus?.meaning,
        focusExplanation: sentence.focus?.explanation
      }).returning();

      const tokens = sentence.tokens ?? [];
      if (tokens.length) {
        await tx.insert(sentenceTokens).values(tokens.map((token, position) => ({
          sentenceId: sentenceRow.id,
          position,
          text: token.text,
          itemType: token.type,
          canonicalKey: token.canonicalKey,
          meaning: token.meaning,
          explanation: token.explanation,
          commonMistakes: token.commonMistakes ?? [],
          learningItemId: token.canonicalKey ? itemByKey.get(token.canonicalKey) : undefined
        })));
      }

      const linkedIds = new Set<string>();
      if (focusItemId) {
        linkedIds.add(`focus:${focusItemId}`);
        await tx.insert(sentenceItemLinks).values({
          sentenceId: sentenceRow.id,
          learningItemId: focusItemId,
          role: "focus"
        });
      }

      for (const token of tokens) {
        const itemId = token.canonicalKey ? itemByKey.get(token.canonicalKey) : undefined;
        const linkKey = itemId ? `token:${itemId}` : undefined;
        if (itemId && linkKey && !linkedIds.has(linkKey)) {
          linkedIds.add(linkKey);
          await tx.insert(sentenceItemLinks).values({
            sentenceId: sentenceRow.id,
            learningItemId: itemId,
            role: "token"
          });
        }
      }

      const insertedDrills = await tx.insert(drills).values(generateSentenceForgeDrills(sentence).map((drill) => ({
        sentenceId: sentenceRow.id,
        learningItemId: focusItemId,
        type: drill.type,
        prompt: drill.prompt,
        answer: drill.answer,
        payload: drill.payload
      }))).returning();

      await tx.insert(reviewStates).values(insertedDrills.map((drill) => ({
        drillId: drill.id,
        reviewState: "new",
        nextReviewAt: new Date(),
        intervalDays: 0
      })));
    }

    return { lessonId: lessonRow.id, sentenceCount: lesson.sentences.length };
  });
}

function collectLearningItemCandidates(lesson: LessonImportInput): LearningItemPreview[] {
  const byKey = new Map<string, LearningItemPreview>();

  for (const sentence of lesson.sentences) {
    if (sentence.focus) {
      upsertCandidate(byKey, {
        canonicalKey: sentence.focus.canonicalKey,
        type: sentence.focus.type,
        displayText: sentence.focus.displayText,
        meaning: sentence.focus.meaning,
        explanation: sentence.focus.explanation,
        commonMistakes: sentence.focus.commonMistakes ?? [],
        status: "new"
      });
    }

    for (const token of sentence.tokens ?? []) {
      if (!token.type || !token.canonicalKey) continue;
      upsertCandidate(byKey, {
        canonicalKey: token.canonicalKey,
        type: token.type,
        displayText: token.text,
        meaning: token.meaning,
        explanation: token.explanation,
        commonMistakes: token.commonMistakes ?? [],
        status: "new"
      });
    }
  }

  return [...byKey.values()];
}

function upsertCandidate(items: Map<string, LearningItemPreview>, candidate: LearningItemPreview): void {
  const existing = items.get(candidate.canonicalKey);
  if (!existing) {
    items.set(candidate.canonicalKey, candidate);
    return;
  }

  items.set(candidate.canonicalKey, {
    ...existing,
    displayText: existing.displayText || candidate.displayText,
    meaning: existing.meaning ?? candidate.meaning,
    explanation: existing.explanation ?? candidate.explanation,
    commonMistakes: [...new Set([...existing.commonMistakes, ...candidate.commonMistakes])]
  });
}
