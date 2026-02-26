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
    const { patientFirstName, nurseFirstName, lovedOneRelation, voiceId, connectionType } = body as {
        patientFirstName: string;
        nurseFirstName: string;
        lovedOneRelation: string;
        voiceId: string | null;
        connectionType?: "webrtc" | "websocket";
    };

    if (!patientFirstName || !nurseFirstName || !lovedOneRelation) {
        return NextResponse.json(
            { error: "Missing required patient context fields" },
            { status: 400 },
        );
    }

    const resolvedConnectionType = connectionType === "websocket" ? "websocket" : "webrtc";
    console.log(`[ElevenLabs] Generating ${resolvedConnectionType} auth for nurse: ${session.user.id}, patient: ${patientFirstName}`);

    try {
        if (resolvedConnectionType === "websocket") {
            const response = await elevenlabs.conversationalAi.conversations.getSignedUrl({
                agentId: AGENT_ID,
            });

            const signedUrl = (response as any).signedUrl || (response as any).signed_url;
            if (!signedUrl) {
                console.error("[ElevenLabs] Invalid response data - missing signedUrl:", response);
                throw new Error("No signed URL in response");
            }

            console.log(`[ElevenLabs] Signed URL successfully generated for intervention`);
            return NextResponse.json({ signedUrl, connectionType: "websocket" });
        }

        const response = await elevenlabs.conversationalAi.conversations.getWebrtcToken({
            agentId: AGENT_ID,
            participantName: session.user.id,
        });

        const token = (response as any).token;

        if (!token) {
            console.error("[ElevenLabs] Invalid response data - missing token:", response);
            throw new Error("No token in response");
        }

        console.log(`[ElevenLabs] WebRTC token successfully generated for intervention`);
        return NextResponse.json({ token, connectionType: "webrtc" });
    } catch (error: any) {
        console.error("[ElevenLabs] Failed to generate conversation auth:", error);
        return NextResponse.json(
            { error: error.message || "Failed to generate token" },
            { status: 500 }
        );
    }
}
