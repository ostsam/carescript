import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { sql as drizzleSql } from "drizzle-orm";

type NurseProfile = {
	userId: string;
	label: "admin" | "nurse";
	displayName: string;
};

type PatientProfile = {
	orgId: string;
	nurseId: string;
	patientFirstName: string;
	patientLastName: string;
	dateOfBirth: string;
	sex: string;
	codeStatus: string;
	admitDate: string;
	roomLabel: string;
	bedLabel: string;
	primaryPayor: string;
	lovedOneFirstName: string;
	lovedOneLastName: string;
	lovedOneRelation: string;
	elevenlabsVoiceId: string | null;
};

const DEFAULT_ORG_NAME = "Sunrise Care";
const DEFAULT_ADMIN_COUNT = 1;
const DEFAULT_NURSE_COUNT = 5;
const DEFAULT_PATIENTS_PER_NURSE = 3;

function loadEnv() {
	const envPath = path.resolve(process.cwd(), ".env");
	if (!fs.existsSync(envPath)) return;
	const content = fs.readFileSync(envPath, "utf8");
	for (const rawLine of content.split(/\r?\n/)) {
		const line = rawLine.trim();
		if (!line || line.startsWith("#")) continue;
		const idx = line.indexOf("=");
		if (idx === -1) continue;
		const key = line.slice(0, idx).trim();
		let value = line.slice(idx + 1).trim();
		if (!key || key in process.env) continue;
		if (
			(value.startsWith('"') && value.endsWith('"')) ||
			(value.startsWith("'") && value.endsWith("'"))
		) {
			value = value.slice(1, -1);
		}
		process.env[key] = value;
	}
}

function parseCsv(value?: string) {
	if (!value) return [];
	return value
		.split(",")
		.map((entry) => entry.trim())
		.filter(Boolean);
}

function ensureCount(existing: string[], count: number) {
	const next = [...existing];
	while (next.length < count) next.push(randomUUID());
	return next.slice(0, count);
}

function numberFromEnv(name: string, fallback: number) {
	const raw = process.env[name];
	if (!raw) return fallback;
	const parsed = Number(raw);
	return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const nurseDisplayNames = [
	"Avery Patel",
	"Blake Rivera",
	"Casey Nguyen",
	"Drew Chen",
	"Emery Johnson",
	"Finley Brooks",
	"Harper Singh",
	"Jordan Lee",
];

const patientFirstNames = [
	"Eleanor",
	"Walter",
	"Miriam",
	"Harold",
	"Dorothy",
	"Louis",
	"Beatrice",
	"Arthur",
	"Margaret",
	"Oscar",
	"Ruth",
	"Henry",
	"Gloria",
	"Frank",
	"Lillian",
	"Isaac",
	"Pearl",
];

const patientLastNames = [
	"Harrington",
	"Sullivan",
	"Delgado",
	"Whitaker",
	"Bennett",
	"Caldwell",
	"Nguyen",
	"Thompson",
	"Ramirez",
	"Olsen",
	"Khan",
	"Peterson",
	"Stone",
	"Morrison",
	"Hart",
	"Reed",
	"Kim",
];

const lovedOneFirstNames = [
	"Sam",
	"Grace",
	"Elena",
	"Micah",
	"Noah",
	"Tess",
	"Rowan",
	"Asha",
	"Nico",
	"Maya",
	"Levi",
	"Ivy",
	"Rafael",
	"Nina",
	"Aiden",
	"Esme",
	"Theo",
];

const lovedOneLastNames = [
	"Carter",
	"Lopez",
	"Price",
	"Marshall",
	"Gibson",
	"Hughes",
	"Wells",
	"Diaz",
	"Ward",
	"Ross",
	"Holland",
	"Cooper",
	"Jenkins",
	"Perry",
	"Cole",
	"Bailey",
	"James",
];

const lovedOneRelations = [
	"Spouse",
	"Daughter",
	"Son",
	"Friend",
	"Sibling",
	"Other",
];

const sexOptions = ["Female", "Male", "Other"];
const codeStatusOptions = ["Full Code", "DNR", "DNI"];
const payorOptions = ["Medicare", "Medicaid", "Private", "Managed Care"];

const diagnosisCatalog = [
	{ description: "Hypertension", icd10Code: "I10" },
	{ description: "Type 2 diabetes mellitus", icd10Code: "E11.9" },
	{ description: "Osteoarthritis", icd10Code: "M19.90" },
	{ description: "Chronic kidney disease, stage 3", icd10Code: "N18.30" },
	{ description: "Mild cognitive impairment", icd10Code: "G31.84" },
	{ description: "Congestive heart failure", icd10Code: "I50.9" },
];

const allergyCatalog = [
	{ substance: "Penicillin", reaction: "Rash", severity: "Moderate" },
	{ substance: "Sulfa drugs", reaction: "Hives", severity: "Mild" },
	{ substance: "Latex", reaction: "Irritation", severity: "Low" },
	{ substance: "Shellfish", reaction: "Swelling", severity: "Severe" },
];

const medicationCatalog = [
	{ name: "Lisinopril", dose: "10 mg", route: "PO", frequency: "Daily" },
	{ name: "Metformin", dose: "500 mg", route: "PO", frequency: "BID" },
	{ name: "Atorvastatin", dose: "20 mg", route: "PO", frequency: "Nightly" },
	{ name: "Furosemide", dose: "20 mg", route: "PO", frequency: "Daily" },
	{ name: "Acetaminophen", dose: "650 mg", route: "PO", frequency: "PRN" },
];

function pickFrom<T>(items: T[], index: number): T {
	return items[index % items.length];
}

function makeDobFromAge(age: number, seed: number): string {
	const date = new Date();
	date.setFullYear(date.getFullYear() - age);
	date.setMonth(seed % 12);
	date.setDate(((seed * 7) % 28) + 1);
	return date.toISOString().slice(0, 10);
}

function daysAgo(days: number) {
	return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

function daysAgoDateOnly(days: number): string {
	return daysAgo(days).toISOString().slice(0, 10);
}

function makeTranscriptText(
	patient: PatientProfile,
	nurseName: string,
	index: number,
) {
	const situation =
		index % 2 === 0
			? "routine vitals check and medication reminder"
			: "acute agitation episode requiring de-escalation";
	return [
		`Nurse ${nurseName} reports ${patient.patientFirstName} ${patient.patientLastName} participated in a ${situation}.`,
		`${patient.patientFirstName} responded to reassurance referencing ${patient.lovedOneRelation.toLowerCase()} ${patient.lovedOneFirstName} ${patient.lovedOneLastName}.`,
		"No immediate safety risks noted. Continue observation and standard hydration guidance.",
	].join(" ");
}

function makeClinicalNote(
	patient: PatientProfile,
	nurseName: string,
	index: number,
) {
	return {
		subjectiveText: `${patient.patientFirstName} says they feel calmer after hearing ${patient.lovedOneFirstName}'s voice.`,
		objectiveText: `Nurse ${nurseName} observed steady gait, clear speech, and cooperative behavior.`,
		assessmentText:
			index % 2 === 0
				? "Stable mood and orientation with mild short-term memory gaps."
				: "Agitation resolved after intervention; recommend continued voice cueing.",
		planText:
			"Continue routine checks, reinforce hydration, and schedule a follow-up cognitive screening in 2 weeks.",
	};
}

async function main() {
	loadEnv();

	if (!process.env.NEON_DATABASE_URL) {
		throw new Error(
			"NEON_DATABASE_URL is missing. Add it to .env or export it before running the seed.",
		);
	}

	const adminCount = numberFromEnv("SEED_ADMIN_COUNT", DEFAULT_ADMIN_COUNT);
	const nurseCount = numberFromEnv("SEED_NURSE_COUNT", DEFAULT_NURSE_COUNT);
	const patientsPerNurse = numberFromEnv(
		"SEED_PATIENTS_PER_NURSE",
		DEFAULT_PATIENTS_PER_NURSE,
	);
	const orgName = process.env.SEED_ORG_NAME ?? DEFAULT_ORG_NAME;

	const adminUserIds = ensureCount(
		parseCsv(process.env.SEED_ADMIN_USER_IDS ?? process.env.SEED_ADMIN_USER_ID),
		adminCount,
	);
	const nurseUserIds = ensureCount(
		parseCsv(process.env.SEED_NURSE_USER_IDS),
		nurseCount,
	);

	const nurseProfiles: NurseProfile[] = [
		...adminUserIds.map((userId, idx) => ({
			userId,
			label: "admin" as const,
			displayName: nurseDisplayNames[idx] ?? `Admin ${idx + 1}`,
		})),
		...nurseUserIds.map((userId, idx) => ({
			userId,
			label: "nurse" as const,
			displayName: nurseDisplayNames[idx + adminCount] ?? `Nurse ${idx + 1}`,
		})),
	];

	const [{ neon }, { drizzle }, schema] = await Promise.all([
		import("@neondatabase/serverless"),
		import("drizzle-orm/neon-http"),
		import("../src/lib/db/schema"),
	]);

	const sql = neon(process.env.NEON_DATABASE_URL!);
	const db = drizzle(sql, { schema });

	const {
		organizations,
		nurses,
		patients,
		transcripts,
		clinicalNotes,
		patientDiagnoses,
		patientAllergies,
		patientMedications,
		patientVitals,
	} = schema;

	await db.execute(
		drizzleSql`
		TRUNCATE TABLE
			${organizations},
			${nurses},
			${patients},
			${transcripts},
			${clinicalNotes},
			${patientDiagnoses},
			${patientAllergies},
			${patientMedications},
			${patientVitals}
		RESTART IDENTITY CASCADE
		`,
	);

	const [org] = await db
		.insert(organizations)
		.values({ name: orgName })
		.returning({ id: organizations.id, name: organizations.name });

	const insertedNurses = await db
		.insert(nurses)
		.values(
			nurseProfiles.map((profile, idx) => {
				const nameParts = profile.displayName.split(" ");
				const nurseFirstName = nameParts[0] ?? "Nurse";
				const nurseLastName = nameParts.slice(1).join(" ") || "Staff";
				return {
					userId: profile.userId,
					nurseFirstName,
					nurseLastName,
					orgId: org.id,
					createdAt: new Date(Date.now() - (idx + 1) * 6 * 60 * 60 * 1000),
				};
			}),
		)
		.returning({ id: nurses.id, userId: nurses.userId });

	const nurseIdByUserId = new Map(
		insertedNurses.map((row) => [row.userId, row.id]),
	);
	const nurseNameById = new Map<string, string>();
	for (const profile of nurseProfiles) {
		const nurseId = nurseIdByUserId.get(profile.userId);
		if (nurseId) {
			nurseNameById.set(nurseId, profile.displayName);
		}
	}

	const patientProfiles: PatientProfile[] = [];
	let patientIndex = 0;
	for (const profile of nurseProfiles.filter(
		(entry) => entry.label === "nurse",
	)) {
		const nurseId = nurseIdByUserId.get(profile.userId);
		if (!nurseId) {
			throw new Error(`Missing nurse id for user ${profile.userId}`);
		}
		for (let i = 0; i < patientsPerNurse; i += 1) {
			const patientFirstName =
				patientFirstNames[patientIndex % patientFirstNames.length];
			const patientLastName =
				patientLastNames[patientIndex % patientLastNames.length];
			const lovedOneFirstName =
				lovedOneFirstNames[patientIndex % lovedOneFirstNames.length];
			const lovedOneLastName =
				lovedOneLastNames[patientIndex % lovedOneLastNames.length];
			const lovedOneRelation =
				lovedOneRelations[patientIndex % lovedOneRelations.length];
			const age = 72 + (patientIndex % 22);
			const dateOfBirth = makeDobFromAge(age, patientIndex);
			const admitDate = daysAgoDateOnly(12 + (patientIndex * 13) % 420);
			const roomNumber = 100 + (patientIndex % 40);
			const roomLabel = `${roomNumber}`;
			const bedLabel = patientIndex % 2 === 0 ? "A" : "B";
			patientProfiles.push({
				orgId: org.id,
				nurseId,
				patientFirstName,
				patientLastName,
				dateOfBirth,
				sex: pickFrom(sexOptions, patientIndex),
				codeStatus: pickFrom(codeStatusOptions, patientIndex),
				admitDate,
				roomLabel,
				bedLabel,
				primaryPayor: pickFrom(payorOptions, patientIndex),
				lovedOneFirstName,
				lovedOneLastName,
				lovedOneRelation,
				elevenlabsVoiceId: null,
			});
			patientIndex += 1;
		}
	}

	const insertedPatients = await db
		.insert(patients)
		.values(
			patientProfiles.map((patient, idx) => ({
				orgId: patient.orgId,
				patientFirstName: patient.patientFirstName,
				patientLastName: patient.patientLastName,
				dateOfBirth: patient.dateOfBirth,
				sex: patient.sex,
				codeStatus: patient.codeStatus,
				admitDate: patient.admitDate,
				roomLabel: patient.roomLabel,
				bedLabel: patient.bedLabel,
				primaryPayor: patient.primaryPayor,
				lovedOneFirstName: patient.lovedOneFirstName,
				lovedOneLastName: patient.lovedOneLastName,
				lovedOneRelation: patient.lovedOneRelation,
				elevenlabsVoiceId: patient.elevenlabsVoiceId,
				createdAt: new Date(Date.now() - (idx + 1) * 3 * 60 * 60 * 1000),
			})),
		)
		.returning({ id: patients.id });

	const patientsWithIds = insertedPatients.map((row, idx) => ({
		...patientProfiles[idx],
		id: row.id,
	}));

	const diagnosisRows = patientsWithIds.flatMap((patient, idx) => {
		const primary = pickFrom(diagnosisCatalog, idx);
		const secondary = pickFrom(diagnosisCatalog, idx + 2);
		return [
			{
				patientId: patient.id,
				description: primary.description,
				icd10Code: primary.icd10Code,
				isPrimary: true,
				createdAt: daysAgo(40 + idx),
			},
			{
				patientId: patient.id,
				description: secondary.description,
				icd10Code: secondary.icd10Code,
				isPrimary: false,
				createdAt: daysAgo(30 + idx),
			},
		];
	});

	const allergyRows = patientsWithIds.map((patient, idx) => {
		const allergy = pickFrom(allergyCatalog, idx);
		return {
			patientId: patient.id,
			substance: allergy.substance,
			reaction: allergy.reaction,
			severity: allergy.severity,
			recordedAt: daysAgo(90 + idx),
		};
	});

	const medicationRows = patientsWithIds.flatMap((patient, idx) => {
		const primaryMed = pickFrom(medicationCatalog, idx);
		const secondaryMed = pickFrom(medicationCatalog, idx + 1);
		return [
			{
				patientId: patient.id,
				name: primaryMed.name,
				dose: primaryMed.dose,
				route: primaryMed.route,
				frequency: primaryMed.frequency,
				startAt: daysAgo(120 + idx),
				endAt: null,
				createdAt: daysAgo(120 + idx),
			},
			{
				patientId: patient.id,
				name: secondaryMed.name,
				dose: secondaryMed.dose,
				route: secondaryMed.route,
				frequency: secondaryMed.frequency,
				startAt: daysAgo(90 + idx),
				endAt: null,
				createdAt: daysAgo(90 + idx),
			},
		];
	});

	const vitalRows = patientsWithIds.map((patient, idx) => ({
		patientId: patient.id,
		measuredAt: daysAgo(idx % 7),
		bpSystolic: 118 + (idx % 18),
		bpDiastolic: 68 + (idx % 10),
		heartRate: 66 + (idx % 18),
		respRate: 14 + (idx % 6),
		tempC: 36.4 + (idx % 5) * 0.1,
		spo2: 94 + (idx % 5),
		weightKg: 60 + (idx % 20),
	}));

	const transcriptRows = patientsWithIds.map((patient, idx) => {
		const nurseName = nurseNameById.get(patient.nurseId) ?? "Unknown";
		const interactionType =
			idx % 2 === 0 ? ("Routine" as const) : ("Intervention" as const);
		return {
			patientId: patient.id,
			nurseId: patient.nurseId,
			interactionType,
			rawTranscript: makeTranscriptText(patient, nurseName, idx),
			timestamp: new Date(Date.now() - (idx + 1) * 45 * 60 * 1000),
		};
	});

	const insertedTranscripts = await db
		.insert(transcripts)
		.values(transcriptRows)
		.returning({ id: transcripts.id });

	const clinicalNoteRows = insertedTranscripts.map((transcript, idx) => {
		const patient = patientsWithIds[idx];
		const nurseName = nurseNameById.get(patient.nurseId) ?? "Unknown";
		const note = makeClinicalNote(patient, nurseName, idx);
		const status =
			idx % 3 === 0 ? ("Approved_by_Nurse" as const) : ("Draft" as const);
		return {
			transcriptId: transcript.id,
			...note,
			status,
			createdAt: new Date(Date.now() - (idx + 1) * 30 * 60 * 1000),
		};
	});

	await db.insert(clinicalNotes).values(clinicalNoteRows);
	await db.insert(patientDiagnoses).values(diagnosisRows);
	await db.insert(patientAllergies).values(allergyRows);
	await db.insert(patientMedications).values(medicationRows);
	await db.insert(patientVitals).values(vitalRows);

	const adminUsers = nurseProfiles.filter(
		(profile) => profile.label === "admin",
	);
	const staffUsers = nurseProfiles.filter(
		(profile) => profile.label === "nurse",
	);

	console.log("Seed complete.");
	console.log(`Organization: ${org.name} (${org.id})`);
	console.log(`Admins: ${adminUsers.length} | Nurses: ${staffUsers.length}`);
	console.log(`Patients: ${patientsWithIds.length}`);
	console.log(`Transcripts: ${insertedTranscripts.length}`);
	console.log(`Clinical notes: ${clinicalNoteRows.length}`);
	console.log(`Diagnoses: ${diagnosisRows.length}`);
	console.log(`Allergies: ${allergyRows.length}`);
	console.log(`Medications: ${medicationRows.length}`);
	console.log(`Vitals: ${vitalRows.length}`);
	console.log(
		"Admin user IDs:",
		adminUsers.map((admin) => admin.userId).join(", "),
	);
	console.log(
		"Nurse user IDs:",
		staffUsers.map((nurse) => nurse.userId).join(", "),
	);
}

main().catch((error) => {
	console.error("Seed failed:", error);
	process.exit(1);
});
