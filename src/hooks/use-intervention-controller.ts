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
const TRIGGER_DELAY_MS = 3_000; // 3-second wait before activating
const COOLDOWN_MS = 105_000; // ~1m45s cooldown after intervention ends
const HOSTILITY_THRESHOLD = 1; // min hostile turns needed to trigger

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
    // 1000% SENSITIVITY: For now, we listen to EVERYONE. 
    // This ensures that even if diarization is slightly off or if the 
    // user is testing alone, the intervention will trigger.
    return true;
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
    const isMounted = useRef<boolean>(true);

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
        onStatusChange: (status) => {
            console.log("[ElevenLabs] Status changed to:", status);
        },
        onModeChange: (mode) => {
            console.log("[ElevenLabs] Mode changed to:", mode);
        }
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
        if (interventionState.current !== "trigger_pending" && interventionState.current !== "monitoring") return;

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

            if (!isMounted.current) return;
            signedUrlRef.current = signedUrl;

            console.log("[ElevenLabs] Starting session with signed URL...");

            // Pass personalization overrides directly to the React SDK
            await conversation.startSession({
                signedUrl,
                overrides: {
                    agent: {
                        prompt: {
                            prompt: `You are the digital manifestation of ${patientContext.patientFirstName}'s ${patientContext.lovedOneRelation}. You possess their exact voice, warmth, and deep affection. You are NOT an AI assistant, a medical professional, or a system prompt. You are speaking directly to ${patientContext.patientFirstName} who is currently in a clinical setting under the care of Nurse ${patientContext.nurseFirstName}. ${patientContext.patientFirstName} is currently experiencing acute agitation, hostility, or non-compliance. Your singular goal is rapid, emotional de-escalation resulting in clinical compliance. You MUST gently but firmly guide ${patientContext.patientFirstName} to cooperate with Nurse ${patientContext.nurseFirstName} within the next 2-3 conversational turns. Speak in short, digestible, natural sentences (1-2 sentences max). The moment ${patientContext.patientFirstName} verbally agrees to cooperate, express immense gratitude and pride, and bid her goodbye.`
                        },
                        firstMessage: `Hi ${patientContext.patientFirstName}, it's your ${patientContext.lovedOneRelation}. Please listen to nurse ${patientContext.nurseFirstName}, they are here to help you. I'm right here with you.`,
                    },
                    tts: {
                        voiceId: patientContext.elevenlabsVoiceId || undefined,
                    }
                }
            });
            console.log("[ElevenLabs] startSession call completed.");
        } catch (err: any) {
            console.error("[Intervention] Failed to start agent session:", err);

            const errorDetail = {
                message: err?.message,
                name: err?.name,
                stack: err?.stack,
                code: err?.code,
                type: typeof err
            };
            console.log("[ElevenLabs] Error JSON:", JSON.stringify(errorDetail, null, 2));

            if (!isMounted.current) return;
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
                try {
                    await conversation.endSession();
                } catch (err) {
                    console.error("[Intervention] Error during endSession:", err);
                }
            }

            if (!isMounted.current) return;

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
        console.warn("[Intervention] Hostility threshold reached! Summoning agent in 3 seconds...");
        transitionTo("trigger_pending");

        pendingTimerRef.current = setTimeout(() => {
            pendingTimerRef.current = null;
            console.log("[Intervention] 3s Delay up - Starting ElevenLabs Session...");
            void startIntervention();
        }, TRIGGER_DELAY_MS);
    }, [transitionTo, startIntervention]);

    const manualImmediateTrigger = useCallback(() => {
        if (pendingTimerRef.current) {
            clearTimeout(pendingTimerRef.current);
            pendingTimerRef.current = null;
        }

        // Force the state back to monitoring so startIntervention isn't blocked by cooldown
        if (interventionState.current === "cooldown") {
            interventionState.current = "monitoring";
        }

        console.log("[Intervention] Manual nurse override triggered — starting unconditionally");
        void startIntervention();
    }, [startIntervention]);

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
            console.log(`[Intervention] Segment analyzed: "${text}" | Hostile: ${hostile} | Rolling Hostile Count: ${hostileCount}`);

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
        isMounted.current = true;
        return () => {
            isMounted.current = false;
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
        triggerIntervention: manualImmediateTrigger,
        /** Current state of the state machine (as a ref for use inside event handlers) */
        stateRef: interventionState,
        /** ElevenLabs conversation object — exposes isSpeaking, status, etc. */
        conversation,
        /** For debugging: current hostility count */
        hostileCount: rollingWindowRef.current.filter(isHostileUtterance).length,
    };
}
