"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type CalibrationStatus =
	| "loading"
	| "missing"
	| "ready"
	| "saving"
	| "error";

type UseCalibrationClipState = {
	status: CalibrationStatus;
	recording: boolean;
	error: string | null;
	blob: Blob | null;
	audioUrl: string | null;
	startRecording: () => void;
	stopRecording: () => void;
	refresh: () => Promise<void>;
};

export function useCalibrationClip(): UseCalibrationClipState {
	const [status, setStatus] = useState<CalibrationStatus>("loading");
	const [recording, setRecording] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [blob, setBlob] = useState<Blob | null>(null);
	const [audioUrl, setAudioUrl] = useState<string | null>(null);

	const recorderRef = useRef<MediaRecorder | null>(null);
	const chunksRef = useRef<Blob[]>([]);
	const streamRef = useRef<MediaStream | null>(null);

	const refresh = useCallback(async () => {
		try {
			setStatus("loading");
			const res = await fetch("/api/nurses/calibration");
			if (res.status === 404) {
				setBlob(null);
				setStatus("missing");
				return;
			}
			if (!res.ok) {
				throw new Error("Failed to load calibration clip");
			}
			const buffer = await res.arrayBuffer();
			const mimeType =
				res.headers.get("Content-Type") || "application/octet-stream";
			setBlob(new Blob([buffer], { type: mimeType }));
			setStatus("ready");
		} catch (err) {
			console.error("[Calibration] Failed to load clip:", err);
			setStatus("error");
		}
	}, []);

	useEffect(() => {
		void refresh();
	}, [refresh]);

	useEffect(() => {
		if (!blob) {
			setAudioUrl(null);
			return;
		}
		const url = URL.createObjectURL(blob);
		setAudioUrl(url);
		return () => {
			URL.revokeObjectURL(url);
		};
	}, [blob]);

	const startRecording = useCallback(() => {
		if (recording) return;
		(async () => {
			try {
				setError(null);
				const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
				streamRef.current = stream;
				const preferredMimeType = MediaRecorder.isTypeSupported(
					"audio/webm;codecs=opus",
				)
					? "audio/webm;codecs=opus"
					: "audio/webm";
				const recorder = new MediaRecorder(stream, {
					mimeType: preferredMimeType,
				});
				chunksRef.current = [];

				recorder.ondataavailable = (e) => {
					if (e.data.size > 0) chunksRef.current.push(e.data);
				};

				recorder.onstop = async () => {
					stream.getTracks().forEach((t) => t.stop());
					streamRef.current = null;
					const recordedBlob = new Blob(chunksRef.current, {
						type: recorder.mimeType || "audio/webm",
					});
					setRecording(false);
					setStatus("saving");
					try {
						const formData = new FormData();
						const file = new File([recordedBlob], "calibration.webm", {
							type: recordedBlob.type || "audio/webm",
						});
						formData.append("audio", file);
						const res = await fetch("/api/nurses/calibration", {
							method: "POST",
							body: formData,
						});
						if (!res.ok) {
							const body = await res.json().catch(() => ({}));
							throw new Error(body.error || "Failed to save calibration clip");
						}
						setBlob(recordedBlob);
						setStatus("ready");
					} catch (err) {
						console.error("[Calibration] Upload failed:", err);
						setStatus("error");
						setError(
							err instanceof Error
								? err.message
								: "Failed to save calibration clip",
						);
					}
				};

				recorderRef.current = recorder;
				recorder.start(250);
				setRecording(true);
			} catch (err) {
				console.error("[Calibration] Failed to start:", err);
				setError(
					err instanceof Error
						? err.message
						: "Unable to start calibration recording",
				);
				setStatus("error");
			}
		})().catch(() => {});
	}, [recording]);

	const stopRecording = useCallback(() => {
		recorderRef.current?.stop();
	}, []);

	useEffect(() => {
		return () => {
			if (recorderRef.current?.state === "recording") {
				recorderRef.current.stop();
			}
			if (streamRef.current) {
				streamRef.current.getTracks().forEach((track) => track.stop());
				streamRef.current = null;
			}
		};
	}, []);

	return {
		status,
		recording,
		error,
		blob,
		audioUrl,
		startRecording,
		stopRecording,
		refresh,
	};
}
