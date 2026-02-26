"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type CalibrationStatus =
	| "loading"
	| "missing"
	| "ready"
	| "saving"
	| "error";

const LOCAL_STORAGE_KEY = "carescript.calibration-clip.v1";

const blobToDataUrl = (blob: Blob) =>
	new Promise<string>((resolve, reject) => {
		const reader = new FileReader();
		reader.onloadend = () => resolve(reader.result as string);
		reader.onerror = () => reject(reader.error);
		reader.readAsDataURL(blob);
	});

const dataUrlToBlob = (dataUrl: string) => {
	const [header, base64Data] = dataUrl.split(",");
	const mimeMatch = header?.match(/data:(.*?);base64/);
	const mimeType = mimeMatch?.[1] ?? "audio/webm";
	const binary = atob(base64Data || "");
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i += 1) {
		bytes[i] = binary.charCodeAt(i);
	}
	return new Blob([bytes], { type: mimeType });
};

const loadLocalClip = () => {
	if (typeof window === "undefined") return null;
	const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY);
	if (!raw) return null;
	try {
		const parsed = JSON.parse(raw) as { dataUrl?: string };
		if (!parsed.dataUrl) return null;
		return {
			dataUrl: parsed.dataUrl,
			blob: dataUrlToBlob(parsed.dataUrl),
		};
	} catch {
		return null;
	}
};

const saveLocalClip = async (blob: Blob) => {
	if (typeof window === "undefined") return;
	try {
		const dataUrl = await blobToDataUrl(blob);
		window.localStorage.setItem(
			LOCAL_STORAGE_KEY,
			JSON.stringify({ dataUrl, updatedAt: Date.now() }),
		);
		return dataUrl;
	} catch (err) {
		console.warn("[Calibration] Failed to persist clip locally:", err);
	}
	return undefined;
};

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
	const [localDataUrl, setLocalDataUrl] = useState<string | null>(null);

	const recorderRef = useRef<MediaRecorder | null>(null);
	const chunksRef = useRef<Blob[]>([]);
	const streamRef = useRef<MediaStream | null>(null);

	const refresh = useCallback(async () => {
		setError(null);
		const cachedClip = loadLocalClip();
		if (cachedClip) {
			setBlob(cachedClip.blob);
			setLocalDataUrl(cachedClip.dataUrl);
			setStatus("ready");
			return;
		}
		setStatus("loading");
		try {
			const res = await fetch("/api/nurses/calibration");
			if (res.status === 204) {
				if (!cachedClip) {
					setBlob(null);
					setStatus("missing");
				}
				return;
			}
			if (!res.ok) {
				throw new Error("Failed to load calibration clip");
			}
			const buffer = await res.arrayBuffer();
			const mimeType =
				res.headers.get("Content-Type") || "application/octet-stream";
			const fetchedBlob = new Blob([buffer], { type: mimeType });
			setBlob(fetchedBlob);
			void saveLocalClip(fetchedBlob).then((cachedUrl) => {
				if (cachedUrl) {
					setLocalDataUrl(cachedUrl);
				}
			});
			setStatus("ready");
		} catch (err) {
			console.error("[Calibration] Failed to load clip:", err);
			if (!cachedClip) {
				setStatus("error");
			}
		}
	}, []);

	useEffect(() => {
		void refresh();
	}, [refresh]);

	useEffect(() => {
		if (!blob) {
			setAudioUrl(null);
			setLocalDataUrl(null);
			return;
		}
		if (localDataUrl) {
			setAudioUrl(localDataUrl);
			return;
		}
		const url = URL.createObjectURL(blob);
		setAudioUrl(url);
		return () => {
			URL.revokeObjectURL(url);
		};
	}, [blob, localDataUrl]);

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
					setBlob(recordedBlob);
					setStatus("saving");
					try {
						void saveLocalClip(recordedBlob).then((cachedUrl) => {
							if (cachedUrl) {
								setLocalDataUrl(cachedUrl);
							}
						});
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
		})().catch(() => { });
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
