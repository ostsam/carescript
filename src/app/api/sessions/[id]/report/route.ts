import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import { withAuth } from "@/lib/db";
import { transcripts, clinicalNotes, patients } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const CLINICAL_NOTE_PROMPT = `You are a clinical documentation specialist working with a registered nurse. You will be given a raw, diarized transcript of a patient interaction. Your task is to generate a structured clinical note in SOAP format.

INSTRUCTIONS:
1. Read the full transcript carefully.
2. Identify the patient's subjective complaints, observations about their state, clinical assessments made by the nurse, and any care plan actions discussed or taken.
3. Write a concise, professional clinical note. Use medical terminology appropriately. Do NOT invent information not present in the transcript.
4. If an ElevenLabs intervention was mentioned (loved-one voice call), document it under Plan as "Behavioral de-escalation via loved-one voice intervention initiated."
5. Output ONLY the four sections below. No preamble, no explanation, no markdown headers — just the labeled sections.

FORMAT (output exactly this structure):
SUBJECTIVE:
[Patient's reported symptoms, complaints, mood, and statements in their own words or paraphrased]

OBJECTIVE:
[Observable facts: nurse's clinical observations, behaviors noted, vital signs mentioned if any]

ASSESSMENT:
[Nurse's clinical judgment about the patient's condition and behavioral status]

PLAN:
[Actions taken or recommended: medications administered, care actions, interventions, follow-up]`;

export async function POST(
    _request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { data: session } = await auth.getSession();
    if (!session?.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: transcriptId } = await params;

    if (!transcriptId) {
        return NextResponse.json({ error: "Missing transcript ID" }, { status: 400 });
    }

    // Fetch the transcript + patient info in one query
    const rows = await withAuth(session.user.id, async (tx) => {
        return tx
            .select({
                rawTranscript: transcripts.rawTranscript,
                interactionType: transcripts.interactionType,
                patientFirstName: patients.patientFirstName,
                patientLastName: patients.patientLastName,
            })
            .from(transcripts)
            .innerJoin(patients, eq(transcripts.patientId, patients.id))
            .where(eq(transcripts.id, transcriptId))
            .limit(1);
    });

    const row = rows[0];
    if (!row) {
        return NextResponse.json({ error: "Transcript not found" }, { status: 404 });
    }

    // Check for existing note to avoid duplicates
    const existingNotes = await withAuth(session.user.id, async (tx) => {
        return tx
            .select({ id: clinicalNotes.id })
            .from(clinicalNotes)
            .where(eq(clinicalNotes.transcriptId, transcriptId))
            .limit(1);
    });

    if (existingNotes.length > 0) {
        return NextResponse.json(
            { error: "Clinical note already exists for this session" },
            { status: 409 }
        );
    }

    const contextHeader = `Patient: ${row.patientFirstName} ${row.patientLastName}\nSession Type: ${row.interactionType}\n\nTRANSCRIPT:\n${row.rawTranscript}`;

    try {
        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            temperature: 0.2,
            messages: [
                { role: "system", content: CLINICAL_NOTE_PROMPT },
                { role: "user", content: contextHeader },
            ],
        });

        const raw = completion.choices[0]?.message?.content ?? "";

        // Parse the four SOAP sections from the response
        const extract = (label: string): string | null => {
            const regex = new RegExp(
                `(?:\\*\\*)?${label}:(?:\\*\\*)?\\s*([\\s\\S]*?)(?=\\n(?:\\*\\*)?(?:SUBJECTIVE|OBJECTIVE|ASSESSMENT|PLAN):(?:\\*\\*)?|$)`,
                "i"
            );
            return regex.exec(raw)?.[1]?.trim() ?? null;
        };

        const subjectiveText = extract("SUBJECTIVE");
        const objectiveText = extract("OBJECTIVE");
        const assessmentText = extract("ASSESSMENT");
        const planText = extract("PLAN");

        // Persist to clinicalNotes table
        const [inserted] = await withAuth(session.user.id, async (tx) => {
            return tx
                .insert(clinicalNotes)
                .values({
                    transcriptId,
                    subjectiveText,
                    objectiveText,
                    assessmentText,
                    planText,
                    status: "Draft",
                })
                .returning({
                    id: clinicalNotes.id,
                    status: clinicalNotes.status,
                });
        });

        return NextResponse.json({
            noteId: inserted.id,
            status: inserted.status,
            soap: { subjectiveText, objectiveText, assessmentText, planText },
        });
    } catch (err) {
        console.error("[Report] OpenAI generation failed:", err);
        return NextResponse.json(
            { error: "Failed to generate clinical note" },
            { status: 500 }
        );
    }
}
