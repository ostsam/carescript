import { elevenlabs } from "./client";

// Scribe v2 — best accuracy, speaker diarization, 90+ languages.
// Used for Ambient Scribe mode where low latency is less critical than accuracy.
const STT_MODEL = "scribe_v2";

export interface TranscribeOptions {
	/** Raw audio as a Blob or File (from multipart form data). */
	audio: Blob | File;
	/** ISO 639-1 language code. Defaults to auto-detection. */
	languageCode?: string;
	/**
	 * Clinical keyterms to bias the model toward — improves recognition of drug
	 * names, procedures, and condition names (up to 100 terms).
	 *
	 * Example: ["beta-blocker", "metoprolol", "tachycardia"]
	 */
	keyterms?: string[];
}

export interface TranscriptSegment {
	text: string;
	/** Speaker label when diarization is enabled (e.g. "speaker_0"). */
	speaker?: string;
	startTime?: number;
	endTime?: number;
}

export interface TranscribeResult {
	/** Full concatenated transcript. */
	text: string;
	/** Per-word segments with timing and speaker data. */
	segments: TranscriptSegment[];
	/** Detected language code (ISO 639-1). */
	detectedLanguage?: string;
}

/**
 * Transcribe a completed audio recording with Scribe v2.
 *
 * Pipeline role — Ambient Scribe mode:
 *   1. Nurse ends the passive recording session
 *   2. Client POSTs the audio blob to /api/elevenlabs/stt
 *   3. This function transcribes it (Scribe v2 — high accuracy, diarization)
 *   4. The transcript is PII-sanitized by aegis-shield before VibeFlow sees it
 *   5. VibeFlow extracts SOAP facts; result is saved to clinical_notes
 */
export async function transcribeAudio({
	audio,
	languageCode,
	keyterms = [],
}: TranscribeOptions): Promise<TranscribeResult> {
	// The SDK types `convert` as returning a union (chunk | multichannel | webhook).
	// We never set webhook or useMultiChannel, so we always get the chunk model.
	const result = (await elevenlabs.speechToText.convert({
		file: audio,
		modelId: STT_MODEL,
		languageCode,
		// Enable speaker diarization — useful for distinguishing nurse vs patient
		// voices in ambient recordings.
		diarize: true,
		keyterms,
		// Tag audio events (coughs, background noise) for richer SOAP context.
		tagAudioEvents: true,
	})) as {
		text: string;
		words?: {
			type: string;
			text: string;
			speakerId?: string;
			start?: number;
			end?: number;
		}[];
		languageCode?: string;
	};

	const text = result.text ?? "";

	const segments: TranscriptSegment[] = (result.words ?? [])
		.filter((w) => w.type === "word")
		.map((w) => ({
			text: w.text ?? "",
			speaker: w.speakerId ?? undefined,
			startTime: w.start ?? undefined,
			endTime: w.end ?? undefined,
		}));

	return {
		text,
		segments,
		detectedLanguage: result.languageCode ?? undefined,
	};
}
