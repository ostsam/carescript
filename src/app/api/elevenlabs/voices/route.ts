import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import { cloneVoice, listClonedVoices } from "@/lib/elevenlabs/voice-cloning";

/**
 * GET /api/elevenlabs/voices
 *
 * Returns all CareScript-owned cloned voices in the ElevenLabs workspace.
 * The nurse/admin UI uses this to verify a clone exists before assigning
 * it to a patient record.
 */
export async function GET() {
  const { data: session } = await auth.getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const voices = await listClonedVoices();
    return NextResponse.json({ voices });
  } catch (err) {
    console.error("[Voices] Failed to list voices:", err);
    return NextResponse.json(
      { error: "Failed to retrieve voices" },
      { status: 502 },
    );
  }
}

/**
 * POST /api/elevenlabs/voices
 *
 * Creates an Instant Voice Clone (IVC) from one or more audio samples.
 *
 * Expected multipart form fields:
 *   - name:         Display name for the clone — required
 *                   Convention: "<loved-one-name> for <patient-first-name>"
 *   - files:        One or more audio files (mp3/wav/m4a/ogg/flac) — required
 *                   At least 30s of clean speech; 1-3 min is optimal
 *   - description:  Optional context (age, accent, relationship) for accuracy
 *
 * Returns: { voiceId, name }
 *
 * The caller must then PATCH /api/patients/:id to persist voiceId in Neon,
 * so the Intervention pipeline can look it up per-patient.
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

  const name = formData.get("name");
  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const rawFiles = formData.getAll("files");
  const files = rawFiles.filter((f): f is File => f instanceof File);
  if (files.length === 0) {
    return NextResponse.json(
      { error: "At least one audio file is required" },
      { status: 400 },
    );
  }

  const description =
    (formData.get("description") as string | null) ?? undefined;

  try {
    const cloned = await cloneVoice({ name: name.trim(), files, description });
    return NextResponse.json(cloned, { status: 201 });
  } catch (err) {
    console.error("[Voices] IVC creation failed:", err);
    return NextResponse.json(
      { error: "Voice cloning failed" },
      { status: 502 },
    );
  }
}
 