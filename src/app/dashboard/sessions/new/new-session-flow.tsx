"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
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
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Combobox,
  ComboboxInput,
  ComboboxContent,
  ComboboxList,
  ComboboxItem,
  ComboboxEmpty,
} from "@/components/ui/combobox";
import { MicrophoneWaveform } from "@/components/ui/waveform";
import { type PatientOption } from "../actions";
import { saveSession } from "../actions";

type Step = "setup" | "recording" | "processing" | "review";

interface Props {
  patients: PatientOption[];
  defaultPatientId?: string;
}

export function NewSessionFlow({ patients, defaultPatientId }: Props) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("setup");
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(
    defaultPatientId ?? null,
  );
  const [mode, setMode] = useState<"Routine" | "Intervention">("Routine");
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Recording state
  const [elapsed, setElapsed] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);

  const selectedPatient = patients.find((p) => p.id === selectedPatientId);

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
      setError(null);
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
      setElapsed(0);
      setStep("recording");

      timerRef.current = setInterval(() => {
        setElapsed((prev) => prev + 1);
      }, 1000);
    } catch {
      setError(
        "Microphone access denied. Please allow microphone access and try again.",
      );
    }
  }, []);

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop();
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setStep("processing");
  }, []);

  useEffect(() => {
    if (step !== "processing" || !audioBlob) return;

    let cancelled = false;

    async function transcribe() {
      setError(null);
      try {
        const formData = new FormData();
        const file = new File([audioBlob!], "session.webm", {
          type: "audio/webm",
        });
        formData.append("audio", file);

        const res = await fetch("/api/elevenlabs/stt", {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || "Transcription failed");
        }

        const result = await res.json();
        if (!cancelled) {
          setTranscript(result.text || "");
          setStep("review");
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Transcription failed",
          );
          setStep("review");
        }
      }
    }

    transcribe();
    return () => {
      cancelled = true;
    };
  }, [step, audioBlob]);

  async function handleSave() {
    if (!selectedPatientId || !transcript.trim()) return;

    setSaving(true);
    setError(null);

    try {
      const result = await saveSession(selectedPatientId, mode, transcript);
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
          onStart={startRecording}
          error={error}
          selectedPatient={selectedPatient}
        />
      )}

      {step === "recording" && (
        <RecordingStep
          patient={selectedPatient!}
          mode={mode}
          elapsed={elapsed}
          formatTime={formatTime}
          onStop={stopRecording}
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
  error,
  selectedPatient,
}: {
  patients: PatientOption[];
  selectedPatientId: string | null;
  onPatientChange: (id: string | null) => void;
  mode: "Routine" | "Intervention";
  onModeChange: (m: "Routine" | "Intervention") => void;
  onStart: () => void;
  error: string | null;
  selectedPatient?: PatientOption;
}) {
  const canStart = !!selectedPatientId && mode === "Routine";

  return (
    <>
      <div>
        <h1 className="text-xl font-semibold tracking-tight">New Session</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Select a patient and session type, then start recording.
        </p>
      </div>

      <Card>
        <CardContent className="space-y-6 pt-6">
          {/* Patient selector */}
          <div className="space-y-2">
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
                  href="/dashboard/patients"
                  className="text-primary underline"
                >
                  Add a patient first.
                </Link>
              </p>
            )}
          </div>

          {/* Mode selector */}
          <div className="space-y-2">
            <Label>Session Type</Label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => onModeChange("Routine")}
                className={`relative flex flex-col items-center gap-2 rounded-xl border-2 p-5 text-center transition-colors ${
                  mode === "Routine"
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-muted-foreground/30"
                }`}
              >
                <div
                  className={`flex size-10 items-center justify-center rounded-full ${
                    mode === "Routine"
                      ? "bg-primary/10 text-primary"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  <HugeiconsIcon icon={Stethoscope02Icon} size={20} />
                </div>
                <span className="text-sm font-medium">Routine</span>
                <span className="text-xs text-muted-foreground">
                  Ambient scribe for daily care
                </span>
              </button>

              <button
                type="button"
                onClick={() => onModeChange("Intervention")}
                className={`relative flex flex-col items-center gap-2 rounded-xl border-2 p-5 text-center transition-colors ${
                  mode === "Intervention"
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
                  className={`flex size-10 items-center justify-center rounded-full ${
                    mode === "Intervention"
                      ? "bg-primary/10 text-primary"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  <HugeiconsIcon icon={HeadphonesIcon} size={20} />
                </div>
                <span className="text-sm font-medium">Intervention</span>
                <span className="text-xs text-muted-foreground">
                  Crisis de-escalation with voice
                </span>
                {selectedPatient && !selectedPatient.hasVoice && mode === "Intervention" && (
                  <span className="text-[10px] text-amber-600 mt-1">
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

          {/* Start button */}
          <Button
            size="lg"
            className="w-full rounded-full shadow-sm shadow-primary/25"
            disabled={!canStart}
            onClick={onStart}
          >
            <HugeiconsIcon icon={Mic01Icon} data-icon="inline-start" />
            Start Recording
          </Button>
        </CardContent>
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
}: {
  patient: PatientOption;
  mode: string;
  elapsed: number;
  formatTime: (s: number) => string;
  onStop: () => void;
}) {
  return (
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
                ElevenLabs Scribe v2.
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
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="rounded-full"
            onClick={onRestart}
            disabled={saving}
          >
            Re-record
          </Button>
        </div>
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
