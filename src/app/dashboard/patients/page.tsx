import { auth } from "@/lib/auth/server";
import { withAuth } from "@/lib/db";
import { patients, transcripts } from "@/lib/db/schema";
import { asc, count, desc, eq, ilike, or, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import { PatientIcon, PlusSignIcon } from "@hugeicons/core-free-icons";
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
import Link from "next/link";
import { AddPatientDialog } from "./add-patient-dialog";
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
	const diffSec = Math.floor(diffMs / 1000);
	const diffMin = Math.floor(diffSec / 60);
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

export default async function PatientsPage({ searchParams }: PageProps) {
	const { data: session } = await auth.getSession();

	if (!session?.user) {
		redirect("/auth/sign-in");
	}

	const params = await searchParams;

	const { query, sortKey, sortDirection, page } = getTableParams(params, {
		defaultSortKey: "added",
		allowedSortKeys: ["patient", "lovedOne", "sessions", "voice", "added"],
		defaultSortDirection: "desc",
	});

	const searchFilter = query
		? or(
				ilike(patients.patientFirstName, `%${query}%`),
				ilike(patients.patientLastName, `%${query}%`),
				ilike(patients.lovedOneFirstName, `%${query}%`),
				ilike(patients.lovedOneLastName, `%${query}%`),
				ilike(patients.lovedOneRelation, `%${query}%`),
			)
		: undefined;

	const {
		rows: patientRows,
		totalCount,
		currentPage,
		totalPages,
	} = await withAuth(session.user.id, async (tx) => {
		const totalResult = await tx
			.select({ total: count() })
			.from(patients)
			.where(searchFilter);

		const totalCount = Number(totalResult[0]?.total ?? 0);
		const totalPages = Math.max(1, Math.ceil(totalCount / TABLE_PAGE_SIZE));
		const currentPage = Math.min(page, totalPages);
		const offset = (currentPage - 1) * TABLE_PAGE_SIZE;

		const sessionCountExpr = count(transcripts.id);
		const sortOrder = sortDirection === "asc" ? asc : desc;
		const voiceOrder = sql`CASE WHEN ${patients.elevenlabsVoiceId} IS NULL THEN 0 ELSE 1 END`;

		const orderBy = (() => {
			switch (sortKey) {
				case "patient":
					return [
						sortOrder(patients.patientLastName),
						sortOrder(patients.patientFirstName),
					];
				case "lovedOne":
					return [
						sortOrder(patients.lovedOneLastName),
						sortOrder(patients.lovedOneFirstName),
					];
				case "sessions":
					return [sortOrder(sessionCountExpr), desc(patients.createdAt)];
				case "voice":
					return [sortOrder(voiceOrder), asc(patients.patientLastName)];
				case "added":
				default:
					return [sortOrder(patients.createdAt)];
			}
		})();

		const rows = await tx
			.select({
				id: patients.id,
				patientFirstName: patients.patientFirstName,
				patientLastName: patients.patientLastName,
				lovedOneFirstName: patients.lovedOneFirstName,
				lovedOneLastName: patients.lovedOneLastName,
				lovedOneRelation: patients.lovedOneRelation,
				elevenlabsVoiceId: patients.elevenlabsVoiceId,
				createdAt: patients.createdAt,
				sessionCount: sessionCountExpr,
			})
			.from(patients)
			.leftJoin(transcripts, eq(transcripts.patientId, patients.id))
			.where(searchFilter)
			.groupBy(patients.id)
			.orderBy(...orderBy)
			.limit(TABLE_PAGE_SIZE)
			.offset(offset);

		return { rows, totalCount, currentPage, totalPages };
	});

	const showingStart =
		totalCount === 0 ? 0 : (currentPage - 1) * TABLE_PAGE_SIZE + 1;
	const showingEnd = Math.min(currentPage * TABLE_PAGE_SIZE, totalCount);

	return (
		<>
			{/* Header */}
			<div className="flex items-center justify-between pt-4">
				<div className="flex items-center gap-3">
					<h1 className="text-xl font-semibold tracking-tight">Patients</h1>
					<Badge variant="secondary" className="tabular-nums">
						{totalCount}
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
			{totalCount > 0 ? (
				<Card>
					<CardContent className="p-0">
						<TableSearchBar
							searchParams={params}
							query={query}
							sortKey={sortKey}
							sortDirection={sortDirection}
							placeholder="Search patients or loved ones..."
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
										label="Loved One"
										sortKey="lovedOne"
										activeSort={sortKey}
										direction={sortDirection}
										defaultDir="asc"
										searchParams={params}
									/>
									<SortableHead
										label="Sessions"
										sortKey="sessions"
										activeSort={sortKey}
										direction={sortDirection}
										defaultDir="desc"
										searchParams={params}
										align="center"
									/>
									<SortableHead
										label="Voice"
										sortKey="voice"
										activeSort={sortKey}
										direction={sortDirection}
										defaultDir="desc"
										searchParams={params}
									/>
									<SortableHead
										label="Added"
										sortKey="added"
										activeSort={sortKey}
										direction={sortDirection}
										defaultDir="desc"
										searchParams={params}
									/>
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
													<Badge
														variant="outline"
														className="text-[10px] capitalize"
													>
														{row.lovedOneRelation}
													</Badge>
												</div>
											</TableCell>
											<TableCell className="text-center tabular-nums">
												{row.sessionCount}
											</TableCell>
											<TableCell>
												{row.elevenlabsVoiceId ? (
													<Badge
														variant="default"
														className="bg-emerald-600 text-white"
													>
														Active
													</Badge>
												) : (
													<Badge
														variant="outline"
														className="text-muted-foreground"
													>
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
						<h3 className="text-base font-medium">No matching patients</h3>
						<p className="mt-1 max-w-sm text-sm text-muted-foreground">
							Try adjusting your search terms or clear the search to see all
							patients.
						</p>
						<Button className="mt-5 rounded-full" variant="outline" asChild>
							<Link href="/dashboard/patients">Clear search</Link>
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
