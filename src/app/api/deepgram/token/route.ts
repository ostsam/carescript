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

  console.log(`[Deepgram] Issuing token for user: ${session.user.id}`);

  const { result, error } = await deepgram.auth.grantToken({
    ttl_seconds: 3600,
  });

  if (error) {
    console.error("[Deepgram] Token grant error:", error);
    return NextResponse.json(
      { error: "Token generation failed" },
      { status: 502 },
    );
  }

  console.log(`[Deepgram] Token successfully issued for user: ${session.user.id}`);

  return NextResponse.json({
    token: result.access_token,
    expiresIn: result.expires_in,
  });
}
