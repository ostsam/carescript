"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import { createClient, LiveTranscriptionEvents } from "@deepgram/sdk";
import type { ListenLiveClient } from "@deepgram/sdk";
import {
	ArrowLeft01Icon,
	Mic01Icon,
	StopIcon,
	Alert02Icon,
	CheckmarkCircle01Icon,
	Stethoscope02Icon,
	HeadphonesIcon,
	Loading03Icon,
} from "@hugeicons/core-free-icons";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	Combobox,
	ComboboxInput,
	ComboboxContent,
	ComboboxList,
	ComboboxItem,
	ComboboxEmpty,
} from "@/components/ui/combobox";
import { MicrophoneWaveform } from "@/components/ui/waveform";
import {
	useCalibrationClip,
	type CalibrationStatus,
} from "@/components/calibration/use-calibration-clip";
import {
	useInterventionController,
	type InterventionState,
} from "@/hooks/use-intervention-controller";
import { type PatientOption } from "../actions";
import { saveSession } from "../actions";

type Step = "setup" | "calibration" | "recording" | "processing" | "review";

interface Props {
	patients: PatientOption[];
	defaultPatientId?: string;
}

async function decodeAudioBlob(
	blob: Blob,
	audioContext: AudioContext,
): Promise<AudioBuffer> {
	const arrayBuffer = await blob.arrayBuffer();
	return audioContext.decodeAudioData(arrayBuffer);
}

async function resampleAudioBuffer(
	buffer: AudioBuffer,
	targetSampleRate: number,
): Promise<AudioBuffer> {
	if (buffer.sampleRate === targetSampleRate) return buffer;
	const length = Math.ceil(buffer.duration * targetSampleRate);
	const offline = new OfflineAudioContext(
		buffer.numberOfChannels,
		length,
		targetSampleRate,
	);
	const source = offline.createBufferSource();
	source.buffer = buffer;
	source.connect(offline.destination);
	source.start(0);
	return offline.startRendering();
}

function mixToMono(buffer: AudioBuffer): Float32Array {
	const { numberOfChannels, length } = buffer;
	if (numberOfChannels === 1) {
		return buffer.getChannelData(0).slice();
	}
	const mono = new Float32Array(length);
	for (let channel = 0; channel < numberOfChannels; channel += 1) {
		const data = buffer.getChannelData(channel);
		for (let i = 0; i < length; i += 1) {
			mono[i] += data[i];
		}
	}
	for (let i = 0; i < length; i += 1) {
		mono[i] /= numberOfChannels;
	}
	return mono;
}

function encodeWav(samples: Float32Array, sampleRate: number): Blob {
	const buffer = new ArrayBuffer(44 + samples.length * 2);
	const view = new DataView(buffer);

	const writeString = (offset: number, value: string) => {
		for (let i = 0; i < value.length; i += 1) {
			view.setUint8(offset + i, value.charCodeAt(i));
		}
	};

	writeString(0, "RIFF");
	view.setUint32(4, 36 + samples.length * 2, true);
	writeString(8, "WAVE");
	writeString(12, "fmt ");
	view.setUint32(16, 16, true);
	view.setUint16(20, 1, true); // PCM
	view.setUint16(22, 1, true); // mono
	view.setUint32(24, sampleRate, true);
	view.setUint32(28, sampleRate * 2, true);
	view.setUint16(32, 2, true);
	view.setUint16(34, 16, true);
	writeString(36, "data");
	view.setUint32(40, samples.length * 2, true);

	let offset = 44;
	for (let i = 0; i < samples.length; i += 1) {
		const sample = Math.max(-1, Math.min(1, samples[i]));
		view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
		offset += 2;
	}

	return new Blob([buffer], { type: "audio/wav" });
}

type CalibratedAudio = {
	blob: Blob;
	calibrationSeconds: number;
};

async function buildCalibratedWav(
	calibration: Blob,
	recording: Blob,
): Promise<CalibratedAudio> {
	const AudioContextCtor =
		window.AudioContext ||
		(window as typeof window & { webkitAudioContext: typeof AudioContext })
			.webkitAudioContext;
	const audioContext = new AudioContextCtor();
	try {
		const [calibrationBuffer, recordingBuffer] = await Promise.all([
			decodeAudioBlob(calibration, audioContext),
			decodeAudioBlob(recording, audioContext),
		]);
		const targetSampleRate = 16000;
		const [calResampled, recResampled] = await Promise.all([
			resampleAudioBuffer(calibrationBuffer, targetSampleRate),
			resampleAudioBuffer(recordingBuffer, targetSampleRate),
		]);
		const calMono = mixToMono(calResampled);
		const recMono = mixToMono(recResampled);
		const combined = new Float32Array(calMono.length + recMono.length);
		combined.set(calMono, 0);
		combined.set(recMono, calMono.length);
		return {
			blob: encodeWav(combined, targetSampleRate),
			calibrationSeconds: calMono.length / targetSampleRate,
		};
	} finally {
		await audioContext.close();
	}
}

function formatSpeakerLabel(speakerId: string) {
	const match = speakerId.match(/speaker_(\d+)/);
	if (match) {
		return `Speaker ${Number(match[1]) + 1}`;
	}
	return speakerId;
}

function buildTranscriptFromSegments(
	segments: { text: string; speaker?: string }[],
): string {
	if (segments.length === 0) return "";
	const hasSpeakers = segments.some((s) => s.speaker);
	if (!hasSpeakers) {
		return segments.map((s) => s.text).join(" ").trim();
	}

	const lines: string[] = [];
	let currentSpeaker = segments[0].speaker || "speaker_0";
	let currentWords: string[] = [];

	segments.forEach((segment) => {
		const speaker = segment.speaker || currentSpeaker;
		if (speaker !== currentSpeaker && currentWords.length > 0) {
			lines.push(`${formatSpeakerLabel(currentSpeaker)}: ${currentWords.join(" ")}`);
			currentWords = [];
			currentSpeaker = speaker;
		}
		currentWords.push(segment.text);
	});

	if (currentWords.length > 0) {
		lines.push(`${formatSpeakerLabel(currentSpeaker)}: ${currentWords.join(" ")}`);
	}

	return lines.join("\n");
}

function blobToBase64(blob: Blob): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onloadend = () => {
			if (typeof reader.result !== "string") {
				reject(new Error("Failed to read audio data"));
				return;
			}
			const base64 = reader.result.split(",")[1] ?? "";
			resolve(base64);
		};
		reader.onerror = () => reject(reader.error);
		reader.readAsDataURL(blob);
	});
}

export function NewSessionFlow({ patients, defaultPatientId }: Props) {
	const router = useRouter();
	const [step, setStep] = useState<Step>("setup");
	const [selectedPatientId, setSelectedPatientId] = useState<string | null>(
		defaultPatientId ?? null,
	);
	const [mode, setMode] = useState<"Routine" | "Intervention">("Routine");
	const [transcript, setTranscript] = useState("");
	const [liveTranscript, setLiveTranscript] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [saving, setSaving] = useState(false);
	const [interventionState, setInterventionState] = useState<InterventionState>("monitoring");

	const {
		status: calibrationStatus,
		recording: calibrationRecording,
		error: calibrationError,
		blob: calibrationBlob,
		audioUrl: calibrationAudioUrl,
		startRecording: startCalibrationRecording,
		stopRecording: stopCalibrationRecording,
	} = useCalibrationClip();

	// Recording state
	const [elapsed, setElapsed] = useState(0);
	const mediaRecorderRef = useRef<MediaRecorder | null>(null);
	const chunksRef = useRef<Blob[]>([]);
	const pendingChunksRef = useRef<Blob[]>([]);
	const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
	const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
	const deepgramConnectionRef = useRef<ListenLiveClient | null>(null);
	const deepgramReadyRef = useRef(false);
	const finalTranscriptRef = useRef("");
	const liveStatusRef = useRef<"idle" | "recording" | "stopping">("idle");

	const selectedPatient = patients.find((p) => p.id === selectedPatientId);

	// ── Intervention controller (after selectedPatient is declared) ───────────
	const patientContext = selectedPatient
		? {
			patientFirstName: selectedPatient.firstName,
			nurseFirstName: "Nurse", // TODO: pull from auth session when available
			lovedOneRelation: selectedPatient.lovedOneRelation,
			elevenlabsVoiceId: selectedPatient.elevenlabsVoiceId ?? null,
		}
		: null;

	const { processSegment, endIntervention, conversation } = useInterventionController({
		patientContext,
		onStateChange: setInterventionState,
	});

	const startDisabled =
		!selectedPatientId ||
		mode !== "Routine" ||
		calibrationStatus === "loading" ||
		calibrationStatus === "saving";

	useEffect(() => {
		return () => {
			if (timerRef.current) clearInterval(timerRef.current);
			if (mediaRecorderRef.current?.state === "recording") {
				mediaRecorderRef.current.stop();
			}
			if (deepgramConnectionRef.current) {
				liveStatusRef.current = "idle";
				deepgramConnectionRef.current.requestClose();
			}
		};
	}, []);

	const startRecording = useCallback(async () => {
		try {
			setError(null);
			setTranscript("");
			setLiveTranscript("");
			finalTranscriptRef.current = "";
			liveStatusRef.current = "recording";
			const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
			const preferredMimeType = MediaRecorder.isTypeSupported(
				"audio/webm;codecs=opus",
			)
				? "audio/webm;codecs=opus"
				: "audio/webm";
			const recorder = new MediaRecorder(stream, {
				mimeType: preferredMimeType,
			});
			chunksRef.current = [];
			pendingChunksRef.current = [];

			const tokenRes = await fetch("/api/deepgram/token", { method: "POST" });
			if (!tokenRes.ok) {
				throw new Error("Failed to authorize realtime transcription");
			}
			const tokenBody = await tokenRes.json();
			const dgClient = createClient(tokenBody.token);
			const connection = dgClient.listen.live({
				model: "nova-3",
				language: "en",
				diarize: true,
				punctuate: true,
				smart_format: true,
				interim_results: true,
				vad_events: true,
				utterance_end_ms: 1000,
			});

			deepgramConnectionRef.current = connection;
			deepgramReadyRef.current = false;

			connection.on(LiveTranscriptionEvents.Open, () => {
				deepgramReadyRef.current = true;
				if (pendingChunksRef.current.length > 0) {
					pendingChunksRef.current.forEach((chunk) => connection.send(chunk));
					pendingChunksRef.current = [];
				}
			});

			connection.on(LiveTranscriptionEvents.Close, () => {
				deepgramReadyRef.current = false;
				deepgramConnectionRef.current = null;
				if (liveStatusRef.current !== "recording") {
					liveStatusRef.current = "idle";
				}
			});

			connection.on(LiveTranscriptionEvents.Transcript, (data) => {
				const alternative = data.channel?.alternatives?.[0];
				const text = alternative?.transcript?.trim();
				if (!text) return;

				if (data.is_final) {
					finalTranscriptRef.current = finalTranscriptRef.current
						? `${finalTranscriptRef.current} ${text}`
						: text;
					setTranscript(finalTranscriptRef.current);
					setLiveTranscript("");

					// Feed final segments into the intervention classifier
					const words = alternative?.words;
					const speakerLabel = words?.[0]?.speaker !== undefined
						? `speaker_${words[0].speaker}`
						: undefined;
					processSegment({ text, speaker: speakerLabel, timestamp: Date.now() });
				} else {
					setLiveTranscript(text);
					setTranscript(
						finalTranscriptRef.current
							? `${finalTranscriptRef.current} ${text}`
							: text,
					);
				}
			});

			connection.on(LiveTranscriptionEvents.Error, (err) => {
				if (liveStatusRef.current !== "recording") {
					return;
				}
				console.error("[Deepgram] Live transcription error:", err);
				setError("Realtime transcription failed. Please try again.");
			});

			recorder.ondataavailable = (e) => {
				if (e.data.size > 0) {
					chunksRef.current.push(e.data);
					if (deepgramReadyRef.current && deepgramConnectionRef.current) {
						deepgramConnectionRef.current.send(e.data);
					} else {
						pendingChunksRef.current.push(e.data);
					}
				}
			};

			recorder.onstop = () => {
				stream.getTracks().forEach((t) => t.stop());
				const blob = new Blob(chunksRef.current, {
					type: recorder.mimeType || "audio/webm",
				});
				setAudioBlob(blob);
			};

			mediaRecorderRef.current = recorder;
			recorder.start(250);
			setElapsed(0);
			setStep("recording");

			timerRef.current = setInterval(() => {
				setElapsed((prev) => prev + 1);
			}, 1000);
		} catch (err) {
			console.error("[Deepgram] Failed to start recording:", err);
			setError(
				err instanceof Error
					? err.message
					: "Unable to start recording. Please check microphone access and try again.",
			);
		}
	}, []);

	const beginSession = useCallback(() => {
		if (calibrationStatus === "missing" || calibrationStatus === "error") {
			setStep("calibration");
			return;
		}
		void startRecording();
	}, [calibrationStatus, startRecording]);

	const continueToRecording = useCallback(() => {
		void startRecording();
	}, [startRecording]);

	const skipCalibration = useCallback(() => {
		void startRecording();
	}, [startRecording]);

	const stopRecording = useCallback(() => {
		mediaRecorderRef.current?.stop();
		if (timerRef.current) {
			clearInterval(timerRef.current);
			timerRef.current = null;
		}
		if (deepgramConnectionRef.current) {
			liveStatusRef.current = "stopping";
			deepgramConnectionRef.current.finalize();
			deepgramConnectionRef.current.requestClose();
		}
		setStep("processing");
	}, []);

	useEffect(() => {
		if (step !== "processing" || !audioBlob) return;
		const recordingBlob = audioBlob;
		const calibrationClip = calibrationBlob;

		let cancelled = false;

		async function transcribe() {
			setError(null);
			try {
				let transcriptionBlob: Blob = recordingBlob;
				let calibrationSeconds = 0;
				if (calibrationClip) {
					try {
						const calibrated = await buildCalibratedWav(
							calibrationClip,
							recordingBlob,
						);
						transcriptionBlob = calibrated.blob;
						calibrationSeconds = calibrated.calibrationSeconds;
					} catch (concatError) {
						console.error("[Calibration] Failed to prepend clip:", concatError);
					}
				}

				const formData = new FormData();
				const fileName =
					transcriptionBlob.type === "audio/wav"
						? "session.wav"
						: "session.webm";
				const file = new File([transcriptionBlob], fileName, {
					type: transcriptionBlob.type || "audio/wav",
				});
				formData.append("audio", file);

				const res = await fetch("/api/deepgram/stt", {
					method: "POST",
					body: formData,
				});

				if (!res.ok) {
					const body = await res.json().catch(() => ({}));
					throw new Error(body.error || "Transcription failed");
				}

				const result = await res.json();
				if (!cancelled) {
					const rawSegments = Array.isArray(result.segments) ? result.segments : [];
					const segments = calibrationSeconds
						? rawSegments
							.filter(
								(segment: { endTime?: number }) =>
									segment.endTime === undefined ||
									segment.endTime > calibrationSeconds,
							)
							.map((segment: { startTime?: number; endTime?: number }) => ({
								...segment,
								startTime:
									segment.startTime !== undefined
										? Math.max(0, segment.startTime - calibrationSeconds)
										: undefined,
								endTime:
									segment.endTime !== undefined
										? Math.max(0, segment.endTime - calibrationSeconds)
										: undefined,
							}))
						: rawSegments;

					const finalTranscript =
						segments.length > 0
							? buildTranscriptFromSegments(segments)
							: (result.text || "");
					setTranscript(finalTranscript);
					setStep("review");
				}
			} catch (err) {
				if (!cancelled) {
					setError(err instanceof Error ? err.message : "Transcription failed");
					setStep("review");
				}
			}
		}

		transcribe();
		return () => {
			cancelled = true;
		};
	}, [step, audioBlob, calibrationBlob]);

	async function handleSave() {
		if (!selectedPatientId || !transcript.trim()) return;

		setSaving(true);
		setError(null);

		try {
			const audioBase64 = audioBlob ? await blobToBase64(audioBlob) : null;
			const result = await saveSession(
				selectedPatientId,
				mode,
				transcript,
				audioBase64,
				audioBlob?.type ?? null,
			);
			if (!result.success) {
				throw new Error(result.error);
			}
			router.push(`/dashboard/sessions/${result.sessionId}`);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to save session");
			setSaving(false);
		}
	}

	function formatTime(seconds: number) {
		const m = Math.floor(seconds / 60);
		const s = seconds % 60;
		return `${m}:${s.toString().padStart(2, "0")}`;
	}

	return (
		<>
			{/* Back link */}
			<div className="pt-4">
				<Button variant="ghost" size="sm" asChild className="-ml-2">
					<Link href="/dashboard/sessions">
						<HugeiconsIcon icon={ArrowLeft01Icon} data-icon="inline-start" />
						All Sessions
					</Link>
				</Button>
			</div>

			{step === "setup" && (
				<SetupStep
					patients={patients}
					selectedPatientId={selectedPatientId}
					onPatientChange={setSelectedPatientId}
					mode={mode}
					onModeChange={setMode}
					onStart={beginSession}
					startDisabled={startDisabled}
					calibrationStatus={calibrationStatus}
					error={error}
					selectedPatient={selectedPatient}
				/>
			)}

			{step === "calibration" && (
				<CalibrationStep
					calibrationStatus={calibrationStatus}
					calibrationRecording={calibrationRecording}
					calibrationError={calibrationError}
					calibrationAudioUrl={calibrationAudioUrl}
					onCalibrationStart={startCalibrationRecording}
					onCalibrationStop={stopCalibrationRecording}
					onContinue={continueToRecording}
					onSkip={skipCalibration}
					onBack={() => setStep("setup")}
				/>
			)}

			{step === "recording" && (
				<RecordingStep
					patient={selectedPatient!}
					mode={mode}
					elapsed={elapsed}
					formatTime={formatTime}
					onStop={stopRecording}
					transcript={transcript || liveTranscript}
					interventionState={interventionState}
					onEndIntervention={() => void endIntervention("nurse_override")}
					agentSpeaking={conversation.isSpeaking}
				/>
			)}

			{step === "processing" && (
				<ProcessingStep patient={selectedPatient!} error={error} />
			)}

			{step === "review" && (
				<ReviewStep
					patient={selectedPatient!}
					mode={mode}
					elapsed={elapsed}
					formatTime={formatTime}
					transcript={transcript}
					onTranscriptChange={setTranscript}
					onSave={handleSave}
					saving={saving}
					error={error}
					onRestart={() => {
						setStep("setup");
						setAudioBlob(null);
						setTranscript("");
						setLiveTranscript("");
						setElapsed(0);
						setError(null);
					}}
				/>
			)}
		</>
	);
}

/* ---------- Setup Step ---------- */

function SetupStep({
	patients,
	selectedPatientId,
	onPatientChange,
	mode,
	onModeChange,
	onStart,
	startDisabled,
	calibrationStatus,
	error,
	selectedPatient,
}: {
	patients: PatientOption[];
	selectedPatientId: string | null;
	onPatientChange: (id: string | null) => void;
	mode: "Routine" | "Intervention";
	onModeChange: (m: "Routine" | "Intervention") => void;
	onStart: () => void;
	startDisabled: boolean;
	calibrationStatus: CalibrationStatus;
	error: string | null;
	selectedPatient?: PatientOption;
}) {
	const canStart = !startDisabled;

	return (
		<>
			<div>
				<h1 className="text-xl font-semibold tracking-tight">New Session</h1>
				<p className="text-sm text-muted-foreground mt-1">
					Select a patient and session type, then start recording.
				</p>
			</div>

			<Card>
				<CardContent className="space-y-8 pt-8 pb-6">
					{/* Patient selector */}
					<div className="space-y-3">
						<Label>Patient</Label>
						<Combobox
							value={selectedPatientId}
							onValueChange={(val) => onPatientChange(val as string | null)}
							itemToStringLabel={(id) => {
								const p = patients.find((pt) => pt.id === id);
								return p ? `${p.firstName} ${p.lastName}` : "";
							}}
						>
							<ComboboxInput
								placeholder="Search patients..."
								showClear={!!selectedPatientId}
							/>
							<ComboboxContent>
								<ComboboxList>
									<ComboboxEmpty>No patients found</ComboboxEmpty>
									{patients.map((p) => (
										<ComboboxItem key={p.id} value={p.id}>
											<span className="font-medium">
												{p.firstName} {p.lastName}
											</span>
											{p.hasVoice && (
												<Badge
													variant="default"
													className="ml-auto bg-emerald-600 text-white text-[10px]"
												>
													Voice
												</Badge>
											)}
										</ComboboxItem>
									))}
								</ComboboxList>
							</ComboboxContent>
						</Combobox>
						{patients.length === 0 && (
							<p className="text-xs text-muted-foreground">
								No patients found.{" "}
								<Link
									href="/dashboard/patients/new"
									className="text-primary underline"
								>
									Add a patient first.
								</Link>
							</p>
						)}
					</div>

					{/* Mode selector */}
					<div className="space-y-4">
						<Label>Session Type</Label>
						<div className="grid gap-5 md:grid-cols-2">
							<button
								type="button"
								onClick={() => onModeChange("Routine")}
								className={`relative flex min-h-[150px] flex-col items-center gap-3 rounded-2xl border-2 p-6 text-center transition-colors ${mode === "Routine"
									? "border-primary bg-primary/5"
									: "border-border hover:border-muted-foreground/30"
									}`}
							>
								<div
									className={`flex size-10 items-center justify-center rounded-full ${mode === "Routine"
										? "bg-primary/10 text-primary"
										: "bg-muted text-muted-foreground"
										}`}
								>
									<HugeiconsIcon icon={Stethoscope02Icon} size={20} />
								</div>
								<span className="text-sm font-medium">Routine</span>
								<span className="text-xs text-muted-foreground leading-relaxed">
									Ambient scribe for daily care
								</span>
							</button>

							<button
								type="button"
								onClick={() => onModeChange("Intervention")}
								className={`relative flex min-h-[150px] flex-col items-center gap-3 rounded-2xl border-2 p-6 text-center transition-colors ${mode === "Intervention"
									? "border-primary bg-primary/5"
									: "border-border hover:border-muted-foreground/30"
									}`}
							>
								{mode === "Intervention" && (
									<Badge className="absolute top-2 right-2 bg-amber-500 text-white text-[9px] px-1.5">
										Coming Soon
									</Badge>
								)}
								<div
									className={`flex size-10 items-center justify-center rounded-full ${mode === "Intervention"
										? "bg-primary/10 text-primary"
										: "bg-muted text-muted-foreground"
										}`}
								>
									<HugeiconsIcon icon={HeadphonesIcon} size={20} />
								</div>
								<span className="text-sm font-medium">Intervention</span>
								<span className="text-xs text-muted-foreground leading-relaxed">
									Crisis de-escalation with voice
								</span>
								{selectedPatient &&
									!selectedPatient.hasVoice &&
									mode === "Intervention" && (
										<span className="text-[10px] text-amber-600 mt-2">
											No voice clone for this patient
										</span>
									)}
							</button>
						</div>
					</div>

					{/* Error */}
					{error && (
						<div className="flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
							<HugeiconsIcon icon={Alert02Icon} size={16} />
							{error}
						</div>
					)}

					{/* Intervention coming-soon message */}
					{mode === "Intervention" && (
						<div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-center dark:border-amber-900 dark:bg-amber-950/30">
							<p className="text-sm font-medium text-amber-800 dark:text-amber-200">
								Intervention mode is coming soon
							</p>
							<p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
								The real-time voice pipeline (STT, VibeFlow translation, and TTS
								with the loved one&apos;s cloned voice) is under active
								development.
							</p>
						</div>
					)}
				</CardContent>
				<CardFooter className="flex items-center justify-end border-t px-6 py-5">
					<div className="flex w-full flex-col items-end gap-2 sm:w-auto">
						<Button
							size="lg"
							className="w-full rounded-full shadow-sm shadow-primary/25 sm:w-auto"
							disabled={!canStart}
							onClick={onStart}
						>
							<HugeiconsIcon icon={Mic01Icon} data-icon="inline-start" />
							Start Recording
						</Button>
						{calibrationStatus === "loading" && (
							<span className="text-[11px] text-muted-foreground">
								Loading calibration clip…
							</span>
						)}
						{calibrationStatus === "saving" && (
							<span className="text-[11px] text-muted-foreground">
								Saving calibration clip…
							</span>
						)}
					</div>
				</CardFooter>
			</Card>
		</>
	);
}

/* ---------- Calibration Step ---------- */

function CalibrationStep({
	calibrationStatus,
	calibrationRecording,
	calibrationError,
	calibrationAudioUrl,
	onCalibrationStart,
	onCalibrationStop,
	onContinue,
	onSkip,
	onBack,
}: {
	calibrationStatus: CalibrationStatus;
	calibrationRecording: boolean;
	calibrationError: string | null;
	calibrationAudioUrl: string | null;
	onCalibrationStart: () => void;
	onCalibrationStop: () => void;
	onContinue: () => void;
	onSkip: () => void;
	onBack: () => void;
}) {
	const canContinue = calibrationStatus === "ready";
	const showSkip = !canContinue;
	const isBusy = calibrationStatus === "loading" || calibrationStatus === "saving";
	const hasClip = !!calibrationAudioUrl;
	const [showOverwriteDialog, setShowOverwriteDialog] = useState(false);

	const handleStartRecording = () => {
		if (hasClip) {
			setShowOverwriteDialog(true);
			return;
		}
		onCalibrationStart();
	};

	const confirmOverwrite = () => {
		setShowOverwriteDialog(false);
		onCalibrationStart();
	};

	return (
		<>
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-xl font-semibold tracking-tight">
						Calibration Clip
					</h1>
					<p className="text-sm text-muted-foreground mt-1">
						Record a short sample to improve diarization accuracy.
					</p>
				</div>
				<Button variant="ghost" size="sm" onClick={onBack}>
					Back
				</Button>
			</div>

			<Card>
				<CardContent className="space-y-4 pt-6">
					<div className="rounded-lg border bg-muted/30 px-4 py-3 text-sm">
						<p className="text-sm font-medium">20–30 seconds recommended.</p>
						<p className="text-xs text-muted-foreground mt-1">
							This clip is prepended to each session so the diarizer can lock
							onto the nurse&apos;s voice.
						</p>
					</div>

					<div className="flex flex-wrap items-center gap-2">
						{calibrationRecording ? (
							<Button size="sm" variant="destructive" onClick={onCalibrationStop}>
								Stop Recording
							</Button>
						) : (
							<Button
								size="sm"
								variant="outline"
								onClick={handleStartRecording}
								disabled={isBusy}
							>
								{canContinue ? "Re-record Calibration" : "Record Calibration"}
							</Button>
						)}

						<span className="text-xs text-muted-foreground">
							{calibrationStatus === "ready" && "Calibration ready"}
							{calibrationStatus === "missing" &&
								"Calibration missing — record now or skip"}
							{calibrationStatus === "loading" && "Loading calibration…"}
							{calibrationStatus === "saving" && "Saving calibration…"}
							{calibrationStatus === "error" && "Calibration failed"}
						</span>
					</div>

					{calibrationAudioUrl && (
						<div className="rounded-lg border px-4 py-3">
							<p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
								Playback
							</p>
							<audio controls src={calibrationAudioUrl} className="w-full" />
						</div>
					)}

					{calibrationError && (
						<p className="text-xs text-destructive">{calibrationError}</p>
					)}

					<Dialog
						open={showOverwriteDialog}
						onOpenChange={setShowOverwriteDialog}
					>
						<DialogContent>
							<DialogHeader>
								<DialogTitle>Replace calibration clip?</DialogTitle>
								<DialogDescription>
									Recording a new clip will overwrite the existing calibration
									audio. Continue?
								</DialogDescription>
							</DialogHeader>
							<DialogFooter>
								<Button
									variant="outline"
									onClick={() => setShowOverwriteDialog(false)}
								>
									Cancel
								</Button>
								<Button variant="destructive" onClick={confirmOverwrite}>
									Record New Clip
								</Button>
							</DialogFooter>
						</DialogContent>
					</Dialog>
				</CardContent>
				<CardFooter className="flex items-center justify-end gap-2 border-t px-6 py-5">
					{showSkip && (
						<Button variant="outline" onClick={onSkip}>
							Skip for now
						</Button>
					)}
					<Button onClick={onContinue} disabled={!canContinue}>
						Continue to Recording
					</Button>
				</CardFooter>
			</Card>
		</>
	);
}

/* ---------- Recording Step ---------- */

function RecordingStep({
	patient,
	mode,
	elapsed,
	formatTime,
	onStop,
	transcript,
	interventionState,
	onEndIntervention,
	agentSpeaking,
}: {
	patient: PatientOption;
	mode: string;
	elapsed: number;
	formatTime: (s: number) => string;
	onStop: () => void;
	transcript: string;
	interventionState?: InterventionState;
	onEndIntervention?: () => void;
	agentSpeaking?: boolean;
}) {
	return (
		<>
			{/* ── Intervention status banner ──────────────────────────────────── */}
			{interventionState === "trigger_pending" && (
				<div className="flex items-center justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 dark:border-amber-800 dark:bg-amber-950/40">
					<div className="flex items-center gap-2">
						<span className="relative flex size-2.5">
							<span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
							<span className="relative inline-flex size-2.5 rounded-full bg-amber-500" />
						</span>
						<p className="text-sm font-medium text-amber-800 dark:text-amber-200">
							Intervention pending — activating in 10 seconds…
						</p>
					</div>
					<Button size="sm" variant="outline" className="border-amber-400 text-amber-700" onClick={onEndIntervention}>
						Cancel
					</Button>
				</div>
			)}

			{interventionState === "active" && (
				<div className="flex items-center justify-between gap-3 rounded-lg border border-emerald-400 bg-emerald-50 px-4 py-3 dark:border-emerald-700 dark:bg-emerald-950/40">
					<div className="flex items-center gap-2">
						<span className="relative flex size-2.5">
							<span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
							<span className="relative inline-flex size-2.5 rounded-full bg-emerald-500" />
						</span>
						<p className="text-sm font-medium text-emerald-800 dark:text-emerald-200">
							{agentSpeaking ? "Agent is speaking…" : "Intervention Active — listening"}
						</p>
					</div>
					<Button size="sm" variant="destructive" onClick={onEndIntervention}>
						End Intervention
					</Button>
				</div>
			)}

			{interventionState === "cooldown" && (
				<div className="flex items-center gap-2 rounded-lg border border-muted bg-muted/40 px-4 py-3">
					<span className="size-2 rounded-full bg-muted-foreground/40" />
					<p className="text-xs text-muted-foreground">Intervention cooldown active</p>
				</div>
			)}

			<Card>
				<CardContent className="flex flex-col items-center gap-6 py-10">
					{/* Header */}
					<div className="text-center">
						<h2 className="text-lg font-semibold">Recording Session</h2>
						<p className="text-sm text-muted-foreground mt-1">
							{patient.firstName} {patient.lastName} &middot;{" "}
							<Badge variant="secondary" className="text-[10px]">
								{mode}
							</Badge>
						</p>
					</div>

					{/* Pulsing indicator + timer */}
					<div className="flex flex-col items-center gap-3">
						<div className="relative flex size-16 items-center justify-center">
							<span className="absolute inset-0 animate-ping rounded-full bg-red-400/30" />
							<span className="relative flex size-12 items-center justify-center rounded-full bg-red-500 text-white">
								<HugeiconsIcon icon={Mic01Icon} size={24} />
							</span>
						</div>
						<span className="font-mono text-2xl tabular-nums tracking-wider">
							{formatTime(elapsed)}
						</span>
					</div>

					{/* Waveform */}
					<div className="w-full max-w-lg">
						<MicrophoneWaveform
							active
							height={80}
							barColor="hsl(var(--primary))"
							barWidth={3}
							barGap={2}
							barRadius={2}
							sensitivity={1.4}
						/>
					</div>

					<p className="text-xs text-muted-foreground max-w-sm text-center">
						Recording ambient audio. Speak naturally — the transcription engine
						handles speaker diarization automatically.
					</p>

					{transcript && (
						<div className="w-full max-w-lg rounded-lg border bg-muted/30 px-4 py-3 text-sm leading-relaxed">
							<p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
								Live Transcript
							</p>
							<p className="whitespace-pre-wrap">{transcript}</p>
						</div>
					)}

					{/* Stop button */}
					<Button
						size="lg"
						variant="destructive"
						className="rounded-full min-w-40"
						onClick={onStop}
					>
						<HugeiconsIcon icon={StopIcon} data-icon="inline-start" />
						Stop Recording
					</Button>
				</CardContent>
			</Card>
		</>
	);
}

/* ---------- Processing Step ---------- */

function ProcessingStep({
	patient,
	error,
}: {
	patient: PatientOption;
	error: string | null;
}) {
	return (
		<Card>
			<CardContent className="flex flex-col items-center gap-6 py-16">
				{error ? (
					<>
						<div className="flex size-14 items-center justify-center rounded-full bg-destructive/10">
							<HugeiconsIcon
								icon={Alert02Icon}
								size={28}
								className="text-destructive"
							/>
						</div>
						<div className="text-center">
							<h2 className="text-lg font-semibold">Transcription Failed</h2>
							<p className="text-sm text-muted-foreground mt-1 max-w-sm">
								{error}
							</p>
						</div>
					</>
				) : (
					<>
						<div className="flex size-14 items-center justify-center rounded-full bg-primary/10">
							<HugeiconsIcon
								icon={Loading03Icon}
								size={28}
								className="text-primary animate-spin"
							/>
						</div>
						<div className="text-center">
							<h2 className="text-lg font-semibold">Transcribing&hellip;</h2>
							<p className="text-sm text-muted-foreground mt-1">
								Processing audio for {patient.firstName} {patient.lastName} with
								Deepgram Nova-3.
							</p>
						</div>
					</>
				)}
			</CardContent>
		</Card>
	);
}

/* ---------- Review Step ---------- */

function ReviewStep({
	patient,
	mode,
	elapsed,
	formatTime,
	transcript,
	onTranscriptChange,
	onSave,
	saving,
	error,
	onRestart,
}: {
	patient: PatientOption;
	mode: string;
	elapsed: number;
	formatTime: (s: number) => string;
	transcript: string;
	onTranscriptChange: (t: string) => void;
	onSave: () => void;
	saving: boolean;
	error: string | null;
	onRestart: () => void;
}) {
	const canSave = transcript.trim().length > 0 && !saving;

	return (
		<>
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-xl font-semibold tracking-tight">
						Review Transcript
					</h1>
					<p className="text-sm text-muted-foreground mt-1">
						{patient.firstName} {patient.lastName} &middot; {mode} &middot;{" "}
						{formatTime(elapsed)}
					</p>
				</div>
				<div className="flex gap-2"></div>
			</div>

			{error && (
				<div className="flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
					<HugeiconsIcon icon={Alert02Icon} size={16} />
					{error}
				</div>
			)}

			<Card>
				<CardContent className="space-y-4 pt-6">
					<div className="space-y-2">
						<Label htmlFor="transcript">Transcript</Label>
						<Textarea
							id="transcript"
							value={transcript}
							onChange={(e) => onTranscriptChange(e.target.value)}
							rows={12}
							placeholder="Transcript will appear here after processing..."
							className="font-mono text-sm leading-relaxed"
						/>
						<p className="text-xs text-muted-foreground">
							You can edit the transcript before saving if corrections are
							needed.
						</p>
					</div>

					<div className="flex justify-end gap-3 pt-2">
						<Button
							size="lg"
							className="rounded-full shadow-sm shadow-primary/25"
							disabled={!canSave}
							onClick={onSave}
						>
							{saving ? (
								<>
									<HugeiconsIcon
										icon={Loading03Icon}
										data-icon="inline-start"
										className="animate-spin"
									/>
									Saving&hellip;
								</>
							) : (
								<>
									<HugeiconsIcon
										icon={CheckmarkCircle01Icon}
										data-icon="inline-start"
									/>
									Save Session
								</>
							)}
						</Button>
					</div>
				</CardContent>
			</Card>
		</>
	);
}
