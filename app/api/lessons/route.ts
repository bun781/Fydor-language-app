import { NextResponse } from "next/server";
import { getAllLessonsMeta } from "@/lib/language/importedContent";

export async function GET() {
  try {
    const lessons = await getAllLessonsMeta();
    return NextResponse.json({ lessons });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
