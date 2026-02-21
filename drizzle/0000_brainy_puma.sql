CREATE TYPE "public"."interaction_type" AS ENUM('Routine', 'Intervention');--> statement-breakpoint
CREATE TYPE "public"."note_status" AS ENUM('Draft', 'Approved_by_Nurse');--> statement-breakpoint
CREATE TABLE "clinical_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transcript_id" uuid NOT NULL,
	"subjective_text" text,
	"objective_text" text,
	"assessment_text" text,
	"plan_text" text,
	"status" "note_status" DEFAULT 'Draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "clinical_notes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "nurses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"org_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "nurses_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "nurses" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "organizations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "patients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"first_name" text NOT NULL,
	"loved_one_name" text NOT NULL,
	"loved_one_relation" text NOT NULL,
	"elevenlabs_voice_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "patients" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "transcripts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"nurse_id" uuid NOT NULL,
	"interaction_type" "interaction_type" NOT NULL,
	"raw_transcript" text NOT NULL,
	"timestamp" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "transcripts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "clinical_notes" ADD CONSTRAINT "clinical_notes_transcript_id_transcripts_id_fk" FOREIGN KEY ("transcript_id") REFERENCES "public"."transcripts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nurses" ADD CONSTRAINT "nurses_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patients" ADD CONSTRAINT "patients_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transcripts" ADD CONSTRAINT "transcripts_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transcripts" ADD CONSTRAINT "transcripts_nurse_id_nurses_id_fk" FOREIGN KEY ("nurse_id") REFERENCES "public"."nurses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE POLICY "clinical_notes_org_isolation" ON "clinical_notes" AS PERMISSIVE FOR ALL TO public USING (transcript_id IN (
        SELECT t.id FROM public.transcripts t
        JOIN public.patients p ON t.patient_id = p.id
        WHERE p.org_id = auth.current_org_id()
      ));--> statement-breakpoint
CREATE POLICY "nurses_org_isolation" ON "nurses" AS PERMISSIVE FOR ALL TO public USING (org_id = auth.current_org_id());--> statement-breakpoint
CREATE POLICY "org_isolation" ON "organizations" AS PERMISSIVE FOR ALL TO public USING (id = auth.current_org_id());--> statement-breakpoint
CREATE POLICY "patients_org_isolation" ON "patients" AS PERMISSIVE FOR ALL TO public USING (org_id = auth.current_org_id());--> statement-breakpoint
CREATE POLICY "transcripts_org_isolation" ON "transcripts" AS PERMISSIVE FOR ALL TO public USING (patient_id IN (SELECT id FROM public.patients WHERE org_id = auth.current_org_id()));