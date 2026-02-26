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
        // Correct path for the current SDK version (2.36.0+)
        // Overrides will be handled on the client-side for better reliability
        const response = await elevenlabs.conversationalAi.conversations.getSignedUrl({
            agentId: AGENT_ID,
        });

        // The SDK returns ConversationSignedUrlResponseModel which has signedUrl
        const signedUrl = (response as any).signedUrl || (response as any).signed_url;

        if (!signedUrl) {
            console.error("[ElevenLabs] Invalid response data - missing signedUrl:", response);
            throw new Error("No signed URL in response");
        }

        console.log(`[ElevenLabs] Signed URL successfully generated for intervention`);

        return NextResponse.json({ signedUrl });
    } catch (error: any) {
        console.error("[ElevenLabs] Failed to generate signed URL:", error);
        return NextResponse.json(
            { error: error.message || "Failed to generate token" },
            { status: 500 }
        );
    }
}
