"use server";

import { auth } from "@/lib/auth/server";
import { withAuth } from "@/lib/db";
import {
  patients,
  patientDiagnoses,
  patientAllergies,
  patientMedications,
  patientVitals,
} from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

function optionalText(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function optionalInt(value: FormDataEntryValue | null): number | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number.parseInt(trimmed, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function optionalFloat(value: FormDataEntryValue | null): number | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number.parseFloat(trimmed);
  return Number.isNaN(parsed) ? null : parsed;
}

function revalidatePatient(patientId: string) {
  revalidatePath("/dashboard/patients");
  revalidatePath(`/dashboard/patients/${patientId}`);
}

const PATIENT_EDIT_FIELDS = [
  "dateOfBirth",
  "sex",
  "codeStatus",
  "admitDate",
  "roomLabel",
  "bedLabel",
  "primaryPayor",
] as const;

type PatientEditField = (typeof PATIENT_EDIT_FIELDS)[number];

function isPatientEditField(value: string): value is PatientEditField {
  return (PATIENT_EDIT_FIELDS as readonly string[]).includes(value);
}

export async function updatePatientField(
  patientId: string,
  field: PatientEditField,
  value: string | null,
) {
  const { data: session } = await auth.getSession();

  if (!session?.user || !patientId) {
    return;
  }

  if (!isPatientEditField(field)) {
    return;
  }

  const normalizedValue =
    typeof value === "string" && value.trim().length > 0 ? value.trim() : null;

  const updatePayload: Partial<typeof patients.$inferInsert> = {};
  (updatePayload as Record<string, string | null>)[field] = normalizedValue;

  await withAuth(session.user.id, async (tx) => {
    await tx
      .update(patients)
      .set(updatePayload)
      .where(eq(patients.id, patientId));
  });

  revalidatePatient(patientId);
}

export async function addDiagnosis(formData: FormData) {
  const { data: session } = await auth.getSession();
  if (!session?.user) return;

  const patientId = optionalText(formData.get("patientId"));
  const description = optionalText(formData.get("description"));
  const icd10Code = optionalText(formData.get("icd10Code"));
  const isPrimary = formData.get("isPrimary") === "on";

  if (!patientId || !description) return;

  await withAuth(session.user.id, async (tx) => {
    await tx.insert(patientDiagnoses).values({
      patientId,
      description,
      icd10Code,
      isPrimary,
    });
  });

  revalidatePatient(patientId);
}

export async function addAllergy(formData: FormData) {
  const { data: session } = await auth.getSession();
  if (!session?.user) return;

  const patientId = optionalText(formData.get("patientId"));
  const substance = optionalText(formData.get("substance"));
  const reaction = optionalText(formData.get("reaction"));
  const severity = optionalText(formData.get("severity"));

  if (!patientId || !substance) return;

  await withAuth(session.user.id, async (tx) => {
    await tx.insert(patientAllergies).values({
      patientId,
      substance,
      reaction,
      severity,
    });
  });

  revalidatePatient(patientId);
}

export async function addMedication(formData: FormData) {
  const { data: session } = await auth.getSession();
  if (!session?.user) return;

  const patientId = optionalText(formData.get("patientId"));
  const name = optionalText(formData.get("name"));
  const dose = optionalText(formData.get("dose"));
  const route = optionalText(formData.get("route"));
  const frequency = optionalText(formData.get("frequency"));

  if (!patientId || !name) return;

  await withAuth(session.user.id, async (tx) => {
    await tx.insert(patientMedications).values({
      patientId,
      name,
      dose,
      route,
      frequency,
    });
  });

  revalidatePatient(patientId);
}

export async function addVital(formData: FormData) {
  const { data: session } = await auth.getSession();
  if (!session?.user) return;

  const patientId = optionalText(formData.get("patientId"));
  if (!patientId) return;

  const bpSystolic = optionalInt(formData.get("bpSystolic"));
  const bpDiastolic = optionalInt(formData.get("bpDiastolic"));
  const heartRate = optionalInt(formData.get("heartRate"));
  const respRate = optionalInt(formData.get("respRate"));
  const tempC = optionalFloat(formData.get("tempC"));
  const spo2 = optionalInt(formData.get("spo2"));
  const weightKg = optionalFloat(formData.get("weightKg"));

  const hasAny =
    bpSystolic !== null ||
    bpDiastolic !== null ||
    heartRate !== null ||
    respRate !== null ||
    tempC !== null ||
    spo2 !== null ||
    weightKg !== null;

  if (!hasAny) return;

  await withAuth(session.user.id, async (tx) => {
    await tx.insert(patientVitals).values({
      patientId,
      bpSystolic,
      bpDiastolic,
      heartRate,
      respRate,
      tempC,
      spo2,
      weightKg,
    });
  });

  revalidatePatient(patientId);
}
