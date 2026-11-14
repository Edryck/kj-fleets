import { Search } from "lucide-react";
import { useEffect, useState } from "react";
import { useSession } from "../auth/session";

interface Props {
    searchLabel: string;
    placeholder: string;
    onQuery: (q: string) => void;
    statuses: [value: string, label: string][];
    status: string;
    onStatus: (status: string) => void;
    includeInactive: boolean;
    onIncludeInactive: (on: boolean) => void;
}

// o despacho só lê cadastros: sem toggle de inativos para ele
export default function CatalogFilters({
    searchLabel,
    placeholder,
    onQuery,
    statuses,
    status,
    onStatus,
    includeInactive,
    onIncludeInactive,
}: Props) {
    const role = useSession()?.role;
    const canSeeInactive = role === "ADMIN" || role === "FLEET_MANAGER";
    const [search, setSearch] = useState("");

    useEffect(() => {
        const timer = setTimeout(() => onQuery(search.trim()), 300);
        return () => clearTimeout(timer);
    }, [search, onQuery]);

    return (
        <section className="filters" aria-label="Filtros">
            <div className="filters-row">
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
                <label className="inline-field caption">
                    Status
                    <select value={status} onChange={(e) => onStatus(e.target.value)}>
                        <option value="">Todos</option>
                        {statuses.map(([value, label]) => (
                            <option key={value} value={value}>
                                {label}
                            </option>
                        ))}
                    </select>
                </label>
                {canSeeInactive && (
                    <label className="inline-field">
                        <input
                            type="checkbox"
                            className="check"
                            checked={includeInactive}
                            onChange={(e) => onIncludeInactive(e.target.checked)}
                        />
                        Mostrar inativos
                    </label>
                )}
            </div>
        </section>
    );
}
