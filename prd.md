📄 Product Requirements Document: CareScript

Objective: A B2B, low-latency audio proxy that translates clinical nurse instructions into the cloned, emotionally resonant voice of a dementia patient's loved one, reducing "sundowning" agitation and caregiver burnout.
1. The Tech Stack

We are optimizing for execution speed, edge-ready performance, and strict data isolation.
Component	Technology	Rationale
Framework	Next.js 15 (TypeScript)	Server components for secure DB calls; API routes for the hydration pipeline.
Database	Neon (Serverless Postgres)	Connection pooling built-in (crucial for Next.js serverless functions) and fast branching for dev environments.
Authentication	Better Auth, easily integrates with Postgres, and supports custom session claims for Role-Based Access Control (RBAC).

⚠️ Implementation note — Authentication vs. Authorization:
The /api/elevenlabs/* routes currently enforce authentication (valid session required) but not full authorization. Two additional enforcement layers are pending the patients API:
  1. Role-based: voice cloning (create/delete) must be restricted to admin role only. Nurses should not be able to create or remove biometric voice clones.
  2. Org-based: TTS and voice delete must verify the requested voiceId belongs to a patient in the calling nurse's organization (nurses.org_id → patients.org_id). This prevents cross-facility access to cloned voices even for authenticated users.
  The DB RLS policies enforce org isolation at the data layer, but the ElevenLabs layer operates outside Postgres and requires explicit application-level checks. These checks require a join on nurses → patients and must be added once the patients CRUD API is in place.
Agentic Logic	VibeFlow	Handles the translation of clinical instructions to empathetic dialogue.
Audio Generation	ElevenLabs React SDK	Bypasses HTTP polling; uses WebSockets to stream chunked audio to the client in milliseconds.
PII Sanitization	aegis-shield (NPM)	Fast, zero-dependency tokenization to mask patient data before it hits the LLM.
State Management	Zustand	Manages the live audio chunk buffer without triggering infinite React re-renders.

2. Database Schema & Multi-Tenancy (Neon + Better Auth)

To prove enterprise viability, we must isolate data by facility (Organization). A nurse at "Sunrise Care" should never be able to query a patient ID from "Oakwood Senior Living." We enforce this at the database level using Postgres Row Level Security (RLS).

    
    organizations: id, name, created_at

    users: id, email, role (admin/nurse)

    nurses: id, user_id (FK), org_id (FK)

    patients: id, org_id (FK), first_name, loved_one_name, loved_one_relation, elevenlabs_voice_id (Nullable - only required for dementia patients)

    transcripts: id, patient_id (FK), nurse_id (FK), interaction_type (Enum: 'Routine', 'Intervention'), raw_transcript, timestamp

    clinical_notes (The Ambient Output): id, transcript_id (FK), subjective_text, objective_text, assessment_text, plan_text, status (Enum: 'Draft', 'Approved_by_Nurse')

The RLS Policy (The "Wow" factor for technical judges):
You implement a strict policy on the patients table so queries automatically filter based on the authenticated nurse's organization.
SQL

CREATE POLICY "nurse_org_isolation" ON patients 
FOR SELECT USING (
  org_id IN (SELECT org_id FROM nurses WHERE user_id = auth.uid())
);

3. The Pseudonymization Pipeline (The Core IP)

You cannot send raw patient names to VibeFlow. This pipeline is the technical flex that proves you understand healthcare compliance.

    Ingestion: The nurse speaks: "Mr. Smith needs his beta-blockers." (Converted to text via local browser Speech Recognition or a lightweight STT API).

    Tokenization (aegis-shield): Your Next.js backend intercepts the text. You configure aegis-shield to mask the identified name and swap it for a token.

        Output: "[PATIENT] needs his beta-blockers."

    Agentic Translation (VibeFlow): You send the sanitized string to VibeFlow with a strict system prompt: "You are the [RELATION]. Translate this clinical instruction into warm dialogue. Use the exact token [PATIENT] in the response."

        Output: `"Hey [PATIENT], the nurse said you need your beta-blockers..."*

    Hydration: The Next.js server receives the LLM output and runs a lightning-fast string replacement, swapping [PATIENT] back to the patient's preferred term of endearment (e.g., "Dad"), fetched from the Neon DB.

    Audio Stream: The fully hydrated string ("Hey Dad...") and the elevenlabs_voice_id are piped through the WebSocket to ElevenLabs, instantly playing the audio on the nurse's device.

4. The Dual-State Architecture

The system now operates in two distinct modes. Your Next.js backend and VibeFlow agents need to route the audio based on the nurse's intent.

    Mode 1: The Ambient Scribe (Default)

        The Action: The nurse puts the phone down in the room and conducts a routine check-up. The app passively listens.

        The Logic: The raw audio is transcribed and scrubbed of PII by aegis-shield. VibeFlow receives the transcript and is prompted to extract the medical facts and format them into a structured SOAP or BIRP clinical note.

        The Output: No ElevenLabs audio is generated. The structured text is saved directly to the Neon database for the nurse to review and approve.

    Mode 2: The Active Intervention (Crisis Override)

        The Action: A dementia patient becomes combative. The nurse taps a specific "Intervention" button on the UI and speaks a direct command ("Mr. Smith, please sit down").

        The Logic: The transcript is scrubbed, passed to VibeFlow for empathetic translation, hydrated with the patient's data, and piped directly to ElevenLabs.

        The Output: The app immediately speaks the cloned, calming voice of the loved one. The event is automatically logged in the patient's chart as a "Behavioral De-escalation Event."

5. The VibeFlow Agentic Routing

Since you are using VibeFlow, you don't need to write complex Python routing logic. You set up a primary "Triage Agent" in VibeFlow that looks at the incoming payload.

    If mode === 'ambient': The agent uses a specialized LLM prompt optimized for medical extraction. "Analyze this transcript. Extract the vital signs, patient complaints, and nurse instructions. Format strictly as a JSON object matching the SOAP methodology."

    If mode === 'intervention': The agent uses the emotional translation prompt. "You are [LOVED_ONE]. Translate this clinical command into a warm, familial request."