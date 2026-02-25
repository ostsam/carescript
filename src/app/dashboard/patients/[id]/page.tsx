import { auth } from "@/lib/auth/server";
import { withAuth } from "@/lib/db";
import {
  patients,
  transcripts,
  clinicalNotes,
  nurses,
  patientDiagnoses,
  patientAllergies,
  patientMedications,
  patientVitals,
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  updatePatientProfile,
  addDiagnosis,
  addAllergy,
  addMedication,
  addVital,
} from "./actions";

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

function formatShortDate(value?: Date | string | null): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateInput(value?: Date | string | null): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  return value.toISOString().slice(0, 10);
}

function formatValue(value?: string | null): string {
  if (!value) return "—";
  return value;
}

function formatVitals(row: {
  bpSystolic: number | null;
  bpDiastolic: number | null;
  heartRate: number | null;
  respRate: number | null;
  tempC: number | null;
  spo2: number | null;
  weightKg: number | null;
}): string {
  const parts: string[] = [];
  if (row.bpSystolic !== null && row.bpDiastolic !== null) {
    parts.push(`BP ${row.bpSystolic}/${row.bpDiastolic}`);
  }
  if (row.heartRate !== null) {
    parts.push(`HR ${row.heartRate}`);
  }
  if (row.respRate !== null) {
    parts.push(`RR ${row.respRate}`);
  }
  if (row.tempC !== null) {
    parts.push(`Temp ${row.tempC.toFixed(1)}°C`);
  }
  if (row.spo2 !== null) {
    parts.push(`SpO₂ ${row.spo2}%`);
  }
  if (row.weightKg !== null) {
    parts.push(`Wt ${row.weightKg.toFixed(1)}kg`);
  }
  return parts.length > 0 ? parts.join(" · ") : "—";
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

  const diagnosisRows = await withAuth(session.user.id, async (tx) => {
    return tx
      .select({
        id: patientDiagnoses.id,
        description: patientDiagnoses.description,
        icd10Code: patientDiagnoses.icd10Code,
        isPrimary: patientDiagnoses.isPrimary,
        createdAt: patientDiagnoses.createdAt,
      })
      .from(patientDiagnoses)
      .where(eq(patientDiagnoses.patientId, id))
      .orderBy(desc(patientDiagnoses.createdAt));
  });

  const allergyRows = await withAuth(session.user.id, async (tx) => {
    return tx
      .select({
        id: patientAllergies.id,
        substance: patientAllergies.substance,
        reaction: patientAllergies.reaction,
        severity: patientAllergies.severity,
        recordedAt: patientAllergies.recordedAt,
      })
      .from(patientAllergies)
      .where(eq(patientAllergies.patientId, id))
      .orderBy(desc(patientAllergies.recordedAt));
  });

  const medicationRows = await withAuth(session.user.id, async (tx) => {
    return tx
      .select({
        id: patientMedications.id,
        name: patientMedications.name,
        dose: patientMedications.dose,
        route: patientMedications.route,
        frequency: patientMedications.frequency,
        createdAt: patientMedications.createdAt,
      })
      .from(patientMedications)
      .where(eq(patientMedications.patientId, id))
      .orderBy(desc(patientMedications.createdAt));
  });

  const vitalRows = await withAuth(session.user.id, async (tx) => {
    return tx
      .select({
        id: patientVitals.id,
        measuredAt: patientVitals.measuredAt,
        bpSystolic: patientVitals.bpSystolic,
        bpDiastolic: patientVitals.bpDiastolic,
        heartRate: patientVitals.heartRate,
        respRate: patientVitals.respRate,
        tempC: patientVitals.tempC,
        spo2: patientVitals.spo2,
        weightKg: patientVitals.weightKg,
      })
      .from(patientVitals)
      .where(eq(patientVitals.patientId, id))
      .orderBy(desc(patientVitals.measuredAt))
      .limit(5);
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

      {/* Resident overview */}
      <Card>
        <CardHeader>
          <CardTitle>Resident Overview</CardTitle>
          <CardDescription>
            Key demographics, stay details, and billing context.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-[1.2fr_1fr]">
          <div className="grid gap-4 text-sm">
            <div className="grid gap-2">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Demographics
              </p>
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">DOB</span>
                <span className="font-medium">{formatShortDate(patient.dateOfBirth)}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">Sex</span>
                <span className="font-medium">{formatValue(patient.sex)}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">Code status</span>
                <span className="font-medium">{formatValue(patient.codeStatus)}</span>
              </div>
            </div>
            <div className="grid gap-2">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Stay
              </p>
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">Admit date</span>
                <span className="font-medium">{formatShortDate(patient.admitDate)}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">Room / Bed</span>
                <span className="font-medium">
                  {patient.roomLabel || patient.bedLabel
                    ? `${patient.roomLabel ?? "—"} / ${patient.bedLabel ?? "—"}`
                    : "—"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">Primary payor</span>
                <span className="font-medium">{formatValue(patient.primaryPayor)}</span>
              </div>
            </div>
          </div>
          <form
            action={updatePatientProfile.bind(null, patient.id)}
            className="grid gap-4 rounded-lg border bg-muted/20 p-4"
          >
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Quick Edit
              </p>
              <p className="text-xs text-muted-foreground">
                Update key resident details without leaving the page.
              </p>
            </div>
            <div className="grid gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="dateOfBirth">DOB</Label>
                  <Input
                    id="dateOfBirth"
                    name="dateOfBirth"
                    type="date"
                    defaultValue={formatDateInput(patient.dateOfBirth)}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="sex">Sex</Label>
                  <Input id="sex" name="sex" defaultValue={patient.sex ?? ""} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="codeStatus">Code status</Label>
                  <Input
                    id="codeStatus"
                    name="codeStatus"
                    defaultValue={patient.codeStatus ?? ""}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="admitDate">Admit date</Label>
                  <Input
                    id="admitDate"
                    name="admitDate"
                    type="date"
                    defaultValue={formatDateInput(patient.admitDate)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="roomLabel">Room</Label>
                  <Input
                    id="roomLabel"
                    name="roomLabel"
                    defaultValue={patient.roomLabel ?? ""}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="bedLabel">Bed</Label>
                  <Input
                    id="bedLabel"
                    name="bedLabel"
                    defaultValue={patient.bedLabel ?? ""}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="primaryPayor">Primary payor</Label>
                  <Input
                    id="primaryPayor"
                    name="primaryPayor"
                    defaultValue={patient.primaryPayor ?? ""}
                  />
                </div>
              </div>
            </div>
            <Button type="submit" size="sm" className="w-full">
              Save overview
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Clinical snapshot */}
      <Card>
        <CardHeader>
          <CardTitle>Clinical Snapshot</CardTitle>
          <CardDescription>
            Active diagnoses, allergies, medications, and recent vitals.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Diagnoses</h3>
              <Badge variant="secondary" className="text-[10px]">
                {diagnosisRows.length}
              </Badge>
            </div>
            {diagnosisRows.length > 0 ? (
              <div className="mt-3 grid gap-2">
                {diagnosisRows.map((row) => (
                  <div
                    key={row.id}
                    className="flex items-start justify-between gap-3 rounded-md border border-border/60 px-3 py-2 text-sm"
                  >
                    <div>
                      <div className="font-medium">{row.description}</div>
                      {row.icd10Code && (
                        <div className="text-xs text-muted-foreground">
                          ICD-10 {row.icd10Code}
                        </div>
                      )}
                    </div>
                    {row.isPrimary && (
                      <Badge variant="default" className="text-[10px]">
                        Primary
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-xs text-muted-foreground">
                No diagnoses recorded yet.
              </p>
            )}
            <form action={addDiagnosis} className="mt-4 grid gap-2">
              <input type="hidden" name="patientId" value={patient.id} />
              <div className="grid gap-2 sm:grid-cols-2">
                <Input name="description" placeholder="Diagnosis" required />
                <Input name="icd10Code" placeholder="ICD-10 (optional)" />
              </div>
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <input type="checkbox" name="isPrimary" />
                Primary diagnosis
              </label>
              <Button type="submit" size="sm" variant="secondary">
                Add diagnosis
              </Button>
            </form>
          </div>

          <div className="rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Allergies</h3>
              <Badge variant="secondary" className="text-[10px]">
                {allergyRows.length}
              </Badge>
            </div>
            {allergyRows.length > 0 ? (
              <div className="mt-3 grid gap-2">
                {allergyRows.map((row) => (
                  <div
                    key={row.id}
                    className="rounded-md border border-border/60 px-3 py-2 text-sm"
                  >
                    <div className="font-medium">{row.substance}</div>
                    <div className="text-xs text-muted-foreground">
                      {[row.reaction, row.severity].filter(Boolean).join(" · ") || "—"}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-xs text-muted-foreground">
                No allergies recorded yet.
              </p>
            )}
            <form action={addAllergy} className="mt-4 grid gap-2">
              <input type="hidden" name="patientId" value={patient.id} />
              <div className="grid gap-2 sm:grid-cols-2">
                <Input name="substance" placeholder="Substance" required />
                <Input name="reaction" placeholder="Reaction (optional)" />
              </div>
              <Input name="severity" placeholder="Severity (optional)" />
              <Button type="submit" size="sm" variant="secondary">
                Add allergy
              </Button>
            </form>
          </div>

          <div className="rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Medications</h3>
              <Badge variant="secondary" className="text-[10px]">
                {medicationRows.length}
              </Badge>
            </div>
            {medicationRows.length > 0 ? (
              <div className="mt-3 grid gap-2">
                {medicationRows.map((row) => (
                  <div
                    key={row.id}
                    className="rounded-md border border-border/60 px-3 py-2 text-sm"
                  >
                    <div className="font-medium">{row.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {[row.dose, row.route, row.frequency].filter(Boolean).join(" · ") || "—"}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-xs text-muted-foreground">
                No medications recorded yet.
              </p>
            )}
            <form action={addMedication} className="mt-4 grid gap-2">
              <input type="hidden" name="patientId" value={patient.id} />
              <Input name="name" placeholder="Medication name" required />
              <div className="grid gap-2 sm:grid-cols-3">
                <Input name="dose" placeholder="Dose" />
                <Input name="route" placeholder="Route" />
                <Input name="frequency" placeholder="Frequency" />
              </div>
              <Button type="submit" size="sm" variant="secondary">
                Add medication
              </Button>
            </form>
          </div>

          <div className="rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Vitals</h3>
              <Badge variant="secondary" className="text-[10px]">
                {vitalRows.length}
              </Badge>
            </div>
            {vitalRows.length > 0 ? (
              <div className="mt-3 grid gap-2 text-sm">
                {vitalRows.map((row) => (
                  <div
                    key={row.id}
                    className="rounded-md border border-border/60 px-3 py-2"
                  >
                    <div className="text-xs text-muted-foreground">
                      {formatShortDate(row.measuredAt)}
                    </div>
                    <div className="font-medium">{formatVitals(row)}</div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-xs text-muted-foreground">
                No vitals recorded yet.
              </p>
            )}
            <form action={addVital} className="mt-4 grid gap-2">
              <input type="hidden" name="patientId" value={patient.id} />
              <div className="grid gap-2 sm:grid-cols-2">
                <Input name="bpSystolic" placeholder="BP systolic" type="number" min="0" />
                <Input name="bpDiastolic" placeholder="BP diastolic" type="number" min="0" />
              </div>
              <div className="grid gap-2 sm:grid-cols-3">
                <Input name="heartRate" placeholder="HR" type="number" min="0" />
                <Input name="respRate" placeholder="RR" type="number" min="0" />
                <Input name="spo2" placeholder="SpO₂" type="number" min="0" />
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <Input name="tempC" placeholder="Temp °C" type="number" step="0.1" />
                <Input name="weightKg" placeholder="Weight kg" type="number" step="0.1" />
              </div>
              <Button type="submit" size="sm" variant="secondary">
                Add vitals
              </Button>
            </form>
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
