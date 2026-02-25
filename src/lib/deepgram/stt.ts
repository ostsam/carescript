import { deepgram } from "./client";

// Nova-3 — Deepgram's highest-accuracy general model.
const STT_MODEL = "nova-3-medical";

export interface TranscribeOptions {
	/** Raw audio as a Blob or File (from multipart form data). */
	audio: Blob | File;
	/** BCP-47 or ISO language code. Defaults to auto-detection. */
	languageCode?: string;
	/**
	 * Clinical keyterms to bias the model toward — improves recognition of drug
	 * names, procedures, and condition names.
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
	/** Detected language code (if provided by Deepgram). */
	detectedLanguage?: string;
}

/**
 * Transcribe a completed audio recording with Deepgram Nova-3.
 *
 * Pipeline role — Ambient Scribe mode (post-call refinement):
 *   1. Nurse ends the passive recording session
 *   2. Client POSTs the audio blob to /api/deepgram/stt
 *   3. This function transcribes it (Nova-3 — high accuracy, diarization)
 *   4. The transcript is PII-sanitized by aegis-shield before VibeFlow sees it
 *   5. VibeFlow extracts SOAP facts; result is saved to clinical_notes
 */
export async function transcribeAudio({
	audio,
	languageCode,
	keyterms = [],
}: TranscribeOptions): Promise<TranscribeResult> {
	const buffer = Buffer.from(await audio.arrayBuffer());
	const language = languageCode ?? "en";

	const { result, error } = await deepgram.listen.prerecorded.transcribeFile(
		buffer,
		{
			model: STT_MODEL,
			language,
			diarize: true,
			smart_format: true,
			punctuate: true,
			utterances: true,
			filler_words: true,
			keyterm: keyterms.length > 0 ? keyterms : undefined,
		},
	);

	if (error) {
		throw error;
	}

	const channel = result.results.channels[0];
	const alternative = channel?.alternatives?.[0];
	const utterances = result.results.utterances ?? [];
	const text =
		utterances.length > 0
			? utterances
					.map(
						(u) =>
							`Speaker ${((u.speaker ?? 0) + 1).toString()}: ${u.transcript}`,
					)
					.join("\n")
			: (alternative?.transcript ?? "");

	const segments: TranscriptSegment[] = (alternative?.words ?? []).map((w) => ({
		text: w.punctuated_word ?? w.word ?? "",
		speaker: w.speaker !== undefined ? `speaker_${w.speaker}` : undefined,
		startTime: w.start ?? undefined,
		endTime: w.end ?? undefined,
	}));

	return {
		text,
		segments,
		detectedLanguage: channel?.detected_language ?? undefined,
	};
}
