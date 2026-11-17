import { MapPin, MapPinOff, Search } from "lucide-react";
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import type { UseFormRegisterReturn } from "react-hook-form";
import type { Place } from "../../api/types";
import { EmptyState, ErrorState, Skeleton } from "../../components/blocks";
import { PAGE_SIZES, Pager } from "../../components/DataTable";
import type { MapMarker } from "../../components/MapView";
import Glass from "../../glass/Glass";
import HeroNumber from "../../patterns/HeroNumber";
import { GlassMapFrame } from "../../patterns/GlassMapFrame";

export interface Point {
    lat: number;
    lng: number;
}

export interface PickedPoint extends Point {
    at: number;
}

export const PICK_HINT = "Clique no mapa para marcar o ponto";

export const toNumber = (v: string) => Number(v.replace(",", "."));

export const coord = (min: number, max: number, empty: string, invalid: string) => ({
    validate: (v: string) => {
        if (v.trim() === "") return empty;
        const n = toNumber(v);
        return (Number.isFinite(n) && n >= min && n <= max) || invalid;
    },
});

function readPoint(lat: string, lng: string): Point | null {
    if (lat.trim() === "" || lng.trim() === "") return null;
    const a = toNumber(lat);
    const b = toNumber(lng);
    if (!Number.isFinite(a) || !Number.isFinite(b) || Math.abs(a) > 90 || Math.abs(b) > 180)
        return null;
    return { lat: a, lng: b };
}

export function PointFields({
    lat,
    lng,
    latText,
    lngText,
    latError,
    lngError,
    setPoint,
    picked,
    onDraft,
    inline,
    markerKind,
}: {
    lat: UseFormRegisterReturn;
    lng: UseFormRegisterReturn;
    latText: string;
    lngText: string;
    latError?: string;
    lngError?: string;
    setPoint: (lat: number, lng: number) => void;
    picked: PickedPoint | null;
    onDraft: (point: Point | null) => void;
    inline: boolean;
    markerKind: MapMarker["kind"];
}) {
    const point = readPoint(latText, lngText);
    const pointLat = point?.lat ?? null;
    const pointLng = point?.lng ?? null;

    useEffect(() => {
        if (picked) setPoint(picked.lat, picked.lng);
    }, [picked, setPoint]);

    useEffect(() => {
        onDraft(pointLat == null || pointLng == null ? null : { lat: pointLat, lng: pointLng });
    }, [pointLat, pointLng, onDraft]);

    useEffect(() => () => onDraft(null), [onDraft]);

    return (
        <>
            <p className="field-help">
                {inline
                    ? "Toque no mapa para marcar o ponto. A latitude e a longitude são preenchidas por ele."
                    : "Clique no mapa ao lado para marcar o ponto. A latitude e a longitude são preenchidas por ele."}
            </p>
            {inline && (
                <GlassMapFrame
                    className="atlas-pick-map"
                    markers={
                        point ? [{ id: "draft", kind: markerKind, ...point, title: "Ponto" }] : []
                    }
                    onPick={setPoint}
                    pickHint={PICK_HINT}
                />
            )}
            <div className="point-grid">
                <div className="field">
                    <label htmlFor="place-lat">Latitude</label>
                    <input
                        id="place-lat"
                        inputMode="decimal"
                        className="data"
                        aria-invalid={!!latError}
                        {...lat}
                    />
                    {latError && <p className="field-error">{latError}</p>}
                </div>
                <div className="field">
                    <label htmlFor="place-lng">Longitude</label>
                    <input
                        id="place-lng"
                        inputMode="decimal"
                        className="data"
                        aria-invalid={!!lngError}
                        {...lng}
                    />
                    {lngError && <p className="field-error">{lngError}</p>}
                </div>
            </div>
        </>
    );
}

export function PlaceAtlas({
    heroLabel,
    total,
    searchLabel,
    onQuery,
    filters,
    items,
    error,
    onRetry,
    emptyTitle,
    emptyAction,
    selectedId,
    onSelect,
    renderMeta,
    renderActions,
    limit,
    offset,
    onPage,
    markerKind,
    draft,
    editingId,
    picking,
    onPick,
}: {
    heroLabel: string;
    total: number | undefined;
    searchLabel: string;
    onQuery: (q: string) => void;
    filters?: ReactNode;
    items: Place[] | undefined;
    error?: string;
    onRetry: () => void;
    emptyTitle: string;
    emptyAction?: ReactNode;
    selectedId: string | null;
    onSelect: (id: string | null) => void;
    renderMeta?: (place: Place) => ReactNode;
    renderActions?: (place: Place) => ReactNode;
    limit: number;
    offset: number;
    onPage: (offset: number, limit: number) => void;
    markerKind: MapMarker["kind"];
    draft: Point | null;
    editingId: string | null;
    picking: boolean;
    onPick: (lat: number, lng: number) => void;
}) {
    const [search, setSearch] = useState("");

    useEffect(() => {
        const timer = setTimeout(() => onQuery(search.trim()), 300);
        return () => clearTimeout(timer);
    }, [search, onQuery]);

    const markers: MapMarker[] = (items ?? []).flatMap((p) =>
        p.lat == null || p.lng == null || (picking && p.publicId === editingId)
            ? []
            : [
                  {
                      id: p.publicId,
                      kind: markerKind,
                      lat: p.lat,
                      lng: p.lng,
                      title: p.name,
                      dimmed: !p.active || (picking && p.publicId !== editingId),
                      selected: !picking && p.publicId === selectedId,
                  },
              ],
    );
    if (picking && draft) {
        markers.push({ id: "draft", kind: markerKind, ...draft, title: "Ponto", selected: true });
    }

    let list: ReactNode;
    if (error) {
        list = <ErrorState message={error} onRetry={onRetry} />;
    } else if (!items) {
        list = (
            <div className="atlas-skeleton" aria-busy="true">
                {Array.from({ length: 5 }, (_, i) => (
                    <Skeleton key={i} height={52} />
                ))}
            </div>
        );
    } else if (items.length === 0) {
        list = <EmptyState icon={MapPin} title={emptyTitle} action={emptyAction} />;
    } else {
        list = (
            <ul className="atlas-items">
                {items.map((p, i) => {
                    const selected = p.publicId === selectedId;
                    const located = p.lat != null && p.lng != null;
                    const Icon = located ? MapPin : MapPinOff;
                    return (
                        <li
                            key={p.publicId}
                            className={`${selected ? "is-selected" : ""}${p.active ? "" : " is-inactive"}`}
                            style={{ "--i": Math.min(i, 12) } as CSSProperties}
                        >
                            <button
                                type="button"
                                className="atlas-item"
                                aria-pressed={selected}
                                onClick={() => onSelect(selected ? null : p.publicId)}
                            >
                                <span className="atlas-item-icon" aria-hidden="true">
                                    <Icon size={16} />
                                </span>
                                <span className="atlas-item-text">
                                    <b>{p.name}</b>
                                    <small>{p.address || "Sem endereço"}</small>
                                    {renderMeta?.(p)}
                                    {!located && <small>Sem ponto no mapa</small>}
                                </span>
                                {!p.active && <span className="badge badge-neutral">Inativo</span>}
                            </button>
                            {selected && renderActions && (
                                <div className="atlas-item-actions">{renderActions(p)}</div>
                            )}
                        </li>
                    );
                })}
            </ul>
        );
    }

    return (
        <div className={`atlas${picking ? " is-picking" : ""}`}>
            <Glass as="section" className="atlas-list" aria-label={searchLabel}>
                <div className="atlas-head">
                    <HeroNumber size="large" label={heroLabel} value={total ?? null} />
                    <div className="atlas-tools">
                        <label className="search-field">
                            <Search size={16} aria-hidden="true" />
                            <input
                                type="search"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Buscar por nome ou endereço"
                                aria-label={searchLabel}
                            />
                        </label>
                        {filters}
                    </div>
                </div>
                <div className="atlas-scroll">{list}</div>
                {(total ?? 0) > PAGE_SIZES[0] && (
                    <Pager total={total ?? 0} limit={limit} offset={offset} onPage={onPage} />
                )}
            </Glass>
            <GlassMapFrame
                className="atlas-map"
                markers={markers}
                fit={!picking}
                focusId={picking ? "draft" : selectedId}
                onMarkerClick={picking ? undefined : (id) => onSelect(id)}
                onPick={picking ? onPick : undefined}
                pickHint={picking ? PICK_HINT : undefined}
            />
        </div>
    );
}
