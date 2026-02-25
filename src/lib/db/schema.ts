import { sql } from "drizzle-orm";
import {
	pgEnum,
	pgPolicy,
	pgTable,
	customType,
	text,
	date,
	boolean,
	timestamp,
	integer,
	real,
	uuid,
} from "drizzle-orm/pg-core";

const bytea = customType<{ data: Buffer | null; driverData: Buffer | null }>({
	dataType() {
		return "bytea";
	},
});

export const interactionTypeEnum = pgEnum("interaction_type", [
	"Routine",
	"Intervention",
]);
export const noteStatusEnum = pgEnum("note_status", [
	"Draft",
	"Approved_by_Nurse",
]);

// auth.uid()            — reads app.current_user_id from the session (set by API middleware)
// auth.current_org_id() — SECURITY DEFINER fn; bypasses RLS on nurses to avoid recursion

export const organizations = pgTable(
	"organizations",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		name: text("name").notNull(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	() => [
		pgPolicy("org_isolation", {
			for: "all",
			using: sql`id = auth.current_org_id()`,
		}),
	],
).enableRLS();

export const nurses = pgTable(
	"nurses",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		// References neon_auth.user(id) — FK enforced at DB level, external to Drizzle
		userId: uuid("user_id").notNull().unique(),
		nurseFirstName: text("nurse_first_name").notNull(),
		nurseLastName: text("nurse_last_name").notNull(),
		calibrationAudioBlob: bytea("calibration_audio_blob"),
		calibrationAudioMimeType: text("calibration_audio_mime_type"),
		calibrationAudioStorageUrl: text("calibration_audio_storage_url"),
		orgId: uuid("org_id")
			.notNull()
			.references(() => organizations.id, { onDelete: "cascade" }),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	() => [
		pgPolicy("nurses_org_isolation", {
			for: "all",
			using: sql`org_id = auth.current_org_id()`,
		}),
	],
).enableRLS();

export const patients = pgTable(
	"patients",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		orgId: uuid("org_id")
			.notNull()
			.references(() => organizations.id, { onDelete: "cascade" }),
		patientFirstName: text("patient_first_name").notNull(),
		patientLastName: text("patient_last_name").notNull(),
		dateOfBirth: date("date_of_birth"),
		sex: text("sex"),
		codeStatus: text("code_status"),
		admitDate: date("admit_date"),
		roomLabel: text("room_label"),
		bedLabel: text("bed_label"),
		primaryPayor: text("primary_payor"),
		lovedOneFirstName: text("loved_one_first_name").notNull(),
		lovedOneLastName: text("loved_one_last_name").notNull(),
		lovedOneRelation: text("loved_one_relation").notNull(),
		elevenlabsVoiceId: text("elevenlabs_voice_id"),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	() => [
		pgPolicy("patients_org_isolation", {
			for: "all",
			using: sql`org_id = auth.current_org_id()`,
		}),
	],
).enableRLS();

export const patientDiagnoses = pgTable(
	"patient_diagnoses",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		patientId: uuid("patient_id")
			.notNull()
			.references(() => patients.id, { onDelete: "cascade" }),
		description: text("description").notNull(),
		icd10Code: text("icd10_code"),
		isPrimary: boolean("is_primary").notNull().default(false),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	() => [
		pgPolicy("patient_diagnoses_org_isolation", {
			for: "all",
			using: sql`patient_id IN (SELECT id FROM public.patients WHERE org_id = auth.current_org_id())`,
		}),
	],
).enableRLS();

export const patientAllergies = pgTable(
	"patient_allergies",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		patientId: uuid("patient_id")
			.notNull()
			.references(() => patients.id, { onDelete: "cascade" }),
		substance: text("substance").notNull(),
		reaction: text("reaction"),
		severity: text("severity"),
		recordedAt: timestamp("recorded_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	() => [
		pgPolicy("patient_allergies_org_isolation", {
			for: "all",
			using: sql`patient_id IN (SELECT id FROM public.patients WHERE org_id = auth.current_org_id())`,
		}),
	],
).enableRLS();

export const patientMedications = pgTable(
	"patient_medications",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		patientId: uuid("patient_id")
			.notNull()
			.references(() => patients.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		dose: text("dose"),
		route: text("route"),
		frequency: text("frequency"),
		startAt: timestamp("start_at", { withTimezone: true }),
		endAt: timestamp("end_at", { withTimezone: true }),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	() => [
		pgPolicy("patient_medications_org_isolation", {
			for: "all",
			using: sql`patient_id IN (SELECT id FROM public.patients WHERE org_id = auth.current_org_id())`,
		}),
	],
).enableRLS();

export const patientVitals = pgTable(
	"patient_vitals",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		patientId: uuid("patient_id")
			.notNull()
			.references(() => patients.id, { onDelete: "cascade" }),
		measuredAt: timestamp("measured_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		bpSystolic: integer("bp_systolic"),
		bpDiastolic: integer("bp_diastolic"),
		heartRate: integer("heart_rate"),
		respRate: integer("resp_rate"),
		tempC: real("temp_c"),
		spo2: integer("spo2"),
		weightKg: real("weight_kg"),
	},
	() => [
		pgPolicy("patient_vitals_org_isolation", {
			for: "all",
			using: sql`patient_id IN (SELECT id FROM public.patients WHERE org_id = auth.current_org_id())`,
		}),
	],
).enableRLS();

export const transcripts = pgTable(
	"transcripts",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		patientId: uuid("patient_id")
			.notNull()
			.references(() => patients.id, { onDelete: "cascade" }),
		nurseId: uuid("nurse_id")
			.notNull()
			.references(() => nurses.id, { onDelete: "cascade" }),
		interactionType: interactionTypeEnum("interaction_type").notNull(),
		rawTranscript: text("raw_transcript").notNull(),
		audioBlob: bytea("audio_blob"),
		audioMimeType: text("audio_mime_type"),
		audioStorageUrl: text("audio_storage_url"),
		timestamp: timestamp("timestamp", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	() => [
		pgPolicy("transcripts_org_isolation", {
			for: "all",
			using: sql`patient_id IN (SELECT id FROM public.patients WHERE org_id = auth.current_org_id())`,
		}),
	],
).enableRLS();

export const clinicalNotes = pgTable(
	"clinical_notes",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		transcriptId: uuid("transcript_id")
			.notNull()
			.references(() => transcripts.id, { onDelete: "cascade" }),
		subjectiveText: text("subjective_text"),
		objectiveText: text("objective_text"),
		assessmentText: text("assessment_text"),
		planText: text("plan_text"),
		status: noteStatusEnum("status").notNull().default("Draft"),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	() => [
		pgPolicy("clinical_notes_org_isolation", {
			for: "all",
			using: sql`transcript_id IN (
        SELECT t.id FROM public.transcripts t
        JOIN public.patients p ON t.patient_id = p.id
        WHERE p.org_id = auth.current_org_id()
      )`,
		}),
	],
).enableRLS();
