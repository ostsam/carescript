import { auth } from "@/lib/auth/server";
import { withAuth } from "@/lib/db";
import {
  clinicalNotes,
  transcripts,
  patients,
  nurses,
} from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { redirect } from "next/navigation";
import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  CheckListIcon,
  Mic01Icon,
} from "@hugeicons/core-free-icons";
import { Card, CardContent } from "@/components/ui/card";
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

export default async function ReviewPage() {
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
        interactionType: transcripts.interactionType,
        patientFirstName: patients.patientFirstName,
        patientLastName: patients.patientLastName,
        nurseFirstName: nurses.nurseFirstName,
        nurseLastName: nurses.nurseLastName,
      })
      .from(clinicalNotes)
      .innerJoin(transcripts, eq(clinicalNotes.transcriptId, transcripts.id))
      .innerJoin(patients, eq(transcripts.patientId, patients.id))
      .innerJoin(nurses, eq(transcripts.nurseId, nurses.id))
      .orderBy(desc(clinicalNotes.createdAt));
  });

  const draftCount = rows.filter((r) => r.status === "Draft").length;

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between pt-4">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold tracking-tight">
            Review Queue
          </h1>
          <Badge variant="secondary" className="tabular-nums">
            {rows.length}
          </Badge>
          {draftCount > 0 && (
            <Badge variant="outline" className="tabular-nums">
              {draftCount} pending
            </Badge>
          )}
        </div>
      </div>

      {/* Content */}
      {rows.length > 0 ? (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Patient</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Note Preview</TableHead>
                  <TableHead>Nurse</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => {
                  const initials =
                    (row.patientFirstName[0] ?? "") +
                    (row.patientLastName[0] ?? "");

                  return (
                    <TableRow key={row.noteId}>
                      <TableCell>
                        <Link
                          href={`/dashboard/review/${row.noteId}`}
                          className="flex items-center gap-3 hover:underline"
                        >
                          <Avatar size="sm">
                            <AvatarFallback className="text-[10px] font-medium">
                              {initials.toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-medium">
                            {row.patientFirstName} {row.patientLastName}
                          </span>
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            row.status === "Draft" ? "outline" : "default"
                          }
                        >
                          {row.status === "Approved_by_Nurse"
                            ? "Approved"
                            : "Draft"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            row.interactionType === "Intervention"
                              ? "default"
                              : "secondary"
                          }
                        >
                          {row.interactionType}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-xs truncate text-muted-foreground text-xs">
                        {row.subjectiveText
                          ? (row.subjectiveText.slice(0, 100) +
                            (row.subjectiveText.length > 100 ? "…" : ""))
                          : (
                            <span className="italic">No content yet</span>
                          )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {row.nurseFirstName} {row.nurseLastName}
                      </TableCell>
                      <TableCell className="text-muted-foreground whitespace-nowrap">
                        {relativeDate(row.createdAt)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        <EmptyState />
      )}
    </>
  );
}

function EmptyState() {
  return (
    <Card>
      <CardContent>
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 mb-4">
            <HugeiconsIcon
              icon={CheckListIcon}
              size={24}
              className="text-primary"
            />
          </div>
          <h3 className="text-base font-medium">No clinical notes yet</h3>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Clinical notes will appear here once sessions have been recorded and
            the AI pipeline generates SOAP notes for review.
          </p>
          <Button
            className="mt-5 rounded-full shadow-sm shadow-primary/25"
            asChild
          >
            <Link href="/dashboard/sessions/new">
              <HugeiconsIcon icon={Mic01Icon} data-icon="inline-start" />
              Start a Session
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
