ALTER TABLE "nurses" ADD COLUMN "calibration_audio_blob" "bytea";--> statement-breakpoint
ALTER TABLE "nurses" ADD COLUMN "calibration_audio_mime_type" text;--> statement-breakpoint
ALTER TABLE "nurses" ADD COLUMN "calibration_audio_storage_url" text;