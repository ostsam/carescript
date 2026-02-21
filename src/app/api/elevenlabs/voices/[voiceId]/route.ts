import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import { deleteVoice } from "@/lib/elevenlabs/voice-cloning";

interface RouteParams {
  params: Promise<{ voiceId: string }>;
}

/**
 * DELETE /api/elevenlabs/voices/:voiceId
 *
 * Permanently removes a cloned voice from ElevenLabs.
 *
 * This must be called when:
 *   - A patient record is deleted (cascade GDPR / HIPAA data erasure)
 *   - The loved one revokes consent
 *
 * Important: the caller must also clear `patients.elevenlabs_voice_id`
 * in Neon after a successful response.
 *
 * TODO: verify the voiceId belongs to the requesting nurse's org before
 * deleting — requires a DB lookup once the patients API is wired up.
 */
export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const { data: session } = await auth.getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { voiceId } = await params;

  try {
    await deleteVoice(voiceId);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error(`[Voices] Failed to delete voice ${voiceId}:`, err);
    return NextResponse.json(
      { error: "Failed to delete voice" },
      { status: 502 },
    );
  }
}
