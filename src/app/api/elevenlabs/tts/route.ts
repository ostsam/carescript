import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import { streamSpeech } from "@/lib/elevenlabs/tts";

interface TtsRequestBody {
  /** Fully hydrated text — [PATIENT] token already replaced server-side. */
  text: string;
  /** ElevenLabs voice ID stored on the patient record. */
  voiceId: string;
  /** Optional model override (defaults to eleven_flash_v2_5). */
  modelId?: string;
}

/**
 * POST /api/elevenlabs/tts
 *
 * Intervention mode — crisis audio pipeline terminal step:
 *   Receives hydrated text + patient voice ID, returns a streaming MP3 response.
 *
 * The caller (the pipeline orchestrator) is responsible for ensuring:
 *   - Text has been PII-sanitized and re-hydrated (no raw PHI hits ElevenLabs)
 *   - The requesting nurse's session is valid and their org owns the patient
 */
export async function POST(req: NextRequest) {
  const { data: session } = await auth.getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: TtsRequestBody;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { text, voiceId, modelId } = body;

  if (!text || typeof text !== "string" || text.trim().length === 0) {
    return NextResponse.json({ error: "text is required" }, { status: 400 });
  }

  if (!voiceId || typeof voiceId !== "string") {
    return NextResponse.json({ error: "voiceId is required" }, { status: 400 });
  }

  try {
    const audioStream = await streamSpeech({
      text,
      voiceId,
      ...(modelId ? { modelId } : {}),
    });

    return new Response(audioStream, {
      headers: {
        "Content-Type": "audio/mpeg",
        // Prevent caching — audio is per-patient, per-interaction.
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[TTS] ElevenLabs stream error:", err);
    return NextResponse.json(
      { error: "Audio generation failed" },
      { status: 502 },
    );
  }
}
