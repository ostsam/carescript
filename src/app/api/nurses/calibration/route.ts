import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import { withAuth } from "@/lib/db";
import { sql } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CalibrationRow = {
	calibration_audio_blob: Buffer | Uint8Array | null;
	calibration_audio_mime_type: string | null;
};

async function fetchCalibrationRow(userId: string) {
	return withAuth(userId, async (tx) => {
		const result = await tx.execute(sql<CalibrationRow>`
			SELECT calibration_audio_blob, calibration_audio_mime_type
			FROM nurses
			WHERE user_id = ${userId}
			LIMIT 1
		`);
		return (result.rows?.[0] as CalibrationRow | undefined) ?? null;
	});
}

export async function GET() {
	const { data: session } = await auth.getSession();
	if (!session?.user) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const row = await fetchCalibrationRow(session.user.id);
	if (!row?.calibration_audio_blob) {
		return new NextResponse(null, { status: 404 });
	}

	const mimeType = row.calibration_audio_mime_type || "application/octet-stream";
	const body =
		row.calibration_audio_blob instanceof Buffer
			? row.calibration_audio_blob
			: Buffer.from(row.calibration_audio_blob);

	return new NextResponse(body, {
		status: 200,
		headers: {
			"Content-Type": mimeType,
			"Cache-Control": "no-store",
		},
	});
}

export async function POST(req: NextRequest) {
	const { data: session } = await auth.getSession();
	if (!session?.user) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	let formData: FormData;
	try {
		formData = await req.formData();
	} catch {
		return NextResponse.json(
			{ error: "Expected multipart/form-data" },
			{ status: 400 },
		);
	}

	const audioField = formData.get("audio");
	if (!audioField || !(audioField instanceof Blob)) {
		return NextResponse.json(
			{ error: "audio field is required and must be a file" },
			{ status: 400 },
		);
	}

	const audioBuffer = Buffer.from(await audioField.arrayBuffer());
	const audioMimeType = audioField.type || "application/octet-stream";

	const result = await withAuth(session.user.id, async (tx) => {
		return tx.execute(sql`
			UPDATE nurses
			SET calibration_audio_blob = ${audioBuffer},
				calibration_audio_mime_type = ${audioMimeType},
				calibration_audio_storage_url = NULL
			WHERE user_id = ${session.user.id}
		`);
	});

	const updatedCount =
		(typeof result.rowCount === "number" && result.rowCount) ||
		(Array.isArray(result.rows) ? result.rows.length : 0);

	if (!updatedCount) {
		return NextResponse.json(
			{ error: "Could not find nurse record" },
			{ status: 404 },
		);
	}

	return NextResponse.json({ success: true });
}
