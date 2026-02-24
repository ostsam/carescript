import { auth } from "@/lib/auth/server";
import { withAuth } from "@/lib/db";
import {
  patients,
  transcripts,
  clinicalNotes,
  nurses,
} from "@/lib/db/schema";
import { eq, sql, desc } from "drizzle-orm";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowLeft01Icon,
  Mic01Icon,
  NoteEditIcon,
  Calendar03Icon,
  UserLoveIcon,
  VoiceIcon,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { VoiceCloneCard } from "./voice-clone-card";

function relativeDate(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays > 30)
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  if (diffDays > 0) return `${diffDays}d ago`;
  const diffHr = Math.floor(diffMs / (1000 * 60 * 60));
  if (diffHr > 0) return `${diffHr}h ago`;
  const diffMin = Math.floor(diffMs / (1000 * 60));
  if (diffMin > 0) return `${diffMin}m ago`;
  return "Just now";
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

interface Props {
  params: Promise<{ id: string }>;
}

export default async function PatientProfilePage({ params }: Props) {
  const { id } = await params;
  const { data: session } = await auth.getSession();

  if (!session?.user) {
    redirect("/auth/sign-in");
  }

  const [patient] = await withAuth(session.user.id, async (tx) => {
    return tx
      .select()
      .from(patients)
      .where(eq(patients.id, id))
      .limit(1);
  });

  if (!patient) {
    notFound();
  }

  const sessionRows = await withAuth(session.user.id, async (tx) => {
    return tx
      .select({
        id: transcripts.id,
        interactionType: transcripts.interactionType,
        rawTranscript: transcripts.rawTranscript,
        timestamp: transcripts.timestamp,
        nurseFirstName: nurses.nurseFirstName,
        nurseLastName: nurses.nurseLastName,
      })
      .from(transcripts)
      .leftJoin(nurses, eq(transcripts.nurseId, nurses.id))
      .where(eq(transcripts.patientId, id))
      .orderBy(desc(transcripts.timestamp));
  });

  const noteRows = await withAuth(session.user.id, async (tx) => {
    return tx
      .select({
        id: clinicalNotes.id,
        status: clinicalNotes.status,
        subjectiveText: clinicalNotes.subjectiveText,
        createdAt: clinicalNotes.createdAt,
        transcriptId: clinicalNotes.transcriptId,
        interactionType: transcripts.interactionType,
        timestamp: transcripts.timestamp,
      })
      .from(clinicalNotes)
      .innerJoin(transcripts, eq(clinicalNotes.transcriptId, transcripts.id))
      .where(eq(transcripts.patientId, id))
      .orderBy(desc(clinicalNotes.createdAt));
  });

  const initials =
    (patient.patientFirstName[0] ?? "") + (patient.patientLastName[0] ?? "");
  const lovedOneName = `${patient.lovedOneFirstName} ${patient.lovedOneLastName}`;

  return (
    <>
      {/* Back link */}
      <div className="pt-4">
        <Button variant="ghost" size="sm" asChild className="-ml-2">
          <Link href="/dashboard/patients">
            <HugeiconsIcon icon={ArrowLeft01Icon} data-icon="inline-start" />
            All Patients
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
            <h1 className="text-xl font-semibold tracking-tight">
              {patient.patientFirstName} {patient.patientLastName}
            </h1>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <HugeiconsIcon icon={UserLoveIcon} size={14} />
                {lovedOneName}
                <Badge variant="outline" className="ml-1 text-[10px] capitalize">
                  {patient.lovedOneRelation}
                </Badge>
              </span>
              <span className="flex items-center gap-1.5">
                <HugeiconsIcon icon={Calendar03Icon} size={14} />
                Added {formatDate(patient.createdAt)}
              </span>
              <span className="flex items-center gap-1.5">
                <HugeiconsIcon icon={VoiceIcon} size={14} />
                Voice:{" "}
                {patient.elevenlabsVoiceId ? (
                  <Badge variant="default" className="bg-emerald-600 text-white text-[10px]">
                    Active
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-muted-foreground text-[10px]">
                    Not set
                  </Badge>
                )}
              </span>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="rounded-full" asChild>
              <Link href={`/dashboard/sessions/new?patientId=${patient.id}`}>
                <HugeiconsIcon icon={Mic01Icon} data-icon="inline-start" />
                New Session
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Sessions */}
      <Card>
        <CardHeader>
          <CardTitle>Sessions</CardTitle>
          <CardDescription>
            {sessionRows.length > 0
              ? `${sessionRows.length} session${sessionRows.length !== 1 ? "s" : ""} recorded`
              : "No sessions recorded yet"}
          </CardDescription>
        </CardHeader>
        <CardContent className={sessionRows.length > 0 ? "p-0 pt-0" : undefined}>
          {sessionRows.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Nurse</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="max-w-xs">Transcript Preview</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sessionRows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <Badge
                        variant={row.interactionType === "Intervention" ? "default" : "secondary"}
                      >
                        {row.interactionType}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {row.nurseFirstName} {row.nurseLastName}
                    </TableCell>
                    <TableCell className="text-muted-foreground whitespace-nowrap">
                      {relativeDate(row.timestamp)}
                    </TableCell>
                    <TableCell className="max-w-xs truncate text-muted-foreground text-xs">
                      {row.rawTranscript.slice(0, 120)}
                      {row.rawTranscript.length > 120 ? "…" : ""}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="flex size-10 items-center justify-center rounded-full bg-muted mb-3">
                <HugeiconsIcon icon={Mic01Icon} size={18} className="text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">
                Start an ambient scribe session with this patient to see transcripts here.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Clinical Notes */}
      <Card>
        <CardHeader>
          <CardTitle>Clinical Notes</CardTitle>
          <CardDescription>
            {noteRows.length > 0
              ? `${noteRows.length} note${noteRows.length !== 1 ? "s" : ""} generated`
              : "No clinical notes yet"}
          </CardDescription>
        </CardHeader>
        <CardContent className={noteRows.length > 0 ? "p-0 pt-0" : undefined}>
          {noteRows.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>Session Type</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="max-w-xs">Subjective</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {noteRows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <Badge variant={row.status === "Draft" ? "outline" : "default"}>
                        {row.status === "Approved_by_Nurse" ? "Approved" : row.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={row.interactionType === "Intervention" ? "default" : "secondary"}
                      >
                        {row.interactionType}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground whitespace-nowrap">
                      {relativeDate(row.createdAt)}
                    </TableCell>
                    <TableCell className="max-w-xs truncate text-muted-foreground text-xs">
                      {row.subjectiveText
                        ? row.subjectiveText.slice(0, 100) +
                          (row.subjectiveText.length > 100 ? "…" : "")
                        : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="flex size-10 items-center justify-center rounded-full bg-muted mb-3">
                <HugeiconsIcon icon={NoteEditIcon} size={18} className="text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">
                Clinical notes are auto-generated after each session.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Voice */}
      <Card>
        <CardHeader>
          <CardTitle>Voice Clone</CardTitle>
          <CardDescription>
            {patient.elevenlabsVoiceId
              ? `A cloned voice for ${lovedOneName} is active and ready for interventions.`
              : `No voice clone set up for ${lovedOneName} yet.`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <VoiceCloneCard
            patientId={patient.id}
            patientFirstName={patient.patientFirstName}
            patientLastName={patient.patientLastName}
            lovedOneFirstName={patient.lovedOneFirstName}
            lovedOneLastName={patient.lovedOneLastName}
            lovedOneRelation={patient.lovedOneRelation}
            voiceId={patient.elevenlabsVoiceId}
          />
        </CardContent>
      </Card>
    </>
  );
}
