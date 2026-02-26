"use client";

import { useRef, useCallback, useEffect } from "react";
import { useConversation } from "@elevenlabs/react";

// ─── Types ───────────────────────────────────────────────────────────────────

export type InterventionState =
    | "monitoring"
    | "trigger_pending"
    | "active"
    | "cooldown";

export interface TranscriptSegment {
    text: string;
    speaker?: string; // "speaker_0" = patient, "speaker_1" = nurse
    timestamp: number;
}

export interface PatientContext {
    patientFirstName: string;
    nurseFirstName: string;
    lovedOneRelation: string;
    elevenlabsVoiceId: string | null;
}

export interface InterventionControllerOptions {
    patientContext: PatientContext | null;
    onStateChange?: (state: InterventionState) => void;
    onInterventionStart?: () => void;
    onInterventionEnd?: () => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ROLLING_WINDOW_SIZE = 5; // number of patient utterances to evaluate
const TRIGGER_DELAY_MS = 10_000; // 10-second wait before activating
const COOLDOWN_MS = 105_000; // ~1m45s cooldown after intervention ends
const HOSTILITY_THRESHOLD = 2; // min hostile turns needed to trigger

// Patterns that signal hostility or strong unwillingness (patient utterances only)
const HOSTILITY_PATTERNS = [
    /\b(no|stop|leave|get out|don't touch|get away|back off|I won't|I refuse|I hate|this is ridiculous|I don't want|leave me alone|stop it|get off|enough|I said no)\b/i,
    /\b(screaming|yelling|angry|furious|upset|agitated|frustrated)\b/i,
];

// Patterns that indicate polite but non-escalating refusals (should be IGNORED)
const POLITE_DEFERRAL_PATTERNS = [
    /\b(maybe later|not right now|in a little while|give me a minute|just a moment|I'm tired)\b/i,
];

// ─── Classifier ──────────────────────────────────────────────────────────────

function isHostileUtterance(text: string): boolean {
    const isPolite = POLITE_DEFERRAL_PATTERNS.some((p) => p.test(text));
    if (isPolite) return false;
    return HOSTILITY_PATTERNS.some((p) => p.test(text));
}

function isPatientSpeaker(speaker?: string): boolean {
    // Deepgram diarizes as speaker_0, speaker_1, etc.
    // When calibration is used, speaker_0 = nurse, speaker_1 = patient.
    // Without calibration, we cannot be certain — evaluate all speakers for robustness.
    return speaker === "speaker_1" || speaker === undefined;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useInterventionController({
    patientContext,
    onStateChange,
    onInterventionStart,
    onInterventionEnd,
}: InterventionControllerOptions) {
    const interventionState = useRef<InterventionState>("monitoring");
    const pendingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const cooldownTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const rollingWindowRef = useRef<string[]>([]);
    const signedUrlRef = useRef<string | null>(null);

    // ElevenLabs Conversational AI hook
    const conversation = useConversation({
        onConnect: () => {
            console.log("[Intervention] Agent connected");
        },
        onDisconnect: () => {
            console.log("[Intervention] Agent disconnected");
            if (
                interventionState.current === "active" ||
                interventionState.current === "trigger_pending"
            ) {
                transitionTo("cooldown");
            }
        },
        onError: (error) => {
            console.error("[Intervention] Agent error:", error);
        },
    });

    // ─── State transitions ─────────────────────────────────────────────────────

    const transitionTo = useCallback(
        (next: InterventionState) => {
            interventionState.current = next;
            onStateChange?.(next);
            console.log("[Intervention] State →", next);
        },
        [onStateChange],
    );

    // ─── Start / End intervention ──────────────────────────────────────────────

    const startIntervention = useCallback(async () => {
        if (!patientContext) return;
        if (interventionState.current !== "trigger_pending") return;

        transitionTo("active");
        onInterventionStart?.();

        try {
            // Fetch a signed URL from the server so we never expose the API key client-side
            const res = await fetch("/api/elevenlabs/conversation-token", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    patientFirstName: patientContext.patientFirstName,
                    nurseFirstName: patientContext.nurseFirstName,
                    lovedOneRelation: patientContext.lovedOneRelation,
                    voiceId: patientContext.elevenlabsVoiceId,
                }),
            });

            if (!res.ok) throw new Error("Failed to get conversation token");
            const { signedUrl } = await res.json();
            signedUrlRef.current = signedUrl;

            await conversation.startSession({ signedUrl });
        } catch (err) {
            console.error("[Intervention] Failed to start agent session:", err);
            // On failure, go straight to cooldown so we don't get stuck
            transitionTo("cooldown");
            scheduleCooldownEnd();
        }
    }, [patientContext, conversation, transitionTo, onInterventionStart]); // eslint-disable-line react-hooks/exhaustive-deps

    const endIntervention = useCallback(
        async (reason: "nurse_override" | "patient_complied" | "error" = "nurse_override") => {
            if (pendingTimerRef.current) {
                clearTimeout(pendingTimerRef.current);
                pendingTimerRef.current = null;
            }

            console.log("[Intervention] Ending —", reason);

            if (conversation.status === "connected") {
                await conversation.endSession();
            }

            onInterventionEnd?.();
            transitionTo("cooldown");
            scheduleCooldownEnd();
        },
        [conversation, transitionTo, onInterventionEnd],
    );

    // ─── Cooldown management ───────────────────────────────────────────────────

    const scheduleCooldownEnd = useCallback(() => {
        if (cooldownTimerRef.current) clearTimeout(cooldownTimerRef.current);
        cooldownTimerRef.current = setTimeout(() => {
            transitionTo("monitoring");
        }, COOLDOWN_MS);
    }, [transitionTo]);

    // ─── Trigger pending ───────────────────────────────────────────────────────

    const scheduleTrigger = useCallback(() => {
        if (pendingTimerRef.current) return; // already pending
        transitionTo("trigger_pending");

        pendingTimerRef.current = setTimeout(() => {
            pendingTimerRef.current = null;
            void startIntervention();
        }, TRIGGER_DELAY_MS);
    }, [transitionTo, startIntervention]);

    const cancelPendingTrigger = useCallback(() => {
        if (pendingTimerRef.current) {
            clearTimeout(pendingTimerRef.current);
            pendingTimerRef.current = null;
            transitionTo("monitoring");
            console.log("[Intervention] Trigger cancelled (de-escalation detected)");
        }
    }, [transitionTo]);

    // ─── Main classifier — called on each new transcript segment ──────────────

    const processSegment = useCallback(
        (segment: TranscriptSegment) => {
            const state = interventionState.current;

            // Only analyse patient utterances
            if (!isPatientSpeaker(segment.speaker)) {
                return;
            }

            const text = segment.text.trim();
            if (!text) return;

            const hostile = isHostileUtterance(text);

            // Maintain rolling window (patient utterances only)
            rollingWindowRef.current.push(text);
            if (rollingWindowRef.current.length > ROLLING_WINDOW_SIZE) {
                rollingWindowRef.current.shift();
            }

            const hostileCount = rollingWindowRef.current.filter(isHostileUtterance).length;

            // State-specific logic
            if (state === "monitoring") {
                if (hostileCount >= HOSTILITY_THRESHOLD) {
                    scheduleTrigger();
                }
            } else if (state === "trigger_pending") {
                // If the patient de-escalates before the timer fires, cancel
                if (hostileCount === 0) {
                    cancelPendingTrigger();
                    rollingWindowRef.current = [];
                }
            } else if (state === "active") {
                // Detect patient compliance in real-time
                if (!hostile && /\b(okay|ok|fine|alright|yes|sure|I will|I'll)\b/i.test(text)) {
                    console.log("[Intervention] Compliance detected, ending session");
                    void endIntervention("patient_complied");
                }
            }
            // In cooldown: ignore all segments; timer handles the reset
        },
        [scheduleTrigger, cancelPendingTrigger, endIntervention],
    );

    // ─── Cleanup ───────────────────────────────────────────────────────────────

    useEffect(() => {
        return () => {
            if (pendingTimerRef.current) clearTimeout(pendingTimerRef.current);
            if (cooldownTimerRef.current) clearTimeout(cooldownTimerRef.current);
        };
    }, []);

    return {
        /** Feed each incoming Deepgram transcript segment into the classifier */
        processSegment,
        /** Nurse kill-switch — immediately ends any active or pending intervention */
        endIntervention,
        /** Nurse manual override — immediately starts intervention from monitoring state */
        triggerIntervention: scheduleTrigger,
        /** Current state of the state machine (as a ref for use inside event handlers) */
        stateRef: interventionState,
        /** ElevenLabs conversation object — exposes isSpeaking, status, etc. */
        conversation,
    };
}
