import { NextResponse } from "next/server";
import { parseLessonJson } from "@/lib/language/importSchema";
import { buildImportPreview } from "@/lib/language/importLesson";

export async function POST(request: Request) {
  try {
    const { source } = await request.json() as { source?: string };
    const parsed = parseLessonJson(source ?? "");

    if (!parsed.lesson) {
      return NextResponse.json({ errors: parsed.errors, warnings: parsed.warnings }, { status: 400 });
    }

    const preview = await buildImportPreview({
      lesson: parsed.lesson,
      warnings: parsed.warnings
    });

    return NextResponse.json({ preview, errors: [] });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to preview lesson." },
      { status: 400 }
    );
  }
}
