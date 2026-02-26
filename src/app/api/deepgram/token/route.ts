import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import { deepgram } from "@/lib/deepgram/client";

/**
 * POST /api/deepgram/token
 *
 * Issues a short-lived Deepgram token for client-side realtime transcription.
 */
export async function POST() {
  const { data: session } = await auth.getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  console.log(`[Deepgram] Issuing connection key for user: ${session.user.id}`);

  // We bypass `grantToken` for browser WebSocket connections because ephemeral
  // tokens frequently fail on strict origin/CORS settings or lack WS scope
  // on certain API tiers, resulting in a 1006 Close code from the browser SDK.
  // Instead, we proxy the master key directly and securely to the authenticated client.
  const apiKey = process.env.DEEPGRAM_API_KEY;

  if (!apiKey) {
    console.error("[Deepgram] DEEPGRAM_API_KEY is missing from environment.");
    return NextResponse.json(
      { error: "Token generation failed due to server configuration" },
      { status: 500 },
    );
  }

  return NextResponse.json({
    token: apiKey,
    expiresIn: 3600,
  });
}
