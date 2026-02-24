"use server";

import { auth } from "@/lib/auth/server";
import { withAuth } from "@/lib/db";
import { clinicalNotes } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

interface SoapFields {
	subjectiveText: string | null;
	objectiveText: string | null;
	assessmentText: string | null;
	planText: string | null;
}

type ActionResult = { success: true } | { success: false; error: string };

export async function updateNote(
	noteId: string,
	fields: SoapFields,
): Promise<ActionResult> {
	const { data: session } = await auth.getSession();
	if (!session?.user) {
		return { success: false, error: "Not authenticated" };
	}

	if (!noteId) {
		return { success: false, error: "Note ID is required" };
	}

	await withAuth(session.user.id, async (tx) => {
		await tx
			.update(clinicalNotes)
			.set({
				subjectiveText: fields.subjectiveText,
				objectiveText: fields.objectiveText,
				assessmentText: fields.assessmentText,
				planText: fields.planText,
			})
			.where(eq(clinicalNotes.id, noteId));
	});

	revalidatePath("/dashboard/review");
	return { success: true };
}

export async function approveNote(
	noteId: string,
	fields: SoapFields,
): Promise<ActionResult> {
	const { data: session } = await auth.getSession();
	if (!session?.user) {
		return { success: false, error: "Not authenticated" };
	}

	if (!noteId) {
		return { success: false, error: "Note ID is required" };
	}

	await withAuth(session.user.id, async (tx) => {
		await tx
			.update(clinicalNotes)
			.set({
				subjectiveText: fields.subjectiveText,
				objectiveText: fields.objectiveText,
				assessmentText: fields.assessmentText,
				planText: fields.planText,
				status: "Approved_by_Nurse",
			})
			.where(eq(clinicalNotes.id, noteId));
	});

	revalidatePath("/dashboard/review");
	revalidatePath("/dashboard");
	return { success: true };
}
