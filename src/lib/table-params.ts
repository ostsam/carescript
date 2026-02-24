export type TableSearchParams = Record<string, string | string[] | undefined>;

export const TABLE_PAGE_SIZE = 50;

type SortDirection = "asc" | "desc";

function getParam(
  searchParams: TableSearchParams,
  key: string
): string | undefined {
  const value = searchParams[key];
  return typeof value === "string" ? value : undefined;
}

export function buildTableUrl(
  searchParams: TableSearchParams,
  updates: Record<string, string | number | null | undefined>
) {
  const params = new URLSearchParams();
  Object.entries(searchParams).forEach(([key, value]) => {
    if (typeof value === "string") params.set(key, value);
  });
  Object.entries(updates).forEach(([key, value]) => {
    if (value === null || value === undefined || value === "") {
      params.delete(key);
      return;
    }
    params.set(key, String(value));
  });
  const query = params.toString();
  return query ? `?${query}` : "";
}

export function getTableParams(
  searchParams: TableSearchParams,
  options: {
    defaultSortKey: string;
    allowedSortKeys: string[];
    defaultSortDirection?: SortDirection;
  }
) {
  const query = getParam(searchParams, "q")?.trim() ?? "";
  const sortCandidate = getParam(searchParams, "sort");
  const sortKey = options.allowedSortKeys.includes(sortCandidate ?? "")
    ? (sortCandidate as string)
    : options.defaultSortKey;
  const dirCandidate = getParam(searchParams, "dir");
  const sortDirection: SortDirection =
    dirCandidate === "asc" || dirCandidate === "desc"
      ? dirCandidate
      : options.defaultSortDirection ?? "desc";
  const pageParam = Number.parseInt(getParam(searchParams, "page") ?? "1", 10);
  const page =
    Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;

  return { query, sortKey, sortDirection, page };
}
