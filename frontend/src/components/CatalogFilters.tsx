import { Search } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { useSession } from "../auth/session";
import Glass from "../glass/Glass";

interface Props {
    searchLabel: string;
    placeholder: string;
    onQuery: (q: string) => void;
    statuses: [value: string, label: string][];
    status: string;
    onStatus: (status: string) => void;
    includeInactive: boolean;
    onIncludeInactive: (on: boolean) => void;
    counts?: Record<string, number | undefined>;
    total?: number;
    action?: ReactNode;
}

const shown = (value: number | undefined) => (value == null ? "—" : value);

export default function CatalogFilters({
    searchLabel,
    placeholder,
    onQuery,
    statuses,
    status,
    onStatus,
    includeInactive,
    onIncludeInactive,
    counts,
    total,
    action,
}: Props) {
    const role = useSession()?.role;
    const canSeeInactive = role === "ADMIN" || role === "FLEET_MANAGER";
    const [search, setSearch] = useState("");

    useEffect(() => {
        const timer = setTimeout(() => onQuery(search.trim()), 300);
        return () => clearTimeout(timer);
    }, [search, onQuery]);

    return (
        <Glass
            as="section"
            className={`filter-bar is-single${counts ? " is-pill" : ""}`}
            aria-label="Filtros"
        >
            <div className="filter-bar-row">
                {counts && (
                    <div className="segmented filter-segment" role="group" aria-label="Status">
                        <button
                            type="button"
                            aria-pressed={status === ""}
                            onClick={() => onStatus("")}
                        >
                            Todos <span className="num">{shown(total)}</span>
                        </button>
                        {statuses.map(([value, label]) => (
                            <button
                                key={value}
                                type="button"
                                aria-pressed={status === value}
                                onClick={() => onStatus(value)}
                            >
                                {label} <span className="num">{shown(counts[value])}</span>
                            </button>
                        ))}
                    </div>
                )}
                <label className="search-field">
                    <Search size={16} aria-hidden="true" />
                    <input
                        type="search"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder={placeholder}
                        aria-label={searchLabel}
                    />
                </label>
                {!counts && (
                    <label className="filter-field">
                        <span>Status</span>
                        <select value={status} onChange={(e) => onStatus(e.target.value)}>
                            <option value="">Todos</option>
                            {statuses.map(([value, label]) => (
                                <option key={value} value={value}>
                                    {label}
                                </option>
                            ))}
                        </select>
                    </label>
                )}
                {canSeeInactive && (
                    <label className="filter-toggle">
                        <input
                            type="checkbox"
                            className="check"
                            checked={includeInactive}
                            onChange={(e) => onIncludeInactive(e.target.checked)}
                        />
                        Mostrar inativos
                    </label>
                )}
                {action}
            </div>
        </Glass>
    );
}
