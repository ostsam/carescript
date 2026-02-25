"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useCalibrationClip } from "@/components/calibration/use-calibration-clip";
import { CalibrationClipPlayer } from "@/components/calibration/calibration-clip-player";
import { HugeiconsIcon } from "@hugeicons/react";
import {
	Alert02Icon,
	CheckmarkCircle01Icon,
	Loading03Icon,
	Mic01Icon,
} from "@hugeicons/core-free-icons";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export function CalibrationClipSection() {
	const {
		status,
		recording,
		error,
		blob,
		audioUrl,
		startRecording,
		stopRecording,
	} = useCalibrationClip();
	const [showOverwriteDialog, setShowOverwriteDialog] = useState(false);

	const isBusy = status === "loading" || status === "saving";
	const hasClip = !!audioUrl;

	const statusMeta = (() => {
		if (status === "loading") {
			return {
				title: "Loading calibration clip",
				description: "Fetching your saved calibration audio.",
				icon: Loading03Icon,
				iconClassName: "bg-muted text-muted-foreground",
				spin: true,
			};
		}
		if (status === "saving") {
			return {
				title: "Saving calibration clip",
				description: "Uploading the latest calibration audio.",
				icon: Loading03Icon,
				iconClassName: "bg-muted text-muted-foreground",
				spin: true,
			};
		}
		if (status === "error") {
			return {
				title: "Calibration clip failed",
				description: "We ran into an issue saving your calibration clip.",
				icon: Alert02Icon,
				iconClassName: "bg-destructive/10 text-destructive",
				spin: false,
			};
		}
		if (hasClip) {
			return {
				title: "Calibration clip ready",
				description: "Record again if the mic environment changes.",
				icon: CheckmarkCircle01Icon,
				iconClassName: "bg-emerald-50 text-emerald-600",
				spin: false,
			};
		}
		return {
			title: "Calibration clip missing",
			description: "Record a short clip to improve diarization accuracy.",
			icon: Mic01Icon,
			iconClassName: "bg-muted text-muted-foreground",
			spin: false,
		};
	})();

	const statusMessage = (() => {
		if (status === "ready" && hasClip) return "Calibration ready";
		if (status === "missing") return "No calibration clip yet";
		if (status === "loading") return "Loading calibration…";
		if (status === "saving") return "Saving calibration…";
		if (status === "error") return "Calibration failed";
		return "";
	})();

	const handleStartRecording = () => {
		if (hasClip) {
			setShowOverwriteDialog(true);
			return;
		}
		startRecording();
	};

	const confirmOverwrite = () => {
		setShowOverwriteDialog(false);
		startRecording();
	};

	return (
		<section className="py-6">
			<div className="rounded-2xl border bg-muted/30 p-6">
				<div className="flex flex-wrap items-start justify-between gap-4">
					<div className="flex items-start gap-3">
						<div
							className={cn(
								"flex size-11 items-center justify-center rounded-full",
								statusMeta.iconClassName,
							)}
						>
							<HugeiconsIcon
								icon={statusMeta.icon}
								size={20}
								className={cn(statusMeta.spin && "animate-spin")}
							/>
						</div>
						<div>
							<h2 className="text-base font-semibold">{statusMeta.title}</h2>
							<p className="mt-1 text-sm text-muted-foreground">
								{statusMeta.description}
							</p>
						</div>
					</div>
					<div className="flex flex-col items-end gap-2">
						{recording ? (
							<Button size="sm" variant="destructive" onClick={stopRecording}>
								Stop Recording
							</Button>
						) : (
							<Button
								size="sm"
								variant="outline"
								onClick={handleStartRecording}
								disabled={isBusy}
							>
								{hasClip ? "Re-record Calibration" : "Record Calibration"}
							</Button>
						)}
						{statusMessage && (
							<span className="text-[11px] text-muted-foreground">
								{statusMessage}
							</span>
						)}
					</div>
				</div>

				{audioUrl && blob && (
					<div className="mt-6">
						<p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
							Playback
						</p>
						<CalibrationClipPlayer audioUrl={audioUrl} blob={blob} />
					</div>
				)}

				{error && <p className="mt-3 text-xs text-destructive">{error}</p>}
			</div>

			<Dialog open={showOverwriteDialog} onOpenChange={setShowOverwriteDialog}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Replace calibration clip?</DialogTitle>
						<DialogDescription>
							Recording a new clip will overwrite the existing calibration
							audio. Continue?
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => setShowOverwriteDialog(false)}
						>
							Cancel
						</Button>
						<Button variant="destructive" onClick={confirmOverwrite}>
							Record New Clip
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</section>
	);
}
