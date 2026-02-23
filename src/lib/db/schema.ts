import { sql } from "drizzle-orm";
import {
	pgEnum,
	pgPolicy,
	pgTable,
	text,
	timestamp,
	uuid,
} from "drizzle-orm/pg-core";

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
