"use server";

import { auth } from "@/lib/auth/server";
import { withAuth } from "@/lib/db";
import { patients, nurses } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

const VALID_RELATIONS = ["Spouse", "Son", "Daughter", "Sibling", "Friend", "Other"] as const;

type AddPatientResult =
  | { success: true; patientId: string }
  | { success: false; error: string };

export async function addPatient(formData: FormData): Promise<AddPatientResult> {
  const { data: session } = await auth.getSession();

  if (!session?.user) {
    return { success: false, error: "Not authenticated" };
  }

  const patientFirstName = formData.get("patientFirstName")?.toString().trim();
  const patientLastName = formData.get("patientLastName")?.toString().trim();
  const lovedOneFirstName = formData.get("lovedOneFirstName")?.toString().trim();
  const lovedOneLastName = formData.get("lovedOneLastName")?.toString().trim();
  const lovedOneRelation = formData.get("lovedOneRelation")?.toString().trim();

  if (!patientFirstName || !patientLastName) {
    return { success: false, error: "Patient first and last name are required" };
  }
  if (!lovedOneFirstName || !lovedOneLastName) {
    return { success: false, error: "Loved one first and last name are required" };
  }
  if (!lovedOneRelation || !VALID_RELATIONS.includes(lovedOneRelation as typeof VALID_RELATIONS[number])) {
    return { success: false, error: "Please select a valid relation" };
  }

  const nurse = await withAuth(session.user.id, async (tx) => {
    const rows = await tx
      .select({ orgId: nurses.orgId })
      .from(nurses)
      .where(eq(nurses.userId, session.user.id))
      .limit(1);
    return rows[0] ?? null;
  });

  if (!nurse) {
    return { success: false, error: "Could not determine your organization" };
  }

  const [inserted] = await withAuth(session.user.id, async (tx) => {
    return tx.insert(patients).values({
      orgId: nurse.orgId,
      patientFirstName,
      patientLastName,
      lovedOneFirstName,
      lovedOneLastName,
      lovedOneRelation,
    }).returning({ id: patients.id });
  });

  revalidatePath("/dashboard/patients");
  revalidatePath("/dashboard");
  return { success: true, patientId: inserted.id };
}

type UpdateVoiceResult =
  | { success: true }
  | { success: false; error: string };

export async function updatePatientVoice(
  patientId: string,
  voiceId: string,
): Promise<UpdateVoiceResult> {
  const { data: session } = await auth.getSession();

  if (!session?.user) {
    return { success: false, error: "Not authenticated" };
  }

  if (!patientId || !voiceId) {
    return { success: false, error: "Patient ID and Voice ID are required" };
  }

  await withAuth(session.user.id, async (tx) => {
    await tx
      .update(patients)
      .set({ elevenlabsVoiceId: voiceId })
      .where(eq(patients.id, patientId));
  });

  revalidatePath("/dashboard/patients");
  return { success: true };
}
