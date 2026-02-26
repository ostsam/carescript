import { auth } from "@/lib/auth/server";
import { withAuth } from "@/lib/db";
import {
  transcripts,
  patients,
  nurses,
  clinicalNotes,
} from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowLeft01Icon,
  Mic01Icon,
  NoteEditIcon,
  Calendar03Icon,
  UserLoveIcon,
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
import { Separator } from "@/components/ui/separator";
import { NotePoller } from "./note-poller";

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
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }) + " at " + date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

interface Props {
  params: Promise<{ id: string }>;
}

export default async function SessionDetailPage({ params }: Props) {
  const { id } = await params;
  const { data: session } = await auth.getSession();

  if (!session?.user) {
    redirect("/auth/sign-in");
  }

  const rows = await withAuth(session.user.id, async (tx) => {
    return tx
      .select({
        id: transcripts.id,
        interactionType: transcripts.interactionType,
        rawTranscript: transcripts.rawTranscript,
        timestamp: transcripts.timestamp,
        patientId: patients.id,
        patientFirstName: patients.patientFirstName,
        patientLastName: patients.patientLastName,
        lovedOneFirstName: patients.lovedOneFirstName,
        lovedOneLastName: patients.lovedOneLastName,
        nurseFirstName: nurses.nurseFirstName,
        nurseLastName: nurses.nurseLastName,
      })
      .from(transcripts)
      .innerJoin(patients, eq(transcripts.patientId, patients.id))
      .innerJoin(nurses, eq(transcripts.nurseId, nurses.id))
      .where(eq(transcripts.id, id))
      .limit(1);
  });

  const row = rows[0];
  if (!row) {
    notFound();
  }

  const noteRows = await withAuth(session.user.id, async (tx) => {
    return tx
      .select()
      .from(clinicalNotes)
      .where(eq(clinicalNotes.transcriptId, id))
      .orderBy(desc(clinicalNotes.createdAt));
  });

  const note = noteRows[0] ?? null;
  const initials =
    (row.patientFirstName[0] ?? "") + (row.patientLastName[0] ?? "");

  return (
    <>
      {/* Back link */}
      <div className="pt-4">
        <Button variant="ghost" size="sm" asChild className="-ml-2">
          <Link href="/dashboard/sessions">
            <HugeiconsIcon icon={ArrowLeft01Icon} data-icon="inline-start" />
            All Sessions
          </Link>
        </Button>
      </div>

      {/* Session header */}
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
              {note && (
                <Badge
                  variant={note.status === "Draft" ? "outline" : "default"}
                >
                  {note.status === "Approved_by_Nurse"
                    ? "Note Approved"
                    : "Note Draft"}
                </Badge>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <HugeiconsIcon icon={Stethoscope02Icon} size={14} />
                {row.nurseFirstName} {row.nurseLastName}
              </span>
              <span className="flex items-center gap-1.5">
                <HugeiconsIcon icon={Calendar03Icon} size={14} />
                {formatDate(row.timestamp)}
              </span>
              <span className="flex items-center gap-1.5">
                <HugeiconsIcon icon={UserLoveIcon} size={14} />
                {row.lovedOneFirstName} {row.lovedOneLastName}
              </span>
            </div>
          </div>
          <Button variant="outline" size="sm" className="rounded-full" asChild>
            <Link href={`/dashboard/patients/${row.patientId}`}>
              View Patient
            </Link>
          </Button>
        </CardContent>
      </Card>

      {/* Transcript */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <HugeiconsIcon
              icon={Mic01Icon}
              size={18}
              className="text-muted-foreground"
            />
            <CardTitle>Transcript</CardTitle>
          </div>
          <CardDescription>
            Recorded {relativeDate(row.timestamp)}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="whitespace-pre-wrap rounded-lg bg-muted/50 p-4 text-sm leading-relaxed font-mono">
            {row.rawTranscript}
          </div>
        </CardContent>
      </Card>

      {/* Clinical Note */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <HugeiconsIcon
              icon={NoteEditIcon}
              size={18}
              className="text-muted-foreground"
            />
            <CardTitle>Clinical Note</CardTitle>
          </div>
          <CardDescription>
            {note
              ? `Generated ${relativeDate(note.createdAt)} · ${note.status === "Approved_by_Nurse" ? "Approved" : "Draft"
              }`
              : "Note generation pending"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {note ? (
            <div className="space-y-4">
              <SoapSection label="Subjective" text={note.subjectiveText} />
              <Separator />
              <SoapSection label="Objective" text={note.objectiveText} />
              <Separator />
              <SoapSection label="Assessment" text={note.assessmentText} />
              <Separator />
              <SoapSection label="Plan" text={note.planText} />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="flex size-10 items-center justify-center rounded-full bg-muted mb-3">
                <HugeiconsIcon
                  icon={NoteEditIcon}
                  size={18}
                  className="text-muted-foreground"
                />
              </div>
              <p className="text-sm text-muted-foreground max-w-xs">
                The clinical note will be auto-generated once the AI pipeline is
                active. The raw transcript is saved above.
              </p>
              <NotePoller />
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}

function SoapSection({
  label,
  text,
}: {
  label: string;
  text: string | null;
}) {
  return (
    <div className="space-y-1">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </h3>
      <p className="text-sm leading-relaxed">
        {text || (
          <span className="text-muted-foreground italic">Not provided</span>
        )}
      </p>
    </div>
  );
}
