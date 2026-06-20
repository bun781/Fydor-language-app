import { NextResponse } from "next/server";
import { getLessonContentById } from "@/lib/language/importedContent";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const lesson = await getLessonContentById(id);
    if (!lesson) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ lesson });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
