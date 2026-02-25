import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import { transcribeAudio } from "@/lib/deepgram/stt";

/**
 * POST /api/deepgram/stt
 *
 * Ambient Scribe mode — receives a completed audio recording from the client
 * and returns a structured transcript ready for PII sanitization → VibeFlow.
 *
 * Expected multipart form fields:
 *   - audio:       Audio file (mp3, wav, m4a, ogg, flac, webm) — required
 *   - language:    ISO 639-1 or BCP-47 code (e.g. "en", "en-US") — optional
 *   - keyterms:    JSON array of clinical keyterms — optional
 *                  e.g. '["metoprolol","tachycardia","beta-blocker"]'
 */
export async function POST(req: NextRequest) {
  const { data: session } = await auth.getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let formData: FormData;

  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json(
      { error: "Expected multipart/form-data" },
      { status: 400 },
    );
  }

  const audioField = formData.get("audio");
  if (!audioField || !(audioField instanceof Blob)) {
    return NextResponse.json(
      { error: "audio field is required and must be a file" },
      { status: 400 },
    );
  }

  const languageCode = (formData.get("language") as string | null) ?? undefined;

  let keyterms: string[] = [];
  const keytermsRaw = formData.get("keyterms");
  if (keytermsRaw && typeof keytermsRaw === "string") {
    try {
      const parsed = JSON.parse(keytermsRaw);
      if (Array.isArray(parsed)) {
        keyterms = parsed.filter((k) => typeof k === "string");
      }
    } catch {
      // Non-fatal: proceed without keyterms
    }
  }

  try {
    const result = await transcribeAudio({
      audio: audioField,
      languageCode,
      keyterms,
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error("[STT] Deepgram transcription error:", err);
    return NextResponse.json(
      { error: "Transcription failed" },
      { status: 502 },
    );
  }
}
