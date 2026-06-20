import { NextResponse } from "next/server";
import { getNextSentenceForgeItem } from "@/lib/language/studyQueue";

export async function GET() {
  try {
    return NextResponse.json({ item: await getNextSentenceForgeItem() });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load Sentence Forge." },
      { status: 400 }
    );
  }
}
