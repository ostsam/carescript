import { elevenlabs } from "./client";

export interface CloneVoiceOptions {
  /**
   * Display name stored in ElevenLabs and in our DB.
   * Convention: "<loved-one-name> for <patient-first-name>"
   * e.g. "Margaret for Robert"
   */
  name: string;
  /**
   * One or more audio samples of the loved one's voice.
   * 1–25 files, ideally 1–3 minutes total of clean speech.
   * Supported formats: mp3, wav, m4a, ogg, flac.
   */
  files: (Blob | File)[];
  /** Optional context that improves clone accuracy (age, accent, etc.). */
  description?: string;
  /**
   * Labels attached to the voice in ElevenLabs — useful for filtering.
   * We tag clones so they can be distinguished from pre-built voices.
   */
  labels?: Record<string, string>;
}

export interface ClonedVoice {
  voiceId: string;
  name: string;
}

/**
 * Instant Voice Clone (IVC) — creates a voice clone from audio samples.
 *
 * The returned `voiceId` must be written back to `patients.elevenlabs_voice_id`
 * in Neon so the Intervention pipeline can retrieve it per-patient.
 *
 * IVC produces a usable clone from as little as a single 30-second sample.
 * Quality improves significantly with 3+ minutes of diverse speech.
 */
export async function cloneVoice({
  name,
  files,
  description,
  labels = { category: "carescript-loved-one" },
}: CloneVoiceOptions): Promise<ClonedVoice> {
  const result = await elevenlabs.voices.ivc.create({
    name,
    files: files as File[],
    description,
    labels,
  });

  return {
    voiceId: result.voiceId,
    name,
  };
}

export interface VoiceSummary {
  voiceId: string;
  name: string;
  category: string;
  description?: string;
  previewUrl?: string;
}

/**
 * List all voices available in the workspace.
 * Filters to only return cloned voices tagged with our category label.
 */
export async function listClonedVoices(): Promise<VoiceSummary[]> {
  const response = await elevenlabs.voices.getAll();

  return (response.voices ?? [])
    .filter(
      (v) =>
        v.category === "cloned" &&
        v.labels?.["category"] === "carescript-loved-one",
    )
    .map((v) => ({
      voiceId: v.voiceId,
      name: v.name ?? "",
      category: v.category ?? "cloned",
      description: v.description ?? undefined,
      previewUrl: v.previewUrl ?? undefined,
    }));
}

/**
 * Permanently delete a cloned voice from ElevenLabs.
 * Call this when a patient record is deleted or when consent is revoked.
 *
 * NOTE: Also clear `patients.elevenlabs_voice_id` in Neon after deletion.
 */
export async function deleteVoice(voiceId: string): Promise<void> {
  await elevenlabs.voices.delete(voiceId);
}
