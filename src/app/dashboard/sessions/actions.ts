"use server";

import { auth } from "@/lib/auth/server";
import { withAuth } from "@/lib/db";
import { patients, nurses, transcripts } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export type PatientOption = {
  id: string;
  firstName: string;
  lastName: string;
  hasVoice: boolean;
  lovedOneRelation: string | null;
  elevenlabsVoiceId: string | null;
};

export async function getPatientList(): Promise<PatientOption[]> {
  const { data: session } = await auth.getSession();
  if (!session?.user) return [];

  const rows = await withAuth(session.user.id, async (tx) => {
    return tx
      .select({
        id: patients.id,
        firstName: patients.patientFirstName,
        lastName: patients.patientLastName,
        hasVoice: sql<boolean>`${patients.elevenlabsVoiceId} IS NOT NULL`,
        lovedOneRelation: patients.lovedOneRelation,
        elevenlabsVoiceId: patients.elevenlabsVoiceId,
      })
      .from(patients)
      .orderBy(patients.patientLastName, patients.patientFirstName);
  });

  return rows.map((r) => ({
    id: r.id,
    firstName: r.firstName,
    lastName: r.lastName,
    hasVoice: r.hasVoice,
    lovedOneRelation: r.lovedOneRelation ?? null,
    elevenlabsVoiceId: r.elevenlabsVoiceId ?? null,
  }));
}

type SaveSessionResult =
  | { success: true; sessionId: string }
  | { success: false; error: string };

export async function saveSession(
  patientId: string,
  interactionType: "Routine" | "Intervention",
  rawTranscript: string,
  audioBase64?: string | null,
  audioMimeType?: string | null,
): Promise<SaveSessionResult> {
  const { data: session } = await auth.getSession();

  if (!session?.user) {
    return { success: false, error: "Not authenticated" };
  }

  if (!patientId || !rawTranscript.trim()) {
    return { success: false, error: "Patient and transcript are required" };
  }

  const nurse = await withAuth(session.user.id, async (tx) => {
    const rows = await tx
      .select({ id: nurses.id })
      .from(nurses)
      .where(eq(nurses.userId, session.user.id))
      .limit(1);
    return rows[0] ?? null;
  });

  if (!nurse) {
    return { success: false, error: "Could not determine your nurse record" };
  }

  const audioBlob =
    audioBase64 && audioBase64.length > 0
      ? Buffer.from(audioBase64, "base64")
      : null;

  const [inserted] = await withAuth(session.user.id, async (tx) => {
    return tx
      .insert(transcripts)
      .values({
        patientId,
        nurseId: nurse.id,
        interactionType,
        rawTranscript: rawTranscript.trim(),
        audioBlob: audioBlob ?? undefined,
        audioMimeType: audioMimeType ?? undefined,
      })
      .returning({ id: transcripts.id });
  });

  revalidatePath("/dashboard/sessions");
  revalidatePath("/dashboard");
  return { success: true, sessionId: inserted.id };
}
