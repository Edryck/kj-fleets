export type LegKind = "road" | "estimated" | "straight";

export interface MapLeg {
    kind: LegKind;
    // [lat, lng], como a API devolve
    points: [number, number][];
}

interface LegStop {
    lat: number | null;
    lng: number | null;
    path?: [number, number][] | null;
}

export const LEG_LABEL: Record<LegKind, string> = {
    road: "Rota pelas ruas",
    estimated: "Trecho estimado",
    straight: "Linha reta entre paradas",
};

// path vem na parada de chegada: é a perna que sai da parada anterior
export function legsFromStops(stops: LegStop[], straightMode: boolean): MapLeg[] {
    const legs: MapLeg[] = [];
    for (let i = 1; i < stops.length; i++) {
        const from = stops[i - 1];
        const to = stops[i];
        if (to.path && to.path.length > 1) {
            legs.push({ kind: "road", points: to.path });
        } else if (from.lat != null && from.lng != null && to.lat != null && to.lng != null) {
            legs.push({
                kind: straightMode ? "straight" : "estimated",
                points: [
                    [from.lat, from.lng],
                    [to.lat, to.lng],
                ],
            });
        }
    }
    return legs;
}

export function MapLegend({ legs }: { legs: MapLeg[] }) {
    const kinds = (Object.keys(LEG_LABEL) as LegKind[]).filter((k) =>
        legs.some((l) => l.kind === k),
    );
    if (kinds.length === 0) return null;
    return (
        <ul className="map-legend" aria-label="Legenda do mapa">
            {kinds.map((k) => (
                <li key={k}>
                    <span className={`legend-swatch legend-${k}`} aria-hidden="true" />
                    {LEG_LABEL[k]}
                </li>
            ))}
        </ul>
    );
}

export function FallbackNotice({ count }: { count: number }) {
    return (
        <p className="notice notice-warning" role="status">
            {count === 1
                ? "1 trecho não tem caminho pelas ruas e foi estimado em linha reta."
                : `${count} trechos não têm caminho pelas ruas e foram estimados em linha reta.`}
        </p>
    );
}
