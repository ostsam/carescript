"use client";

import { Button } from "@/components/ui/button";
import { useCalibrationClip } from "@/components/calibration/use-calibration-clip";

export function CalibrationClipSection() {
	const {
		status,
		recording,
		error,
		audioUrl,
		startRecording,
		stopRecording,
	} = useCalibrationClip();

	const isBusy = status === "loading" || status === "saving";
	const hasClip = status === "ready" && !!audioUrl;

	return (
		<section className="py-6">
			<h2 className="text-sm font-semibold">Calibration Clip</h2>
			<p className="mt-0.5 text-sm text-muted-foreground">
				Used to improve speaker diarization for every session.
			</p>
			<div className="mt-4 rounded-lg border bg-muted/30 px-4 py-4 text-sm">
				<div className="flex flex-wrap items-center gap-2">
					{recording ? (
						<Button size="sm" variant="destructive" onClick={stopRecording}>
							Stop Recording
						</Button>
					) : (
						<Button
							size="sm"
							variant="outline"
							onClick={startRecording}
							disabled={isBusy}
						>
							{hasClip ? "Re-record Calibration" : "Record Calibration"}
						</Button>
					)}
					<span className="text-xs text-muted-foreground">
						{status === "ready" && "Calibration ready"}
						{status === "missing" && "No calibration clip yet"}
						{status === "loading" && "Loading calibration…"}
						{status === "saving" && "Saving calibration…"}
						{status === "error" && "Calibration failed"}
					</span>
				</div>

				{audioUrl && (
					<div className="mt-3 rounded-md border bg-background px-3 py-2">
						<p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
							Playback
						</p>
						<audio controls src={audioUrl} className="w-full" />
					</div>
				)}

				{error && <p className="mt-2 text-xs text-destructive">{error}</p>}
			</div>
		</section>
	);
}
