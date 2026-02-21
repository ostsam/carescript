import { elevenlabs } from "./client";

// Flash v2.5 — ~75ms latency, ideal for the Intervention (crisis override) mode.
const TTS_MODEL = "eleven_flash_v2_5";

// Output format: MP3 at 44.1kHz / 128kbps — good fidelity, universally supported.
const OUTPUT_FORMAT = "mp3_44100_128" as const;

export interface TtsStreamOptions {
  voiceId: string;
  /** Fully hydrated text — PII tokens already replaced. */
  text: string;
  /** Override the default Flash model (e.g., use eleven_multilingual_v2 for highest quality). */
  modelId?: string;
}

/**
 * Stream TTS audio chunks from ElevenLabs.
 *
 * Returns a `ReadableStream<Uint8Array>` that can be piped directly into a
 * Next.js `Response`, sending audio to the client the moment bytes arrive.
 *
 * Usage (Intervention mode pipeline):
 *   1. Nurse speaks → STT → aegis-shield sanitizes PII
 *   2. VibeFlow translates to empathetic loved-one dialogue
 *   3. Server hydrates [PATIENT] token → calls streamSpeech
 *   4. Next.js Route streams the resulting audio to the browser
 */
export async function streamSpeech({
  voiceId,
  text,
  modelId = TTS_MODEL,
}: TtsStreamOptions): Promise<ReadableStream<Uint8Array>> {
  const audioStream = await elevenlabs.textToSpeech.stream(voiceId, {
    text,
    modelId,
    outputFormat: OUTPUT_FORMAT,
    // Max latency optimisation — safe for short intervention phrases.
    optimizeStreamingLatency: 3,
    voiceSettings: {
      // Balanced: enough stability to sound like the loved one, enough
      // similarity to follow emotional cues in the translated text.
      stability: 0.5,
      similarityBoost: 0.75,
    },
  });

  return audioStream;
}

/**
 * Generate a complete (non-streaming) audio buffer.
 * Useful for short phrases where you want the full clip before playing,
 * or for server-side audio processing / logging.
 */
export async function synthesizeSpeech({
  voiceId,
  text,
  modelId = TTS_MODEL,
}: TtsStreamOptions): Promise<ReadableStream<Uint8Array>> {
  const audioStream = await elevenlabs.textToSpeech.convert(voiceId, {
    text,
    modelId,
    outputFormat: OUTPUT_FORMAT,
    voiceSettings: {
      stability: 0.5,
      similarityBoost: 0.75,
    },
  });

  return audioStream;
}
