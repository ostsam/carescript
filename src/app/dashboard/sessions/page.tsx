import { auth } from "@/lib/auth/server";
import { withAuth } from "@/lib/db";
import {
  transcripts,
  patients,
  nurses,
  clinicalNotes,
} from "@/lib/db/schema";
import { asc, countDistinct, desc, eq, ilike, or, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Mic01Icon,
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
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  SortableHead,
  TablePagination,
  TableSearchBar,
} from "@/components/tables/table-controls";
import {
  getTableParams,
  TABLE_PAGE_SIZE,
  type TableSearchParams,
} from "@/lib/table-params";

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

type PageProps = {
  searchParams: Promise<TableSearchParams>;
};

export default async function SessionsPage({ searchParams }: PageProps) {
  const { data: session } = await auth.getSession();

  if (!session?.user) {
    redirect("/auth/sign-in");
  }

  const params = await searchParams;

  const { query, sortKey, sortDirection, page } = getTableParams(
    params,
    {
      defaultSortKey: "time",
      allowedSortKeys: [
        "patient",
        "type",
        "nurse",
        "time",
        "transcript",
        "status",
      ],
      defaultSortDirection: "desc",
    }
  );

  const interactionTypeText = sql`${transcripts.interactionType}::text`;
  const statusText = sql`${clinicalNotes.status}::text`;
  const searchFilter = query
    ? or(
        ilike(patients.patientFirstName, `%${query}%`),
        ilike(patients.patientLastName, `%${query}%`),
        ilike(nurses.nurseFirstName, `%${query}%`),
        ilike(nurses.nurseLastName, `%${query}%`),
        ilike(transcripts.rawTranscript, `%${query}%`),
        ilike(interactionTypeText, `%${query}%`),
        ilike(statusText, `%${query}%`)
      )
    : undefined;

  const { rows, totalCount, currentPage, totalPages } = await withAuth(
    session.user.id,
    async (tx) => {
      const totalResult = await tx
        .select({ total: countDistinct(transcripts.id) })
        .from(transcripts)
        .innerJoin(patients, eq(transcripts.patientId, patients.id))
        .innerJoin(nurses, eq(transcripts.nurseId, nurses.id))
        .leftJoin(
          clinicalNotes,
          eq(clinicalNotes.transcriptId, transcripts.id)
        )
        .where(searchFilter);

      const totalCount = Number(totalResult[0]?.total ?? 0);
      const totalPages = Math.max(1, Math.ceil(totalCount / TABLE_PAGE_SIZE));
      const currentPage = Math.min(page, totalPages);
      const offset = (currentPage - 1) * TABLE_PAGE_SIZE;

      const sortOrder = sortDirection === "asc" ? asc : desc;
      const statusOrder = sql`COALESCE(${clinicalNotes.status}::text, 'Pending')`;

      const orderBy = (() => {
        switch (sortKey) {
          case "patient":
            return [
              sortOrder(patients.patientLastName),
              sortOrder(patients.patientFirstName),
            ];
          case "type":
            return [sortOrder(transcripts.interactionType)];
          case "nurse":
            return [
              sortOrder(nurses.nurseLastName),
              sortOrder(nurses.nurseFirstName),
            ];
          case "transcript":
            return [sortOrder(transcripts.rawTranscript)];
          case "status":
            return [sortOrder(statusOrder)];
          case "time":
          default:
            return [sortOrder(transcripts.timestamp)];
        }
      })();

      const rows = await tx
        .select({
          id: transcripts.id,
          interactionType: transcripts.interactionType,
          rawTranscript: transcripts.rawTranscript,
          timestamp: transcripts.timestamp,
          patientFirstName: patients.patientFirstName,
          patientLastName: patients.patientLastName,
          patientId: patients.id,
          nurseFirstName: nurses.nurseFirstName,
          nurseLastName: nurses.nurseLastName,
          noteStatus: clinicalNotes.status,
        })
        .from(transcripts)
        .innerJoin(patients, eq(transcripts.patientId, patients.id))
        .innerJoin(nurses, eq(transcripts.nurseId, nurses.id))
        .leftJoin(
          clinicalNotes,
          eq(clinicalNotes.transcriptId, transcripts.id)
        )
        .where(searchFilter)
        .orderBy(...orderBy)
        .limit(TABLE_PAGE_SIZE)
        .offset(offset);

      return { rows, totalCount, currentPage, totalPages };
    }
  );

  const showingStart =
    totalCount === 0 ? 0 : (currentPage - 1) * TABLE_PAGE_SIZE + 1;
  const showingEnd = Math.min(currentPage * TABLE_PAGE_SIZE, totalCount);

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between pt-4">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold tracking-tight">Sessions</h1>
          <Badge variant="secondary" className="tabular-nums">
            {totalCount}
          </Badge>
        </div>
        <Button className="rounded-full shadow-sm shadow-primary/25" asChild>
          <Link href="/dashboard/sessions/new">
            <HugeiconsIcon icon={PlusSignIcon} data-icon="inline-start" />
            New Session
          </Link>
        </Button>
      </div>

      {/* Content */}
      {totalCount > 0 ? (
        <Card>
          <CardContent className="p-0">
            <TableSearchBar
              searchParams={params}
              query={query}
              sortKey={sortKey}
              sortDirection={sortDirection}
              placeholder="Search patients, nurses, or transcripts..."
              totalCount={totalCount}
              showingStart={showingStart}
              showingEnd={showingEnd}
            />
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableHead
                    label="Patient"
                    sortKey="patient"
                    activeSort={sortKey}
                    direction={sortDirection}
                    defaultDir="asc"
                    searchParams={params}
                  />
                  <SortableHead
                    label="Type"
                    sortKey="type"
                    activeSort={sortKey}
                    direction={sortDirection}
                    defaultDir="asc"
                    searchParams={params}
                  />
                  <SortableHead
                    label="Nurse"
                    sortKey="nurse"
                    activeSort={sortKey}
                    direction={sortDirection}
                    defaultDir="asc"
                    searchParams={params}
                  />
                  <SortableHead
                    label="Time"
                    sortKey="time"
                    activeSort={sortKey}
                    direction={sortDirection}
                    defaultDir="desc"
                    searchParams={params}
                  />
                  <SortableHead
                    label="Transcript Preview"
                    sortKey="transcript"
                    activeSort={sortKey}
                    direction={sortDirection}
                    defaultDir="asc"
                    searchParams={params}
                  />
                  <SortableHead
                    label="Note Status"
                    sortKey="status"
                    activeSort={sortKey}
                    direction={sortDirection}
                    defaultDir="asc"
                    searchParams={params}
                  />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => {
                  const initials =
                    (row.patientFirstName[0] ?? "") +
                    (row.patientLastName[0] ?? "");

                  return (
                    <TableRow key={row.id}>
                      <TableCell>
                        <Link
                          href={`/dashboard/sessions/${row.id}`}
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
                            row.interactionType === "Intervention"
                              ? "default"
                              : "secondary"
                          }
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
                        {row.rawTranscript.slice(0, 100)}
                        {row.rawTranscript.length > 100 ? "…" : ""}
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
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
          <TablePagination
            currentPage={currentPage}
            totalPages={totalPages}
            searchParams={params}
          />
        </Card>
      ) : (
        <EmptyState query={query} />
      )}
    </>
  );
}

function EmptyState({ query }: { query: string }) {
  if (query) {
    return (
      <Card>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <h3 className="text-base font-medium">No matching sessions</h3>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              Try adjusting your search terms or clear the search to see all
              sessions.
            </p>
            <Button className="mt-5 rounded-full" variant="outline" asChild>
              <Link href="/dashboard/sessions">Clear search</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent>
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 mb-4">
            <HugeiconsIcon
              icon={Mic01Icon}
              size={24}
              className="text-primary"
            />
          </div>
          <h3 className="text-base font-medium">No sessions yet</h3>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Start your first ambient scribe session to capture transcripts and
            auto-generate clinical notes.
          </p>
          <Button
            className="mt-5 rounded-full shadow-sm shadow-primary/25"
            asChild
          >
            <Link href="/dashboard/sessions/new">
              <HugeiconsIcon icon={PlusSignIcon} data-icon="inline-start" />
              Start Your First Session
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
