import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import { elevenlabs } from "@/lib/elevenlabs/client";

if (!process.env.ELEVENLABS_AGENT_ID) {
    throw new Error("ELEVENLABS_AGENT_ID is not set");
}

const AGENT_ID = process.env.ELEVENLABS_AGENT_ID;

export async function POST(request: Request) {
    // Require authenticated nurse session
    const { data: session } = await auth.getSession();
    if (!session?.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { patientFirstName, nurseFirstName, lovedOneRelation, voiceId } = body as {
        patientFirstName: string;
        nurseFirstName: string;
        lovedOneRelation: string;
        voiceId: string | null;
    };

    if (!patientFirstName || !nurseFirstName || !lovedOneRelation) {
        return NextResponse.json(
            { error: "Missing required patient context fields" },
            { status: 400 },
        );
    }

    console.log(`[ElevenLabs] Generating signed URL for nurse: ${session.user.id}, patient: ${patientFirstName}`);

    try {
        // Generate a signed URL — expires in 15 minutes, never exposes the API key to the client
        const response = await (elevenlabs as any).conversationalAi.agents.getSignedUrl({
            agentId: AGENT_ID,
        });

        const signedUrl: string = response.signedUrl ?? response.signed_url;

        if (!signedUrl) {
            throw new Error("ElevenLabs did not return a signed URL");
        }

        console.log(`[ElevenLabs] Signed URL successfully generated for intervention`);

        return NextResponse.json({ signedUrl });
    } catch (err) {
        console.error("[ElevenLabs] Failed to generate signed URL:", err);
        return NextResponse.json(
            { error: "Failed to initialize intervention agent" },
            { status: 500 },
        );
    }
}
