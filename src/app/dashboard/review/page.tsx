import { auth } from "@/lib/auth/server";
import { withAuth } from "@/lib/db";
import {
  clinicalNotes,
  transcripts,
  patients,
  nurses,
} from "@/lib/db/schema";
import { and, asc, countDistinct, desc, eq, ilike, or, sql } from "drizzle-orm";
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

export default async function ReviewPage({ searchParams }: PageProps) {
  const { data: session } = await auth.getSession();

  if (!session?.user) {
    redirect("/auth/sign-in");
  }

  const params = await searchParams;

  const { query, sortKey, sortDirection, page } = getTableParams(
    params,
    {
      defaultSortKey: "created",
      allowedSortKeys: [
        "patient",
        "status",
        "type",
        "preview",
        "nurse",
        "created",
      ],
      defaultSortDirection: "desc",
    }
  );

  const statusText = sql`${clinicalNotes.status}::text`;
  const interactionTypeText = sql`${transcripts.interactionType}::text`;
  const searchFilter = query
    ? or(
        ilike(patients.patientFirstName, `%${query}%`),
        ilike(patients.patientLastName, `%${query}%`),
        ilike(nurses.nurseFirstName, `%${query}%`),
        ilike(nurses.nurseLastName, `%${query}%`),
        ilike(clinicalNotes.subjectiveText, `%${query}%`),
        ilike(statusText, `%${query}%`),
        ilike(interactionTypeText, `%${query}%`)
      )
    : undefined;

  const {
    rows,
    totalCount,
    currentPage,
    totalPages,
    draftCount,
  } = await withAuth(session.user.id, async (tx) => {
    const totalResult = await tx
      .select({ total: countDistinct(clinicalNotes.id) })
      .from(clinicalNotes)
      .innerJoin(transcripts, eq(clinicalNotes.transcriptId, transcripts.id))
      .innerJoin(patients, eq(transcripts.patientId, patients.id))
      .innerJoin(nurses, eq(transcripts.nurseId, nurses.id))
      .where(searchFilter);

    const draftResult = await tx
      .select({ total: countDistinct(clinicalNotes.id) })
      .from(clinicalNotes)
      .innerJoin(transcripts, eq(clinicalNotes.transcriptId, transcripts.id))
      .innerJoin(patients, eq(transcripts.patientId, patients.id))
      .innerJoin(nurses, eq(transcripts.nurseId, nurses.id))
      .where(
        searchFilter
          ? and(searchFilter, eq(clinicalNotes.status, "Draft"))
          : eq(clinicalNotes.status, "Draft")
      );

    const totalCount = Number(totalResult[0]?.total ?? 0);
    const draftCount = Number(draftResult[0]?.total ?? 0);
    const totalPages = Math.max(1, Math.ceil(totalCount / TABLE_PAGE_SIZE));
    const currentPage = Math.min(page, totalPages);
    const offset = (currentPage - 1) * TABLE_PAGE_SIZE;

    const sortOrder = sortDirection === "asc" ? asc : desc;
    const orderBy = (() => {
      switch (sortKey) {
        case "patient":
          return [
            sortOrder(patients.patientLastName),
            sortOrder(patients.patientFirstName),
          ];
        case "status":
          return [sortOrder(clinicalNotes.status)];
        case "type":
          return [sortOrder(transcripts.interactionType)];
        case "preview":
          return [sortOrder(clinicalNotes.subjectiveText)];
        case "nurse":
          return [
            sortOrder(nurses.nurseLastName),
            sortOrder(nurses.nurseFirstName),
          ];
        case "created":
        default:
          return [sortOrder(clinicalNotes.createdAt)];
      }
    })();

    const rows = await tx
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
      .where(searchFilter)
      .orderBy(...orderBy)
      .limit(TABLE_PAGE_SIZE)
      .offset(offset);

    return { rows, totalCount, currentPage, totalPages, draftCount };
  });

  const showingStart =
    totalCount === 0 ? 0 : (currentPage - 1) * TABLE_PAGE_SIZE + 1;
  const showingEnd = Math.min(currentPage * TABLE_PAGE_SIZE, totalCount);

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between pt-4">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold tracking-tight">
            Review Queue
          </h1>
          <Badge variant="secondary" className="tabular-nums">
            {totalCount}
          </Badge>
          {draftCount > 0 && (
            <Badge variant="outline" className="tabular-nums">
              {draftCount} pending
            </Badge>
          )}
        </div>
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
              placeholder="Search patients, nurses, or notes..."
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
                    label="Status"
                    sortKey="status"
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
                    label="Note Preview"
                    sortKey="preview"
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
                    label="Created"
                    sortKey="created"
                    activeSort={sortKey}
                    direction={sortDirection}
                    defaultDir="desc"
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
            <h3 className="text-base font-medium">No matching notes</h3>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              Try adjusting your search terms or clear the search to see all
              notes.
            </p>
            <Button className="mt-5 rounded-full" variant="outline" asChild>
              <Link href="/dashboard/review">Clear search</Link>
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
