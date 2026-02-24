import { auth } from "@/lib/auth/server";
import { withAuth } from "@/lib/db";
import { patients, transcripts } from "@/lib/db/schema";
import { eq, sql, count } from "drizzle-orm";
import { redirect } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  PatientIcon,
  PlusSignIcon,
} from "@hugeicons/core-free-icons";
import {
  Card,
  CardContent,
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
import Link from "next/link";
import { AddPatientDialog } from "./add-patient-dialog";

function relativeDate(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHr / 24);

  if (diffDays > 30) return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  if (diffDays > 0) return `${diffDays}d ago`;
  if (diffHr > 0) return `${diffHr}h ago`;
  if (diffMin > 0) return `${diffMin}m ago`;
  return "Just now";
}

export default async function PatientsPage() {
  const { data: session } = await auth.getSession();

  if (!session?.user) {
    redirect("/auth/sign-in");
  }

  const patientRows = await withAuth(session.user.id, async (tx) => {
    return tx
      .select({
        id: patients.id,
        patientFirstName: patients.patientFirstName,
        patientLastName: patients.patientLastName,
        lovedOneFirstName: patients.lovedOneFirstName,
        lovedOneLastName: patients.lovedOneLastName,
        lovedOneRelation: patients.lovedOneRelation,
        elevenlabsVoiceId: patients.elevenlabsVoiceId,
        createdAt: patients.createdAt,
        sessionCount: count(transcripts.id),
      })
      .from(patients)
      .leftJoin(transcripts, eq(transcripts.patientId, patients.id))
      .groupBy(patients.id)
      .orderBy(sql`${patients.createdAt} DESC`);
  });

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between pt-4">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold tracking-tight">Patients</h1>
          <Badge variant="secondary" className="tabular-nums">
            {patientRows.length}
          </Badge>
        </div>
        <AddPatientDialog>
          <Button className="rounded-full shadow-sm shadow-primary/25">
            <HugeiconsIcon icon={PlusSignIcon} data-icon="inline-start" />
            Add Patient
          </Button>
        </AddPatientDialog>
      </div>

      {/* Content */}
      {patientRows.length > 0 ? (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Patient</TableHead>
                  <TableHead>Loved One</TableHead>
                  <TableHead className="text-center">Sessions</TableHead>
                  <TableHead>Voice</TableHead>
                  <TableHead>Added</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {patientRows.map((row) => {
                  const initials =
                    (row.patientFirstName[0] ?? "") +
                    (row.patientLastName[0] ?? "");

                  return (
                    <TableRow key={row.id}>
                      <TableCell>
                        <Link
                          href={`/dashboard/patients/${row.id}`}
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
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">
                            {row.lovedOneFirstName} {row.lovedOneLastName}
                          </span>
                          <Badge variant="outline" className="text-[10px] capitalize">
                            {row.lovedOneRelation}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="text-center tabular-nums">
                        {row.sessionCount}
                      </TableCell>
                      <TableCell>
                        {row.elevenlabsVoiceId ? (
                          <Badge variant="default" className="bg-emerald-600 text-white">
                            Active
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground">
                            Not set
                          </Badge>
                        )}
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
              icon={PatientIcon}
              size={24}
              className="text-primary"
            />
          </div>
          <h3 className="text-base font-medium">No patients yet</h3>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Add your first patient to start recording sessions and generating
            clinical notes.
          </p>
          <AddPatientDialog>
            <Button className="mt-5 rounded-full shadow-sm shadow-primary/25">
              <HugeiconsIcon icon={PlusSignIcon} data-icon="inline-start" />
              Add Your First Patient
            </Button>
          </AddPatientDialog>
        </div>
      </CardContent>
    </Card>
  );
}
