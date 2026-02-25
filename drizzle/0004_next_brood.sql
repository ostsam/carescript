CREATE TABLE "patient_allergies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"substance" text NOT NULL,
	"reaction" text,
	"severity" text,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "patient_allergies" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "patient_diagnoses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"description" text NOT NULL,
	"icd10_code" text,
	"is_primary" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "patient_diagnoses" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "patient_medications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"name" text NOT NULL,
	"dose" text,
	"route" text,
	"frequency" text,
	"start_at" timestamp with time zone,
	"end_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "patient_medications" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "patient_vitals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"measured_at" timestamp with time zone DEFAULT now() NOT NULL,
	"bp_systolic" integer,
	"bp_diastolic" integer,
	"heart_rate" integer,
	"resp_rate" integer,
	"temp_c" real,
	"spo2" integer,
	"weight_kg" real
);
--> statement-breakpoint
ALTER TABLE "patient_vitals" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "patients" ADD COLUMN "date_of_birth" date;--> statement-breakpoint
ALTER TABLE "patients" ADD COLUMN "sex" text;--> statement-breakpoint
ALTER TABLE "patients" ADD COLUMN "code_status" text;--> statement-breakpoint
ALTER TABLE "patients" ADD COLUMN "admit_date" date;--> statement-breakpoint
ALTER TABLE "patients" ADD COLUMN "room_label" text;--> statement-breakpoint
ALTER TABLE "patients" ADD COLUMN "bed_label" text;--> statement-breakpoint
ALTER TABLE "patients" ADD COLUMN "primary_payor" text;--> statement-breakpoint
ALTER TABLE "patient_allergies" ADD CONSTRAINT "patient_allergies_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patient_diagnoses" ADD CONSTRAINT "patient_diagnoses_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patient_medications" ADD CONSTRAINT "patient_medications_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patient_vitals" ADD CONSTRAINT "patient_vitals_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE POLICY "patient_allergies_org_isolation" ON "patient_allergies" AS PERMISSIVE FOR ALL TO public USING (patient_id IN (SELECT id FROM public.patients WHERE org_id = auth.current_org_id()));--> statement-breakpoint
CREATE POLICY "patient_diagnoses_org_isolation" ON "patient_diagnoses" AS PERMISSIVE FOR ALL TO public USING (patient_id IN (SELECT id FROM public.patients WHERE org_id = auth.current_org_id()));--> statement-breakpoint
CREATE POLICY "patient_medications_org_isolation" ON "patient_medications" AS PERMISSIVE FOR ALL TO public USING (patient_id IN (SELECT id FROM public.patients WHERE org_id = auth.current_org_id()));--> statement-breakpoint
CREATE POLICY "patient_vitals_org_isolation" ON "patient_vitals" AS PERMISSIVE FOR ALL TO public USING (patient_id IN (SELECT id FROM public.patients WHERE org_id = auth.current_org_id()));