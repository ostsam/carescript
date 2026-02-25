import { auth } from "@/lib/auth/server";
import { withAuth } from "@/lib/db";
import {
  patients,
  transcripts,
  nurses,
  clinicalNotes,
} from "@/lib/db/schema";
import { and, count, desc, eq, gte, lt } from "drizzle-orm";
import { redirect } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  PatientIcon,
  Mic01Icon,
  CheckListIcon,
  CheckmarkCircle01Icon,
  PlusSignIcon,
  ArrowRight01Icon,
} from "@hugeicons/core-free-icons";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardAction,
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

export default async function DashboardPage() {
  const { data: session } = await auth.getSession();

  if (!session?.user) {
    redirect("/auth/sign-in");
  }

  const firstName = session.user.name?.split(" ")[0] ?? "there";
  const greeting = getGreeting();
  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(now);
  endOfDay.setHours(24, 0, 0, 0);

  const {
    patientCount,
    sessionsTodayCount,
    pendingReviewCount,
    approvedTodayCount,
    recentActivity,
  } = await withAuth(session.user.id, async (tx) => {
    const [patientTotal] = await tx
      .select({ total: count() })
      .from(patients);

    const [sessionsTodayTotal] = await tx
      .select({ total: count() })
      .from(transcripts)
      .where(
        and(
          gte(transcripts.timestamp, startOfDay),
          lt(transcripts.timestamp, endOfDay),
        ),
      );

    const [pendingReviewTotal] = await tx
      .select({ total: count() })
      .from(clinicalNotes)
      .where(eq(clinicalNotes.status, "Draft"));

    const [approvedTodayTotal] = await tx
      .select({ total: count() })
      .from(clinicalNotes)
      .where(
        and(
          eq(clinicalNotes.status, "Approved_by_Nurse"),
          gte(clinicalNotes.createdAt, startOfDay),
          lt(clinicalNotes.createdAt, endOfDay),
        ),
      );

    const recentActivity = await tx
      .select({
        id: transcripts.id,
        interactionType: transcripts.interactionType,
        timestamp: transcripts.timestamp,
        patientFirstName: patients.patientFirstName,
        patientLastName: patients.patientLastName,
        nurseFirstName: nurses.nurseFirstName,
        nurseLastName: nurses.nurseLastName,
        noteStatus: clinicalNotes.status,
      })
      .from(transcripts)
      .innerJoin(patients, eq(transcripts.patientId, patients.id))
      .innerJoin(nurses, eq(transcripts.nurseId, nurses.id))
      .leftJoin(clinicalNotes, eq(clinicalNotes.transcriptId, transcripts.id))
      .orderBy(desc(transcripts.timestamp))
      .limit(5);

    return {
      patientCount: Number(patientTotal?.total ?? 0),
      sessionsTodayCount: Number(sessionsTodayTotal?.total ?? 0),
      pendingReviewCount: Number(pendingReviewTotal?.total ?? 0),
      approvedTodayCount: Number(approvedTodayTotal?.total ?? 0),
      recentActivity,
    };
  });

  const activity = recentActivity.map((row) => ({
    id: row.id,
    patientName: `${row.patientFirstName} ${row.patientLastName}`,
    patientInitials: `${row.patientFirstName[0] ?? ""}${row.patientLastName[0] ?? ""}`.toUpperCase(),
    interactionType: row.interactionType,
    nurseName: `${row.nurseFirstName} ${row.nurseLastName}`,
    timestamp: relativeDate(row.timestamp),
    noteStatus: row.noteStatus,
  }));

  return (
    <>
      {/* Welcome Header */}
      <div className="flex flex-col gap-1 pt-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            {greeting}, {firstName}
          </h1>
          <p className="text-xs text-muted-foreground">
            {new Date().toLocaleDateString("en-US", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
            {" · "}Here&apos;s your clinical overview.
          </p>
        </div>
        <div className="flex gap-2 pt-2 sm:pt-0">
          <Button variant="outline" size="default" className="rounded-full" asChild>
            <Link href="/dashboard/patients/new">
              <HugeiconsIcon icon={PatientIcon} data-icon="inline-start" />
              Add Patient
            </Link>
          </Button>
          <Button size="default" className="rounded-full shadow-sm shadow-primary/25" asChild>
            <Link href="/dashboard/sessions/new">
              <HugeiconsIcon icon={PlusSignIcon} data-icon="inline-start" />
              New Session
            </Link>
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="My Patients"
          value={patientCount.toString()}
          description="Under your care"
          icon={PatientIcon}
          iconBg="bg-primary/10 text-primary"
        />
        <StatCard
          title="Sessions Today"
          value={sessionsTodayCount.toString()}
          description="Recorded today"
          icon={Mic01Icon}
          iconBg="bg-chart-2/20 text-chart-3"
        />
        <StatCard
          title="Pending Review"
          value={pendingReviewCount.toString()}
          description="Draft notes to approve"
          icon={CheckListIcon}
          iconBg="bg-amber-100 text-amber-700"
        />
        <StatCard
          title="Approved Today"
          value={approvedTodayCount.toString()}
          description="Notes signed off"
          icon={CheckmarkCircle01Icon}
          iconBg="bg-emerald-100 text-emerald-700"
        />
      </div>

      {/* Recent Activity */}
      <RecentActivitySection activity={activity} />

      {/* Quick Actions */}
      <div className="grid gap-4 sm:grid-cols-3">
        <QuickActionCard
          title="Start a Session"
          description="Begin an ambient scribe recording for a patient interaction."
          href="/dashboard/sessions/new"
          label="Record"
        />
        <QuickActionCard
          title="Review Draft Notes"
          description="Review and approve auto-generated SOAP clinical notes."
          href="/dashboard/review"
          label="Review"
        />
        <QuickActionCard
          title="Add a Patient"
          description="Onboard a new patient with demographics and loved one details."
          href="/dashboard/patients/new"
          label="Add"
        />
      </div>
    </>
  );
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

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

function StatCard({
  title,
  value,
  description,
  icon,
  iconBg,
}: {
  title: string;
  value: string;
  description: string;
  icon: React.ComponentProps<typeof HugeiconsIcon>["icon"];
  iconBg: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardDescription>{title}</CardDescription>
        <CardAction>
          <div
            className={`flex size-9 items-center justify-center rounded-lg ${iconBg}`}
          >
            <HugeiconsIcon icon={icon} size={18} />
          </div>
        </CardAction>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold tracking-tight">{value}</div>
        <p className="text-xs text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}

type ActivityRow = {
  id: string;
  patientName: string;
  patientInitials: string;
  interactionType: "Routine" | "Intervention";
  nurseName: string;
  timestamp: string;
  noteStatus: "Draft" | "Approved_by_Nurse" | null;
};

function RecentActivitySection({ activity }: { activity: ActivityRow[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
        <CardDescription>
          Latest sessions across your organization.
        </CardDescription>
        <CardAction>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/dashboard/sessions">
              View all
              <HugeiconsIcon icon={ArrowRight01Icon} data-icon="inline-end" />
            </Link>
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        {activity.length > 0 ? (
          <ActivityTable data={activity} />
        ) : (
          <EmptyState />
        )}
      </CardContent>
    </Card>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <div className="flex size-10 items-center justify-center rounded-full bg-muted mb-3">
        <HugeiconsIcon icon={Mic01Icon} size={20} className="text-muted-foreground" />
      </div>
      <h3 className="text-sm font-medium">No sessions yet</h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        Start your first ambient scribe session to see transcripts and
        auto-generated clinical notes here.
      </p>
      <Button size="default" className="mt-4 rounded-full shadow-sm shadow-primary/25" asChild>
        <Link href="/dashboard/sessions/new">
          <HugeiconsIcon icon={PlusSignIcon} data-icon="inline-start" />
          Start Session
        </Link>
      </Button>
    </div>
  );
}

function ActivityTable({ data }: { data: ActivityRow[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Patient</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Nurse</TableHead>
          <TableHead>Time</TableHead>
          <TableHead>Note Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((row) => (
          <TableRow key={row.id}>
            <TableCell>
              <div className="flex items-center gap-2">
                <Avatar size="sm">
                  <AvatarFallback className="text-[10px]">
                    {row.patientInitials}
                  </AvatarFallback>
                </Avatar>
                <span className="font-medium">{row.patientName}</span>
              </div>
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
            <TableCell className="text-muted-foreground">
              {row.nurseName}
            </TableCell>
            <TableCell className="text-muted-foreground">
              {row.timestamp}
            </TableCell>
            <TableCell>
              {row.noteStatus ? (
                <Badge
                  variant={
                    row.noteStatus === "Draft" ? "outline" : "default"
                  }
                >
                  {row.noteStatus === "Approved_by_Nurse"
                    ? "Approved"
                    : row.noteStatus}
                </Badge>
              ) : (
                <span className="text-xs text-muted-foreground">
                  Pending
                </span>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function QuickActionCard({
  title,
  description,
  href,
  label,
}: {
  title: string;
  description: string;
  href: string;
  label: string;
}) {
  return (
    <Card className="group relative overflow-hidden transition-shadow hover:shadow-md">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <Button variant="outline" size="default" className="rounded-full" asChild>
          <Link href={href}>
            {label}
            <HugeiconsIcon icon={ArrowRight01Icon} data-icon="inline-end" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
