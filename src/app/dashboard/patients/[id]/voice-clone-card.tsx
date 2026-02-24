"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import {
	CheckmarkCircle01Icon,
	Mic01Icon,
	StopIcon,
	VoiceIcon,
} from "@hugeicons/core-free-icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { MicrophoneWaveform } from "@/components/ui/waveform";
import {
	deletePatientVoice,
	updateLovedOneName,
	updatePatientVoice,
} from "../actions";

interface VoiceCloneCardProps {
	patientId: string;
	patientFirstName: string;
	patientLastName: string;
	lovedOneFirstName: string;
	lovedOneLastName: string;
	lovedOneRelation: string;
	voiceId: string | null;
}

export function VoiceCloneCard({
	patientId,
	patientFirstName,
	patientLastName,
	lovedOneFirstName,
	lovedOneLastName,
	lovedOneRelation,
	voiceId,
}: VoiceCloneCardProps) {
	const router = useRouter();
	const [isPending, startTransition] = useTransition();
	const [nameFirst, setNameFirst] = useState(lovedOneFirstName);
	const [nameLast, setNameLast] = useState(lovedOneLastName);
	const [nameError, setNameError] = useState<string | null>(null);
	const [nameSaved, setNameSaved] = useState(false);

	const [recording, setRecording] = useState(false);
	const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
	const [cloning, setCloning] = useState(false);
	const [cloneError, setCloneError] = useState<string | null>(null);
	const [elapsed, setElapsed] = useState(0);
	const [recorderOpen, setRecorderOpen] = useState(false);
	const mediaRecorderRef = useRef<MediaRecorder | null>(null);
	const chunksRef = useRef<Blob[]>([]);
	const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

	const lovedOneName = `${nameFirst} ${nameLast}`.trim();

	useEffect(() => {
		setNameFirst(lovedOneFirstName);
		setNameLast(lovedOneLastName);
	}, [lovedOneFirstName, lovedOneLastName]);

	useEffect(() => {
		return () => {
			if (timerRef.current) clearInterval(timerRef.current);
			if (mediaRecorderRef.current?.state === "recording") {
				mediaRecorderRef.current.stop();
			}
		};
	}, []);

	const startRecording = useCallback(async () => {
		try {
			const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
			const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
			chunksRef.current = [];

			recorder.ondataavailable = (e) => {
				if (e.data.size > 0) chunksRef.current.push(e.data);
			};

			recorder.onstop = () => {
				stream.getTracks().forEach((t) => t.stop());
				const blob = new Blob(chunksRef.current, { type: "audio/webm" });
				setAudioBlob(blob);
			};

			mediaRecorderRef.current = recorder;
			recorder.start(250);
			setRecording(true);
			setAudioBlob(null);
			setCloneError(null);
			setElapsed(0);

			timerRef.current = setInterval(() => {
				setElapsed((prev) => prev + 1);
			}, 1000);
		} catch {
			setCloneError(
				"Microphone access denied. Please allow microphone access and try again.",
			);
		}
	}, []);

	const stopRecording = useCallback(() => {
		mediaRecorderRef.current?.stop();
		setRecording(false);
		if (timerRef.current) {
			clearInterval(timerRef.current);
			timerRef.current = null;
		}
	}, []);

	async function handleCloneVoice() {
		if (!audioBlob) return;

		setCloning(true);
		setCloneError(null);

		try {
			const voiceName = `${nameFirst} for ${patientFirstName}`;
			const file = new File([audioBlob], "voice-sample.webm", {
				type: "audio/webm",
			});

			const formData = new FormData();
			formData.append("name", voiceName);
			formData.append("files", file);

			const res = await fetch("/api/elevenlabs/voices", {
				method: "POST",
				body: formData,
			});

			if (!res.ok) {
				const body = await res.json().catch(() => ({}));
				throw new Error(body.error || "Voice cloning failed");
			}

			const { voiceId: newVoiceId } = await res.json();
			const result = await updatePatientVoice(patientId, newVoiceId);
			if (!result.success) {
				throw new Error(result.error);
			}

			setRecorderOpen(false);
			setAudioBlob(null);
			setElapsed(0);
			router.refresh();
		} catch (err) {
			setCloneError(
				err instanceof Error ? err.message : "Voice cloning failed",
			);
		} finally {
			setCloning(false);
		}
	}

	function formatTime(seconds: number) {
		const m = Math.floor(seconds / 60);
		const s = seconds % 60;
		return `${m}:${s.toString().padStart(2, "0")}`;
	}

	function handleSaveName() {
		setNameError(null);
		setNameSaved(false);
		startTransition(async () => {
			const result = await updateLovedOneName(patientId, nameFirst, nameLast);
			if (!result.success) {
				setNameError(result.error);
				return;
			}
			setNameSaved(true);
			router.refresh();
			setTimeout(() => setNameSaved(false), 2500);
		});
	}

	function handleDeleteVoice() {
		if (!voiceId) return;
		startTransition(async () => {
			const result = await deletePatientVoice(patientId, voiceId);
			if (!result.success) {
				setCloneError(result.error);
				return;
			}
			router.refresh();
		});
	}

	return (
		<div className="flex flex-col gap-4">
			<div className="flex flex-wrap items-center gap-4">
				<div className="flex size-12 items-center justify-center rounded-full bg-primary/10">
					<HugeiconsIcon icon={VoiceIcon} size={22} className="text-primary" />
				</div>
				<div className="flex-1">
					{voiceId ? (
						<div className="flex flex-wrap items-center gap-2">
							<HugeiconsIcon
								icon={CheckmarkCircle01Icon}
								size={16}
								className="text-emerald-600"
							/>
							<span className="text-sm font-medium">Voice clone active</span>
							<Badge variant="secondary" className="text-[10px] font-mono">
								{voiceId.slice(0, 12)}…
							</Badge>
						</div>
					) : (
						<p className="text-sm text-muted-foreground">
							Record a sample of {lovedOneName}&apos;s voice to enable
							voice-based interventions for {patientFirstName}.
						</p>
					)}
				</div>
				{voiceId && (
					<AlertDialog>
						<AlertDialogTrigger asChild>
							<Button variant="destructive" size="sm" className="rounded-full">
								Delete Voice
							</Button>
						</AlertDialogTrigger>
						<AlertDialogContent>
							<AlertDialogHeader>
								<AlertDialogTitle>Delete voice clone?</AlertDialogTitle>
								<AlertDialogDescription>
									This permanently deletes the cloned voice from ElevenLabs. You
									can re-record a new sample later.
								</AlertDialogDescription>
							</AlertDialogHeader>
							<AlertDialogFooter>
								<AlertDialogCancel>Cancel</AlertDialogCancel>
								<AlertDialogAction
									variant="destructive"
									onClick={handleDeleteVoice}
									disabled={isPending}
								>
									{isPending ? "Deleting…" : "Delete voice"}
								</AlertDialogAction>
							</AlertDialogFooter>
						</AlertDialogContent>
					</AlertDialog>
				)}
			</div>

			{!voiceId && (
				<div className="rounded-lg border bg-muted/30 p-4 space-y-4">
					<div className="space-y-3">
						<div className="flex items-center justify-between">
							<p className="text-sm font-medium">Loved one name</p>
							{nameSaved && (
								<span className="text-xs text-emerald-600">Saved</span>
							)}
						</div>
						<div className="grid gap-3 sm:grid-cols-2">
							<div className="space-y-1.5">
								<Label htmlFor="lovedOneFirstName">First name</Label>
								<Input
									id="lovedOneFirstName"
									value={nameFirst}
									onChange={(e) => setNameFirst(e.target.value)}
									placeholder="First name"
								/>
							</div>
							<div className="space-y-1.5">
								<Label htmlFor="lovedOneLastName">Last name</Label>
								<Input
									id="lovedOneLastName"
									value={nameLast}
									onChange={(e) => setNameLast(e.target.value)}
									placeholder="Last name"
								/>
							</div>
						</div>
						{nameError && (
							<p className="text-xs text-destructive">{nameError}</p>
						)}
						<Button
							variant="outline"
							size="sm"
							className="rounded-full"
							onClick={handleSaveName}
							disabled={isPending}
						>
							{isPending ? "Saving…" : "Update name"}
						</Button>
					</div>

					<div className="flex flex-wrap items-center justify-between gap-3">
						<div>
							<p className="text-sm font-medium">Voice sample</p>
							<p className="text-xs text-muted-foreground">
								At least 30 seconds of clear speech works best.
							</p>
						</div>
						<Dialog open={recorderOpen} onOpenChange={setRecorderOpen}>
							<DialogTrigger asChild>
								<Button size="sm" className="rounded-full">
									<HugeiconsIcon icon={Mic01Icon} data-icon="inline-start" />
									Record voice
								</Button>
							</DialogTrigger>
							<DialogContent className="sm:max-w-md">
								<DialogHeader>
									<DialogTitle>Record voice sample</DialogTitle>
									<DialogDescription>
										Record a sample of {lovedOneName}&apos;s voice. A longer
										sample improves quality.
									</DialogDescription>
								</DialogHeader>
								<div className="grid gap-4">
									<div
										className="rounded-xl border bg-muted/30 p-4"
										style={{ minHeight: 112 }}
									>
										{!recording && !audioBlob && (
											<div className="flex h-20 flex-col items-center justify-center gap-2">
												<div className="flex size-10 items-center justify-center rounded-full bg-primary/10">
													<HugeiconsIcon
														icon={Mic01Icon}
														size={20}
														className="text-primary"
													/>
												</div>
												<p className="text-sm text-muted-foreground">
													Press below to start recording
												</p>
											</div>
										)}
										{recording && (
											<MicrophoneWaveform
												active
												height={80}
												barWidth={3}
												barGap={2}
												barRadius={2}
												barColor="oklch(0.55 0.15 175)"
												sensitivity={1.5}
												className="w-full"
											/>
										)}
										{!recording && audioBlob && (
											<div className="flex h-20 flex-col items-center justify-center gap-1">
												<div className="flex items-center gap-2 text-sm">
													<HugeiconsIcon
														icon={CheckmarkCircle01Icon}
														size={18}
														className="text-emerald-600"
													/>
													<span className="font-medium">
														{formatTime(elapsed)} recorded
													</span>
												</div>
												<p className="text-xs text-muted-foreground">
													Ready to clone
												</p>
											</div>
										)}
									</div>

									<div className="flex items-center justify-center gap-3">
										{!recording ? (
											<Button
												type="button"
												variant={audioBlob ? "outline" : "default"}
												className="rounded-full"
												onClick={startRecording}
												disabled={cloning}
											>
												<HugeiconsIcon
													icon={Mic01Icon}
													data-icon="inline-start"
												/>
												{audioBlob ? "Re-record" : "Start Recording"}
											</Button>
										) : (
											<Button
												type="button"
												variant="destructive"
												className="rounded-full"
												onClick={stopRecording}
											>
												<HugeiconsIcon
													icon={StopIcon}
													data-icon="inline-start"
												/>
												Stop · {formatTime(elapsed)}
											</Button>
										)}
									</div>

									{elapsed > 0 && elapsed < 30 && recording && (
										<p className="text-center text-xs text-muted-foreground">
											Keep going — {30 - elapsed}s more for best results
										</p>
									)}

									{cloneError && (
										<p className="text-xs text-destructive">{cloneError}</p>
									)}
								</div>

								<DialogFooter>
									<Button
										type="button"
										variant="ghost"
										onClick={() => setRecorderOpen(false)}
										disabled={cloning}
									>
										Cancel
									</Button>
									<Button
										type="button"
										onClick={handleCloneVoice}
										disabled={!audioBlob || cloning || recording}
									>
										{cloning ? "Cloning voice…" : "Clone voice"}
									</Button>
								</DialogFooter>
							</DialogContent>
						</Dialog>
					</div>
				</div>
			)}
		</div>
	);
}
