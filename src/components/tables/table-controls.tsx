import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowDown01Icon,
  ArrowUp01Icon,
  UnfoldMoreIcon,
} from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TableHead } from "@/components/ui/table";
import { CardFooter } from "@/components/ui/card";
import { buildTableUrl, type TableSearchParams } from "@/lib/table-params";

type SortDirection = "asc" | "desc";

function SortIcon({
  active,
  direction,
}: {
  active: boolean;
  direction: SortDirection;
}) {
  if (!active) {
    return (
      <HugeiconsIcon
        icon={UnfoldMoreIcon}
        size={14}
        className="text-muted-foreground"
      />
    );
  }

  return (
    <HugeiconsIcon
      icon={direction === "asc" ? ArrowUp01Icon : ArrowDown01Icon}
      size={14}
      className="text-foreground"
    />
  );
}

export function SortableHead({
  label,
  sortKey,
  activeSort,
  direction,
  defaultDir,
  searchParams,
  align = "left",
}: {
  label: string;
  sortKey: string;
  activeSort: string;
  direction: SortDirection;
  defaultDir: SortDirection;
  searchParams: TableSearchParams;
  align?: "left" | "center";
}) {
  const isActive = activeSort === sortKey;
  const nextDir = isActive ? (direction === "asc" ? "desc" : "asc") : defaultDir;
  const href = buildTableUrl(searchParams, {
    sort: sortKey,
    dir: nextDir,
    page: 1,
  });

  return (
    <TableHead className={align === "center" ? "text-center" : undefined}>
      <Link
        href={href}
        className={[
          "inline-flex items-center gap-1 transition-colors",
          align === "center" ? "w-full justify-center" : "",
          isActive
            ? "text-foreground"
            : "text-muted-foreground hover:text-foreground",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <span>{label}</span>
        <SortIcon active={isActive} direction={direction} />
      </Link>
    </TableHead>
  );
}

export function TableSearchBar({
  searchParams,
  query,
  sortKey,
  sortDirection,
  placeholder,
  totalCount,
  showingStart,
  showingEnd,
}: {
  searchParams: TableSearchParams;
  query: string;
  sortKey: string;
  sortDirection: SortDirection;
  placeholder: string;
  totalCount: number;
  showingStart: number;
  showingEnd: number;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
      <form className="flex w-full max-w-md items-center gap-2" method="get">
        <Input
          name="q"
          placeholder={placeholder}
          defaultValue={query}
        />
        <input type="hidden" name="sort" value={sortKey} />
        <input type="hidden" name="dir" value={sortDirection} />
        <input type="hidden" name="page" value="1" />
        <Button variant="outline" size="sm" type="submit">
          Search
        </Button>
        {query ? (
          <Button variant="ghost" size="sm" asChild>
            <Link href={buildTableUrl(searchParams, { q: null, page: 1 })}>
              Clear
            </Link>
          </Button>
        ) : null}
      </form>
      <div className="text-xs text-muted-foreground">
        Showing {showingStart}-{showingEnd} of {totalCount}
      </div>
    </div>
  );
}

export function TablePagination({
  currentPage,
  totalPages,
  searchParams,
}: {
  currentPage: number;
  totalPages: number;
  searchParams: TableSearchParams;
}) {
  return (
    <CardFooter className="flex flex-wrap items-center justify-between gap-3">
      <div className="text-xs text-muted-foreground">
        Page {currentPage} of {totalPages}
      </div>
      <div className="flex items-center gap-2">
        {currentPage > 1 ? (
          <Button variant="outline" size="sm" asChild>
            <Link href={buildTableUrl(searchParams, { page: currentPage - 1 })}>
              Previous
            </Link>
          </Button>
        ) : (
          <Button variant="outline" size="sm" disabled>
            Previous
          </Button>
        )}
        {currentPage < totalPages ? (
          <Button variant="outline" size="sm" asChild>
            <Link href={buildTableUrl(searchParams, { page: currentPage + 1 })}>
              Next
            </Link>
          </Button>
        ) : (
          <Button variant="outline" size="sm" disabled>
            Next
          </Button>
        )}
      </div>
    </CardFooter>
  );
}
