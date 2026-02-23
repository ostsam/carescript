ALTER TABLE "patients" RENAME COLUMN "first_name" TO "patient_first_name";--> statement-breakpoint
ALTER TABLE "patients" RENAME COLUMN "loved_one_name" TO "loved_one_first_name";--> statement-breakpoint
ALTER TABLE "nurses" ADD COLUMN "nurse_first_name" text NOT NULL;--> statement-breakpoint
ALTER TABLE "nurses" ADD COLUMN "nurse_last_name" text NOT NULL;--> statement-breakpoint
ALTER TABLE "patients" ADD COLUMN "patient_last_name" text NOT NULL;--> statement-breakpoint
ALTER TABLE "patients" ADD COLUMN "loved_one_last_name" text NOT NULL;