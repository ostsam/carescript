"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { PauseIcon, PlayIcon } from "@hugeicons/core-free-icons";

import { AudioScrubber } from "@/components/ui/waveform";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type CalibrationClipPlayerProps = {
	audioUrl: string;
	blob: Blob;
	className?: string;
};

const formatTime = (seconds: number) => {
	if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
	const minutes = Math.floor(seconds / 60);
	const remaining = Math.floor(seconds % 60);
	return `${minutes}:${remaining.toString().padStart(2, "0")}`;
};

const buildWaveformData = (audioBuffer: AudioBuffer) => {
	const duration = audioBuffer.duration || 0;
	const targetSamples = Math.min(200, Math.max(64, Math.floor(duration * 18)));
	const samples = Math.max(
		1,
		Math.min(targetSamples, audioBuffer.length || targetSamples),
	);
	const blockSize = Math.max(1, Math.floor(audioBuffer.length / samples));
	const channelCount = audioBuffer.numberOfChannels;
	const waveform = new Array(samples).fill(0);

	for (let i = 0; i < samples; i += 1) {
		let sum = 0;
		let count = 0;
		const start = i * blockSize;
		const end = Math.min(start + blockSize, audioBuffer.length);

		for (let channel = 0; channel < channelCount; channel += 1) {
			const data = audioBuffer.getChannelData(channel);
			for (let j = start; j < end; j += 1) {
				sum += Math.abs(data[j]);
				count += 1;
			}
		}

		waveform[i] = count ? sum / count : 0;
	}

	const max = Math.max(...waveform, 0.001);
	return waveform.map((value) => Math.min(1, value / max));
};

const writeString = (view: DataView, offset: number, str: string) => {
	for (let i = 0; i < str.length; i++) {
		view.setUint8(offset + i, str.charCodeAt(i));
	}
};

const audioBufferToWavBlob = (buffer: AudioBuffer): Blob => {
	const numChannels = buffer.numberOfChannels;
	const sampleRate = buffer.sampleRate;
	const length = buffer.length;
	const bytesPerSample = 2;
	const dataLength = length * numChannels * bytesPerSample;
	const totalLength = 44 + dataLength;

	const arrayBuffer = new ArrayBuffer(totalLength);
	const view = new DataView(arrayBuffer);

	writeString(view, 0, "RIFF");
	view.setUint32(4, totalLength - 8, true);
	writeString(view, 8, "WAVE");
	writeString(view, 12, "fmt ");
	view.setUint32(16, 16, true);
	view.setUint16(20, 1, true);
	view.setUint16(22, numChannels, true);
	view.setUint32(24, sampleRate, true);
	view.setUint32(28, sampleRate * numChannels * bytesPerSample, true);
	view.setUint16(32, numChannels * bytesPerSample, true);
	view.setUint16(34, 8 * bytesPerSample, true);
	writeString(view, 36, "data");
	view.setUint32(40, dataLength, true);

	let offset = 44;
	for (let i = 0; i < length; i++) {
		for (let ch = 0; ch < numChannels; ch++) {
			const sample = Math.max(-1, Math.min(1, buffer.getChannelData(ch)[i]));
			view.setInt16(
				offset,
				sample < 0 ? sample * 0x8000 : sample * 0x7fff,
				true,
			);
			offset += 2;
		}
	}

	return new Blob([arrayBuffer], { type: "audio/wav" });
};

export function CalibrationClipPlayer({
	audioUrl,
	blob,
	className,
}: CalibrationClipPlayerProps) {
	const audioRef = useRef<HTMLAudioElement>(null);
	const pendingSeekRef = useRef<number | null>(null);
	const [waveformData, setWaveformData] = useState<number[]>([]);
	const [currentTime, setCurrentTime] = useState(0);
	const [duration, setDuration] = useState(0);
	const [decodedDuration, setDecodedDuration] = useState(0);
	const [isPlaying, setIsPlaying] = useState(false);
	const [isDecoding, setIsDecoding] = useState(false);
	const [wavUrl, setWavUrl] = useState<string | null>(null);

	useEffect(() => {
		const audio = audioRef.current;
		if (audio) {
			audio.pause();
			audio.currentTime = 0;
		}
		setCurrentTime(0);
		setDuration(0);
		setDecodedDuration(0);
		setIsPlaying(false);
	}, [audioUrl]);

	useEffect(() => {
		let isCancelled = false;
		let objectUrl: string | null = null;

		const decode = async () => {
			if (!blob) {
				setWaveformData([]);
				setWavUrl(null);
				return;
			}

			setIsDecoding(true);
			let audioContext: AudioContext | null = null;
			try {
				const arrayBuffer = await blob.arrayBuffer();
				audioContext = new (
					window.AudioContext ||
					(window as unknown as { webkitAudioContext: typeof AudioContext })
						.webkitAudioContext
				)();
				const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
				if (!isCancelled) {
					setWaveformData(buildWaveformData(audioBuffer));
					setDecodedDuration(audioBuffer.duration || 0);

					const wavBlob = audioBufferToWavBlob(audioBuffer);
					objectUrl = URL.createObjectURL(wavBlob);
					setWavUrl(objectUrl);
				}
			} catch (err) {
				console.error("[Calibration] Failed to decode clip:", err);
				if (!isCancelled) {
					setWaveformData([]);
					setWavUrl(null);
				}
			} finally {
				if (audioContext) {
					await audioContext.close();
				}
				if (!isCancelled) {
					setIsDecoding(false);
				}
			}
		};

		void decode();

		return () => {
			isCancelled = true;
			if (objectUrl) {
				URL.revokeObjectURL(objectUrl);
			}
		};
	}, [blob]);

	const playbackSrc = wavUrl ?? audioUrl;

	useEffect(() => {
		const audio = audioRef.current;
		if (!audio) return;

		const handleLoadedMetadata = () => {
			const nextDuration = Number.isFinite(audio.duration) ? audio.duration : 0;
			setDuration(nextDuration);
			if (pendingSeekRef.current !== null) {
				const target = Math.min(
					pendingSeekRef.current,
					nextDuration || decodedDuration || 0,
				);
				audio.currentTime = target;
				setCurrentTime(target);
				pendingSeekRef.current = null;
			}
		};

		const handleTimeUpdate = () => {
			setCurrentTime(audio.currentTime);
		};

		const handlePlay = () => setIsPlaying(true);
		const handlePause = () => setIsPlaying(false);
		const handleEnded = () => setIsPlaying(false);

		audio.addEventListener("loadedmetadata", handleLoadedMetadata);
		audio.addEventListener("loadeddata", handleLoadedMetadata);
		audio.addEventListener("canplay", handleLoadedMetadata);
		audio.addEventListener("durationchange", handleLoadedMetadata);
		audio.addEventListener("timeupdate", handleTimeUpdate);
		audio.addEventListener("play", handlePlay);
		audio.addEventListener("pause", handlePause);
		audio.addEventListener("ended", handleEnded);

		return () => {
			audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
			audio.removeEventListener("loadeddata", handleLoadedMetadata);
			audio.removeEventListener("canplay", handleLoadedMetadata);
			audio.removeEventListener("durationchange", handleLoadedMetadata);
			audio.removeEventListener("timeupdate", handleTimeUpdate);
			audio.removeEventListener("play", handlePlay);
			audio.removeEventListener("pause", handlePause);
			audio.removeEventListener("ended", handleEnded);
		};
	}, [playbackSrc, decodedDuration]);

	useEffect(() => {
		if (!isPlaying) return;

		let rafId: number;
		const update = () => {
			const audio = audioRef.current;
			if (audio) {
				setCurrentTime(audio.currentTime);
			}
			rafId = requestAnimationFrame(update);
		};

		rafId = requestAnimationFrame(update);

		return () => {
			cancelAnimationFrame(rafId);
		};
	}, [isPlaying]);

	const togglePlayback = () => {
		const audio = audioRef.current;
		if (!audio) return;
		if (audio.paused) {
			if (
				audio.ended ||
				(effectiveDuration > 0 && audio.currentTime >= effectiveDuration)
			) {
				audio.currentTime = 0;
				setCurrentTime(0);
			}
			void audio.play();
		} else {
			audio.pause();
		}
	};

	const rawAudioElDuration = audioRef.current?.duration;
	const finiteAudioElDuration =
		rawAudioElDuration != null && Number.isFinite(rawAudioElDuration)
			? rawAudioElDuration
			: 0;
	const effectiveDuration = Math.max(
		duration,
		decodedDuration,
		finiteAudioElDuration,
	);

	const handleSeek = (time: number) => {
		const audio = audioRef.current;
		if (!audio || !Number.isFinite(time)) return;
		const nextTime = Math.max(0, Math.min(time, effectiveDuration || 0));
		if (audio.readyState < 1) {
			pendingSeekRef.current = nextTime;
			audio.load();
			return;
		}
		audio.currentTime = nextTime;
		setCurrentTime(nextTime);
		if (!audio.paused) {
			void audio.play();
		}
	};

	const statusLabel = useMemo(() => {
		if (isDecoding) return "Preparing";
		return isPlaying ? "Playing" : "Ready";
	}, [isDecoding, isPlaying]);

	return (
		<div
			className={cn(
				"rounded-2xl border bg-background p-6 shadow-sm",
				className,
			)}
		>
			<div className="flex flex-wrap items-center justify-between gap-4">
				<div className="flex items-center gap-3 ">
					<Button
						size="icon-lg"
						variant="outline"
						onClick={togglePlayback}
						className="rounded-full"
						aria-label={
							isPlaying
								? "Pause calibration playback"
								: "Play calibration playback"
						}
					>
						<HugeiconsIcon
							icon={isPlaying ? PauseIcon : PlayIcon}
							strokeWidth={2}
							size={18}
						/>
					</Button>
					<div>
						<p className="text-sm font-medium">{statusLabel}</p>
					</div>
				</div>
				<div className="text-xs text-muted-foreground tabular-nums">
					{formatTime(currentTime)} / {formatTime(effectiveDuration)}
				</div>
			</div>

			<div className="mt-5 h-28 rounded-2xl border bg-muted/20 p-4">
				<AudioScrubber
					className="h-full w-full"
					currentTime={currentTime}
					data={waveformData}
					duration={effectiveDuration}
					height="100%"
					onSeek={handleSeek}
					showHandle={false}
					barGap={2}
					barRadius={3}
					barWidth={3}
					barColor="var(--muted-foreground)"
				/>
			</div>

			<audio
				ref={audioRef}
				src={playbackSrc}
				preload="auto"
				playsInline
				className="sr-only"
			/>
		</div>
	);
}
