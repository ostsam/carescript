ALTER TABLE "transcripts" ADD COLUMN "audio_blob" "bytea";--> statement-breakpoint
ALTER TABLE "transcripts" ADD COLUMN "audio_mime_type" text;--> statement-breakpoint
ALTER TABLE "transcripts" ADD COLUMN "audio_storage_url" text;