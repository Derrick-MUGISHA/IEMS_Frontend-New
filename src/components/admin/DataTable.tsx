"use client";

import { EmptyState } from "./states";
import { Skeleton } from "@/components/ui/skeleton";

import { useMemo, useState, type ReactNode } from "react";
import {
  ArrowDown,
  ArrowUp,
  ChevronsUpDown,
  Search,
  X,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@ui-sdk/react/select";
import { cn } from "@/lib/utils";

export type Column<T> = {
  id: string;
  header: string;
  cell: (row: T) => ReactNode;
  sortValue?: (row: T) => string | number;
  className?: string;
  headerClassName?: string;
};
type Sort = { id: string; dir: "asc" | "desc" };

export function DataTable<T>({
  data,
  columns,
  getRowId,
  onRowClick,
  searchable,
  searchPlaceholder = "Search…",
  toolbar,
  pageSize = 25,
  empty,
  selectionActions,
  loading = false,
}: {
  data: T[];
  columns: Column<T>[];
  getRowId: (row: T) => string;
  onRowClick?: (row: T) => void;
  searchable?: (row: T) => string;
  searchPlaceholder?: string;
  toolbar?: ReactNode;
  pageSize?: number;
  empty?: ReactNode;
  selectionActions?: (selected: T[]) => ReactNode;
  loading?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort | null>(null);
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(pageSize);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return searchable && q
      ? data.filter((row) => searchable(row).toLowerCase().includes(q))
      : data;
  }, [data, query, searchable]);
  const sorted = useMemo(() => {
    const value = columns.find((col) => col.id === sort?.id)?.sortValue;
    if (!sort || !value) return filtered;
    const direction = sort.dir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) =>
      value(a) < value(b) ? -direction : value(a) > value(b) ? direction : 0,
    );
  }, [columns, filtered, sort]);
  const totalPages = Math.max(1, Math.ceil(sorted.length / size));
  const current = Math.min(page, totalPages);
  const rows = sorted.slice((current - 1) * size, current * size);
  const chosen = data.filter((row) => selected.has(getRowId(row)));
  const allPageSelected =
    rows.length > 0 && rows.every((row) => selected.has(getRowId(row)));
  const toggle = (id: string) =>
    setSelected((old) => {
      const next = new Set(old);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  return (
    <div className="space-y-4" aria-busy={loading}>
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card/50 p-3">
        {searchable && (
          <div className="relative min-w-56 flex-1 sm:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              aria-label={searchPlaceholder}
              value={query}
              placeholder={searchPlaceholder}
              className="pl-9 pr-12"
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(1);
              }}
            />
            {query && (
              <Button
                size="icon-sm"
                variant="ghost"
                className="absolute right-1 top-1/2 -translate-y-1/2 py-0 px-2"
                aria-label="Clear search"
                onClick={() => {
                  setQuery("");
                  setPage(1);
                }}
              >
                <X />
              </Button>
            )}
          </div>
        )}
        {toolbar}
        <span className="ml-auto text-xs tabular-nums text-muted-foreground">
          {filtered.length.toLocaleString()}{" "}
          {filtered.length === 1 ? "record" : "records"}
        </span>
      </div>
      {chosen.length > 0 && selectionActions && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 p-3">
          <span className="text-sm font-semibold">
            {chosen.length} selected
          </span>
          {selectionActions(chosen)}
          <Button
            size="sm"
            variant="outline"
            className="ml-auto"
            onClick={() => setSelected(new Set())}
          >
            Clear selection
          </Button>
        </div>
      )}
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <Table className="min-w-[720px]">
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              {selectionActions && (
                <TableHead className="w-12 px-4">
                  <input
                    type="checkbox"
                    className="block size-4 cursor-pointer accent-white"
                    aria-label="Select all rows on this page"
                    checked={allPageSelected}
                    ref={(node) => {
                      if (node)
                        node.indeterminate =
                          !allPageSelected &&
                          rows.some((row) => selected.has(getRowId(row)));
                    }}
                    onChange={() =>
                      setSelected((old) => {
                        const next = new Set(old);
                        rows.forEach((row) =>
                          allPageSelected
                            ? next.delete(getRowId(row))
                            : next.add(getRowId(row)),
                        );
                        return next;
                      })
                    }
                  />
                </TableHead>
              )}
              {columns.map((col) => (
                <TableHead
                  key={col.id}
                  className={cn("h-12 px-4 text-xs", col.headerClassName)}
                  aria-sort={
                    sort?.id === col.id
                      ? sort.dir === "asc"
                        ? "ascending"
                        : "descending"
                      : undefined
                  }
                >
                  {col.sortValue ? (
                    <button
                      type="button"
                      className="flex min-h-9 items-center gap-2 font-semibold hover:text-foreground"
                      onClick={() => {
                        setSort((old) =>
                          old?.id === col.id
                            ? old.dir === "asc"
                              ? { id: col.id, dir: "desc" }
                              : null
                            : { id: col.id, dir: "asc" },
                        );
                        setPage(1);
                      }}
                    >
                      {col.header}
                      {sort?.id === col.id ? (
                        sort.dir === "asc" ? (
                          <ArrowUp className="size-3.5" />
                        ) : (
                          <ArrowDown className="size-3.5" />
                        )
                      ) : (
                        <ChevronsUpDown className="size-3.5 opacity-50" />
                      )}
                    </button>
                  ) : (
                    col.header
                  )}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? Array.from({ length: 6 }).map((_, row) => (
              <TableRow key={`loading-${row}`} aria-hidden="true">
                {selectionActions && <TableCell className="px-4"><Skeleton className="size-4" /></TableCell>}
                {columns.map((column) => <TableCell key={column.id} className={cn("whitespace-normal px-4 py-4 align-middle", column.className)}><div className="flex h-8 items-center"><Skeleton className="h-4 w-4/5 min-w-12" /></div></TableCell>)}
              </TableRow>
            )) : rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length + (selectionActions ? 1 : 0)}
                  className="whitespace-normal p-8 text-center"
                >
                  {empty ?? (
                    <EmptyState title="No matching records" message="Try another search or clear the filters." />
                  )}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow
                  key={getRowId(row)}
                  data-state={
                    selected.has(getRowId(row)) ? "selected" : undefined
                  }
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={cn(
                    "transition-colors",
                    onRowClick && "cursor-pointer hover:bg-muted/40",
                  )}
                >
                  {selectionActions && (
                    <TableCell
                      className="px-4"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        className="block size-4 cursor-pointer accent-white"
                        aria-label={`Select row ${getRowId(row)}`}
                        checked={selected.has(getRowId(row))}
                        onChange={() => toggle(getRowId(row))}
                      />
                    </TableCell>
                  )}
                  {columns.map((col) => (
                    <TableCell
                      key={col.id}
                      className={cn(
                        "whitespace-normal px-4 py-4 align-middle",
                        col.className,
                      )}
                    >
                      {col.cell(row)}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <p className="text-muted-foreground" aria-live="polite">
          {sorted.length
            ? `${(current - 1) * size + 1}–${Math.min(current * size, sorted.length)} of ${sorted.length}`
            : "0 results"}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Rows per page</span>
            <Select
              value={String(size)}
              onValueChange={(value) => {
                if (value) {
                  setSize(Number(value));
                  setPage(1);
                }
              }}
              items={Array.from(new Set([pageSize, 10, 25, 50, 100]))
                .sort((a, b) => a - b)
                .map((n) => ({ value: String(n), label: String(n) }))}
            >
              <SelectTrigger
                aria-label="Rows per page"
                className={cn(buttonVariants({ variant: "outline", size: "sm" }), "table-page-size min-w-20 justify-between gap-2 px-3")}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="admin-sdk-popup min-w-20">
                {Array.from(new Set([pageSize, 10, 25, 50, 100]))
                  .sort((a, b) => a - b)
                  .map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="w-auto min-w-24 px-3"
            aria-label="Previous page"
            disabled={current === 1}
            onClick={() => setPage(current - 1)}
          >
            <ChevronLeft />
            Previous
          </Button>
          <span className="min-w-20 whitespace-nowrap text-center text-xs tabular-nums">
            Page {current} of {totalPages}
          </span>
          <Button
            size="sm"
            variant="outline"
            className="w-auto min-w-24 px-3"
            aria-label="Next page"
            disabled={current === totalPages}
            onClick={() => setPage(current + 1)}
          >
            Next
            <ChevronRight />
          </Button>
        </div>
      </div>
    </div>
  );
}
