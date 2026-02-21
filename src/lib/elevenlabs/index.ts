export { elevenlabs } from "./client";
export { streamSpeech, synthesizeSpeech } from "./tts";
export type { TtsStreamOptions } from "./tts";
export { transcribeAudio } from "./stt";
export type { TranscribeOptions, TranscribeResult, TranscriptSegment } from "./stt";
export { cloneVoice, listClonedVoices, deleteVoice } from "./voice-cloning";
export type { CloneVoiceOptions, ClonedVoice, VoiceSummary } from "./voice-cloning";
