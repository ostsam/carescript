import { auth } from "@/lib/auth/server";
import { withAuth } from "@/lib/db";
import { clinicalNotes, transcripts, patients, nurses } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import {
	ArrowLeft01Icon,
	Mic01Icon,
	Calendar03Icon,
	Stethoscope02Icon,
} from "@hugeicons/core-free-icons";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { NoteEditor } from "../[id]/note-editor";

function relativeDate(date: Date): string {
	const now = new Date();
	const diffMs = now.getTime() - date.getTime();
	const diffMin = Math.floor(diffMs / (1000 * 60));
	const diffHr = Math.floor(diffMin / 60);
	const diffDays = Math.floor(diffHr / 24);

	if (diffDays > 30)
		return date.toLocaleDateString("en-US", {
			month: "short",
			day: "numeric",
			year: "numeric",
		});
	if (diffDays > 0) return `${diffDays}d ago`;
	if (diffHr > 0) return `${diffHr}h ago`;
	if (diffMin > 0) return `${diffMin}m ago`;
	return "Just now";
}

function formatDate(date: Date): string {
	return (
		date.toLocaleDateString("en-US", {
			weekday: "long",
			month: "long",
			day: "numeric",
			year: "numeric",
		}) +
		" at " +
		date.toLocaleTimeString("en-US", {
			hour: "numeric",
			minute: "2-digit",
		})
	);
}

interface Props {
	params: Promise<{ id: string }>;
}

export default async function ReviewDetailPage({ params }: Props) {
	const { id } = await params;
	const { data: session } = await auth.getSession();

	if (!session?.user) {
		redirect("/auth/sign-in");
	}

	const rows = await withAuth(session.user.id, async (tx) => {
		return tx
			.select({
				noteId: clinicalNotes.id,
				status: clinicalNotes.status,
				createdAt: clinicalNotes.createdAt,
				subjectiveText: clinicalNotes.subjectiveText,
				objectiveText: clinicalNotes.objectiveText,
				assessmentText: clinicalNotes.assessmentText,
				planText: clinicalNotes.planText,
				transcriptId: transcripts.id,
				rawTranscript: transcripts.rawTranscript,
				interactionType: transcripts.interactionType,
				sessionTimestamp: transcripts.timestamp,
				patientId: patients.id,
				patientFirstName: patients.patientFirstName,
				patientLastName: patients.patientLastName,
				nurseFirstName: nurses.nurseFirstName,
				nurseLastName: nurses.nurseLastName,
			})
			.from(clinicalNotes)
			.innerJoin(transcripts, eq(clinicalNotes.transcriptId, transcripts.id))
			.innerJoin(patients, eq(transcripts.patientId, patients.id))
			.innerJoin(nurses, eq(transcripts.nurseId, nurses.id))
			.where(eq(clinicalNotes.id, id))
			.limit(1);
	});

	const row = rows[0];
	if (!row) {
		notFound();
	}

	const initials =
		(row.patientFirstName[0] ?? "") + (row.patientLastName[0] ?? "");
	const isDraft = row.status === "Draft";

	return (
		<>
			{/* Back link */}
			<div className="pt-4">
				<Button variant="ghost" size="sm" asChild className="-ml-2">
					<Link href="/dashboard/review">
						<HugeiconsIcon icon={ArrowLeft01Icon} data-icon="inline-start" />
						All Notes
					</Link>
				</Button>
			</div>

			{/* Header card */}
			<Card>
				<CardContent className="flex items-start gap-5 pt-6">
					<Avatar size="lg">
						<AvatarFallback className="text-base font-semibold">
							{initials.toUpperCase()}
						</AvatarFallback>
					</Avatar>
					<div className="flex-1 space-y-1">
						<div className="flex items-center gap-2">
							<h1 className="text-xl font-semibold tracking-tight">
								{row.patientFirstName} {row.patientLastName}
							</h1>
							<Badge
								variant={
									row.interactionType === "Intervention"
										? "default"
										: "secondary"
								}
							>
								{row.interactionType}
							</Badge>
							<Badge variant={isDraft ? "outline" : "default"}>
								{isDraft ? "Draft" : "Approved"}
							</Badge>
						</div>
						<div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
							<span className="flex items-center gap-1.5">
								<HugeiconsIcon icon={Stethoscope02Icon} size={14} />
								{row.nurseFirstName} {row.nurseLastName}
							</span>
							<span className="flex items-center gap-1.5">
								<HugeiconsIcon icon={Calendar03Icon} size={14} />
								{formatDate(row.sessionTimestamp)}
							</span>
							<Link
								href={`/dashboard/sessions/${row.transcriptId}`}
								className="flex items-center gap-1.5 text-primary hover:underline"
							>
								<HugeiconsIcon icon={Mic01Icon} size={14} />
								View Session
							</Link>
						</div>
					</div>
					<Button variant="outline" size="sm" className="rounded-full" asChild>
						<Link href={`/dashboard/patients/${row.patientId}`}>
							View Patient
						</Link>
					</Button>
				</CardContent>
			</Card>

			{/* SOAP editor (client component) */}
			<NoteEditor
				noteId={row.noteId}
				isDraft={isDraft}
				subjectiveText={row.subjectiveText}
				objectiveText={row.objectiveText}
				assessmentText={row.assessmentText}
				planText={row.planText}
				createdAt={relativeDate(row.createdAt)}
			/>

			{/* Transcript reference */}
			<Card>
				<CardHeader>
					<div className="flex items-center gap-2">
						<HugeiconsIcon
							icon={Mic01Icon}
							size={18}
							className="text-muted-foreground"
						/>
						<CardTitle>Transcript Reference</CardTitle>
					</div>
					<CardDescription>
						Recorded {relativeDate(row.sessionTimestamp)}
					</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="whitespace-pre-wrap rounded-lg bg-muted/50 p-4 text-sm leading-relaxed font-mono">
						{row.rawTranscript}
					</div>
				</CardContent>
			</Card>
		</>
	);
}
