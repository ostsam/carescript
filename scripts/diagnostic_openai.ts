import OpenAI from "openai";
import * as dotenv from "dotenv";

dotenv.config();

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!OPENAI_API_KEY) {
    console.error("❌ OPENAI_API_KEY is missing from environment");
    process.exit(1);
}

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

const MOCK_TRANSCRIPT = `
Speaker 1 (Nurse): Hi Dorothy, how are you feeling today?
Speaker 2 (Patient): I'm a bit tired, and my leg hurts where I had the surgery.
Speaker 1 (Nurse): I'm sorry to hear that. I've got your medication here to help with the pain.
Speaker 2 (Patient): Thank you. I also felt a bit dizzy earlier when I stood up.
Speaker 1 (Nurse): That's important to note. I'll check your blood pressure now. 118 over 75, that's normal. I'll make sure to document the dizziness for the doctor.
`;

const CLINICAL_NOTE_PROMPT = `You are a clinical documentation specialist working with a registered nurse. You will be given a raw, diarized transcript of a patient interaction. Your task is to generate a structured clinical note in SOAP format.

FORMAT (output exactly this structure):
SUBJECTIVE:
[Content]

OBJECTIVE:
[Content]

ASSESSMENT:
[Content]

PLAN:
[Content]`;

async function testOpenAI() {
    console.log("🚀 Starting OpenAI Clinical Note Diagnostics...\n");

    try {
        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            temperature: 0.2,
            messages: [
                { role: "system", content: CLINICAL_NOTE_PROMPT },
                { role: "user", content: `Patient: Dorothy Bennett\n\nTRANSCRIPT:\n${MOCK_TRANSCRIPT}` },
            ],
        });

        const raw = completion.choices[0]?.message?.content ?? "";
        console.log("✅ SUCCESS: OpenAI returned a response.\n");
        console.log("--- GENERATED NOTE ---");
        console.log(raw);
        console.log("----------------------\n");

        // Test the parsing logic used in the API route
        const extract = (label: string): string | null => {
            const regex = new RegExp(
                `(?:\\*\\*)?${label}:(?:\\*\\*)?\\s*([\\s\\S]*?)(?=\\n(?:\\*\\*)?(?:SUBJECTIVE|OBJECTIVE|ASSESSMENT|PLAN):(?:\\*\\*)?|$)`,
                "i"
            );
            return regex.exec(raw)?.[1]?.trim() ?? null;
        };

        const s = extract("SUBJECTIVE");
        const o = extract("OBJECTIVE");
        const a = extract("ASSESSMENT");
        const p = extract("PLAN");

        console.log("Parsing Check:");
        console.log(`- Subjective: ${s ? "✅ Found" : "❌ Missing"}`);
        console.log(`- Objective: ${o ? "✅ Found" : "❌ Missing"}`);
        console.log(`- Assessment: ${a ? "✅ Found" : "❌ Missing"}`);
        console.log(`- Plan: ${p ? "✅ Found" : "❌ Missing"}`);

    } catch (err: any) {
        console.log(`❌ CRASHED: ${err.message}`);
    }
}

testOpenAI();
