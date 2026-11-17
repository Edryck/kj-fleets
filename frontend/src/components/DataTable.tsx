import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import Glass from "../glass/Glass";
import { EmptyState, ErrorState, Skeleton } from "./blocks";

export interface Column<T> {
    header: string;
    render: (row: T) => ReactNode;
    align?: "right";
}

interface Props<T> {
    columns: Column<T>[];
    rows: T[] | undefined;
    rowKey: (row: T) => string;
    total: number;
    limit: number;
    offset: number;
    onPage: (offset: number, limit: number) => void;
    loading?: boolean;
    error?: string;
    onRetry?: () => void;
    emptyTitle: string;
    emptyAction?: ReactNode;
    onRowClick?: (row: T) => void;
    selectedKey?: string | null;
}

function rowClass(clickable: unknown, selected: boolean): string | undefined {
    const names = [clickable && "is-clickable", selected && "is-selected"].filter(Boolean);
    return names.length ? names.join(" ") : undefined;
}

export default function DataTable<T>({
    columns,
    rows,
    rowKey,
    total,
    limit,
    offset,
    onPage,
    loading,
    error,
    onRetry,
    emptyTitle,
    emptyAction,
    onRowClick,
    selectedKey,
}: Props<T>) {
    if (error) return <ErrorState message={error} onRetry={onRetry} />;
    if (!loading && rows?.length === 0)
        return <EmptyState title={emptyTitle} action={emptyAction} />;

    return (
        <Glass className="table-wrap">
            <div className="table-scroll">
                <table className="table">
                    <thead>
                        <tr>
                            {columns.map((c) => (
                                <th
                                    key={c.header}
                                    scope="col"
                                    className={c.align === "right" ? "num" : undefined}
                                >
                                    {c.header}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {loading
                            ? Array.from({ length: 5 }, (_, i) => (
                                  <tr key={i}>
                                      {columns.map((c) => (
                                          <td key={c.header} data-label={c.header}>
                                              <Skeleton />
                                          </td>
                                      ))}
                                  </tr>
                              ))
                            : rows?.map((row) => (
                                  <tr
                                      key={rowKey(row)}
                                      className={rowClass(onRowClick, rowKey(row) === selectedKey)}
                                      tabIndex={onRowClick ? 0 : undefined}
                                      onClick={onRowClick && (() => onRowClick(row))}
                                      onKeyDown={
                                          onRowClick &&
                                          ((e) => {
                                              if (e.target !== e.currentTarget) return;
                                              if (e.key !== "Enter" && e.key !== " ") return;
                                              e.preventDefault();
                                              onRowClick(row);
                                          })
                                      }
                                  >
                                      {columns.map((c) => (
                                          <td
                                              key={c.header}
                                              data-label={c.header}
                                              className={c.align === "right" ? "num" : undefined}
                                          >
                                              {c.render(row)}
                                          </td>
                                      ))}
                                  </tr>
                              ))}
                    </tbody>
                </table>
            </div>
            <Pager total={total} limit={limit} offset={offset} onPage={onPage} />
        </Glass>
    );
}

export const PAGE_SIZES = [20, 50, 100];

export function Pager({
    total,
    limit,
    offset,
    onPage,
}: {
    total: number;
    limit: number;
    offset: number;
    onPage: (offset: number, limit: number) => void;
}) {
    const from = total === 0 ? 0 : offset + 1;
    const to = Math.min(offset + limit, total);
    return (
        <div className="table-footer">
            <label className="inline-field caption">
                Por página
                <select value={limit} onChange={(e) => onPage(0, Number(e.target.value))}>
                    {PAGE_SIZES.map((n) => (
                        <option key={n} value={n}>
                            {n}
                        </option>
                    ))}
                </select>
            </label>
            <span className="caption">
                {from}-{to} de {total}
            </span>
            <button
                type="button"
                className="btn btn-secondary btn-icon"
                disabled={offset === 0}
                onClick={() => onPage(Math.max(0, offset - limit), limit)}
                aria-label="Página anterior"
            >
                <ChevronLeft size={18} aria-hidden="true" />
            </button>
            <button
                type="button"
                className="btn btn-secondary btn-icon"
                disabled={offset + limit >= total}
                onClick={() => onPage(offset + limit, limit)}
                aria-label="Próxima página"
            >
                <ChevronRight size={18} aria-hidden="true" />
            </button>
        </div>
    );
}
