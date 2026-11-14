import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
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
}: Props<T>) {
    if (error) return <ErrorState message={error} onRetry={onRetry} />;
    if (!loading && rows?.length === 0)
        return <EmptyState title={emptyTitle} action={emptyAction} />;

    const from = total === 0 ? 0 : offset + 1;
    const to = Math.min(offset + limit, total);
    return (
        <div className="table-wrap">
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
                                          <td key={c.header}>
                                              <Skeleton />
                                          </td>
                                      ))}
                                  </tr>
                              ))
                            : rows?.map((row) => (
                                  <tr
                                      key={rowKey(row)}
                                      className={onRowClick ? "is-clickable" : undefined}
                                      onClick={onRowClick && (() => onRowClick(row))}
                                  >
                                      {columns.map((c) => (
                                          <td
                                              key={c.header}
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
            <div className="table-footer">
                <label className="inline-field caption">
                    Por página
                    <select value={limit} onChange={(e) => onPage(0, Number(e.target.value))}>
                        {[20, 50, 100].map((n) => (
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
        </div>
    );
}
