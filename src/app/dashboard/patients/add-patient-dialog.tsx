"use client";

import { useRef, useEffect, useState, useTransition, useCallback } from "react";
import { addPatient, updatePatientVoice } from "./actions";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { MicrophoneWaveform } from "@/components/ui/waveform";
import { Badge } from "@/components/ui/badge";
import { HugeiconsIcon } from "@hugeicons/react";
import {
	Mic01Icon,
	StopIcon,
	ArrowRight01Icon,
	CheckmarkCircle01Icon,
	Alert02Icon,
} from "@hugeicons/core-free-icons";

const RELATIONS = [
	"Spouse",
	"Son",
	"Daughter",
	"Sibling",
	"Friend",
	"Other",
] as const;

type Step = "details" | "voice";

interface PatientInfo {
	patientFirstName: string;
	patientLastName: string;
	lovedOneFirstName: string;
	lovedOneLastName: string;
	lovedOneRelation: string;
}

export function AddPatientDialog({ children }: { children: React.ReactNode }) {
	const [open, setOpen] = useState(false);
	const [step, setStep] = useState<Step>("details");
	const [patientId, setPatientId] = useState<string | null>(null);
	const [patientInfo, setPatientInfo] = useState<PatientInfo | null>(null);
	const [isPending, startTransition] = useTransition();
	const [error, setError] = useState<string | null>(null);
	const formRef = useRef<HTMLFormElement>(null);

	function resetState() {
		setStep("details");
		setPatientId(null);
		setPatientInfo(null);
		setError(null);
		formRef.current?.reset();
	}

	useEffect(() => {
		if (!open) {
			setTimeout(() => {
				resetState();
			}, 0);
		}
	}, [open]);

	function handleDetailsSubmit(formData: FormData) {
		setError(null);
		startTransition(async () => {
			const result = await addPatient(formData);
			if (result.success) {
				setPatientId(result.patientId);
				setPatientInfo({
					patientFirstName: formData.get("patientFirstName")?.toString() ?? "",
					patientLastName: formData.get("patientLastName")?.toString() ?? "",
					lovedOneFirstName:
						formData.get("lovedOneFirstName")?.toString() ?? "",
					lovedOneLastName: formData.get("lovedOneLastName")?.toString() ?? "",
					lovedOneRelation: formData.get("lovedOneRelation")?.toString() ?? "",
				});
				setStep("voice");
			} else {
				setError(result.error);
			}
		});
	}

	function handleDone() {
		setOpen(false);
	}

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>{children}</DialogTrigger>
			<DialogContent
				className="sm:max-w-lg"
				showCloseButton={step === "details"}
			>
				{step === "details" ? (
					<DetailsStep
						formRef={formRef}
						onSubmit={handleDetailsSubmit}
						isPending={isPending}
						error={error}
					/>
				) : (
					<VoiceStep
						patientId={patientId!}
						patientInfo={patientInfo!}
						onDone={handleDone}
						onBack={() => {}}
					/>
				)}
			</DialogContent>
		</Dialog>
	);
}

function DetailsStep({
	formRef,
	onSubmit,
	isPending,
	error,
}: {
	formRef: React.RefObject<HTMLFormElement | null>;
	onSubmit: (formData: FormData) => void;
	isPending: boolean;
	error: string | null;
}) {
	return (
		<>
			<DialogHeader>
				<div className="flex items-center gap-2">
					<DialogTitle>Add Patient</DialogTitle>
					<Badge variant="secondary" className="text-[10px] font-normal">
						Step 1 of 2
					</Badge>
				</div>
				<DialogDescription>
					Enter the patient and their loved one&apos;s details. You&apos;ll be
					able to record a voice sample next.
				</DialogDescription>
			</DialogHeader>

			<form ref={formRef} action={onSubmit} className="grid gap-5">
				<div className="grid gap-3">
					<p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
						Patient
					</p>
					<div className="grid grid-cols-2 gap-3">
						<div className="grid gap-1.5">
							<Label htmlFor="patientFirstName">First name</Label>
							<Input
								id="patientFirstName"
								name="patientFirstName"
								placeholder="e.g. Margaret"
								required
								autoFocus
							/>
						</div>
						<div className="grid gap-1.5">
							<Label htmlFor="patientLastName">Last name</Label>
							<Input
								id="patientLastName"
								name="patientLastName"
								placeholder="e.g. Johnson"
								required
							/>
						</div>
					</div>
				</div>

				<div className="grid gap-3">
					<p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
						Loved One
					</p>
					<div className="grid grid-cols-2 gap-3">
						<div className="grid gap-1.5">
							<Label htmlFor="lovedOneFirstName">First name</Label>
							<Input
								id="lovedOneFirstName"
								name="lovedOneFirstName"
								placeholder="e.g. Robert"
								required
							/>
						</div>
						<div className="grid gap-1.5">
							<Label htmlFor="lovedOneLastName">Last name</Label>
							<Input
								id="lovedOneLastName"
								name="lovedOneLastName"
								placeholder="e.g. Johnson"
								required
							/>
						</div>
					</div>
					<div className="grid gap-1.5">
						<Label htmlFor="lovedOneRelation">Relation to patient</Label>
						<Select name="lovedOneRelation" required>
							<SelectTrigger className="w-full">
								<SelectValue placeholder="Select relation" />
							</SelectTrigger>
							<SelectContent>
								{RELATIONS.map((r) => (
									<SelectItem key={r} value={r}>
										{r}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
				</div>

				{error && (
					<div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
						<HugeiconsIcon icon={Alert02Icon} size={16} />
						{error}
					</div>
				)}

				<DialogFooter>
					<Button type="submit" disabled={isPending}>
						{isPending ? "Saving…" : "Next: Voice Sample"}
						{!isPending && (
							<HugeiconsIcon icon={ArrowRight01Icon} data-icon="inline-end" />
						)}
					</Button>
				</DialogFooter>
			</form>
		</>
	);
}

function VoiceStep({
	patientId,
	patientInfo,
	onDone,
}: {
	patientId: string;
	patientInfo: PatientInfo;
	onDone: () => void;
	onBack: () => void;
}) {
	const [recording, setRecording] = useState(false);
	const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
	const [cloning, setCloning] = useState(false);
	const [cloneSuccess, setCloneSuccess] = useState(false);
	const [cloneError, setCloneError] = useState<string | null>(null);
	const [elapsed, setElapsed] = useState(0);
	const mediaRecorderRef = useRef<MediaRecorder | null>(null);
	const chunksRef = useRef<Blob[]>([]);
	const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

	const lovedOneName = `${patientInfo.lovedOneFirstName} ${patientInfo.lovedOneLastName}`;

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

	useEffect(() => {
		return () => {
			if (timerRef.current) clearInterval(timerRef.current);
			if (mediaRecorderRef.current?.state === "recording") {
				mediaRecorderRef.current.stop();
			}
		};
	}, []);

	async function handleCloneVoice() {
		if (!audioBlob) return;

		setCloning(true);
		setCloneError(null);

		try {
			const voiceName = `${patientInfo.lovedOneFirstName} for ${patientInfo.patientFirstName}`;
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

			const { voiceId } = await res.json();

			const result = await updatePatientVoice(patientId, voiceId);
			if (!result.success) {
				throw new Error(result.error);
			}

			setCloneSuccess(true);
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

	if (cloneSuccess) {
		return (
			<>
				<div className="flex flex-col items-center py-8 text-center">
					<div className="flex size-14 items-center justify-center rounded-full bg-emerald-100 mb-4">
						<HugeiconsIcon
							icon={CheckmarkCircle01Icon}
							size={28}
							className="text-emerald-600"
						/>
					</div>
					<h3 className="text-lg font-semibold">Patient Added</h3>
					<p className="mt-1.5 max-w-xs text-sm text-muted-foreground">
						<span className="font-medium text-foreground">
							{patientInfo.patientFirstName} {patientInfo.patientLastName}
						</span>{" "}
						has been added with a cloned voice for{" "}
						<span className="font-medium text-foreground">{lovedOneName}</span>.
					</p>
				</div>
				<DialogFooter>
					<Button onClick={onDone}>Done</Button>
				</DialogFooter>
			</>
		);
	}

	return (
		<>
			<DialogHeader>
				<div className="flex items-center gap-2">
					<DialogTitle>Voice Sample</DialogTitle>
					<Badge variant="secondary" className="text-[10px] font-normal">
						Step 2 of 2
					</Badge>
				</div>
				<DialogDescription>
					Record a sample of{" "}
					<span className="font-medium text-foreground">{lovedOneName}</span>
					&apos;s voice. At least 30 seconds of clear speech works best. This
					step is optional — you can add a voice later.
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
							<p className="text-xs text-muted-foreground">Ready to clone</p>
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
							<HugeiconsIcon icon={Mic01Icon} data-icon="inline-start" />
							{audioBlob ? "Re-record" : "Start Recording"}
						</Button>
					) : (
						<Button
							type="button"
							variant="destructive"
							className="rounded-full"
							onClick={stopRecording}
						>
							<HugeiconsIcon icon={StopIcon} data-icon="inline-start" />
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
					<div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
						<HugeiconsIcon icon={Alert02Icon} size={16} className="shrink-0" />
						{cloneError}
					</div>
				)}
			</div>

			<DialogFooter>
				<Button
					type="button"
					variant="ghost"
					onClick={onDone}
					disabled={cloning}
				>
					Skip for now
				</Button>
				<Button
					type="button"
					onClick={handleCloneVoice}
					disabled={!audioBlob || cloning || recording}
				>
					{cloning ? "Cloning voice…" : "Clone Voice & Finish"}
				</Button>
			</DialogFooter>
		</>
	);
}
