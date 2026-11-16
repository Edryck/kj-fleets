import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { legsFromStops, MapLegend, type MapLeg } from "./RouteLegs";

afterEach(cleanup);

const road: MapLeg = {
    kind: "road",
    points: [
        [0, 0],
        [0, 1],
    ],
};
const estimated: MapLeg = { ...road, kind: "estimated" };

describe("legenda do mapa", () => {
    it("mostra só os tipos presentes", () => {
        render(<MapLegend legs={[road]} />);
        expect(screen.getByText("Rota pelas ruas")).toBeTruthy();
        expect(screen.queryByText("Trecho estimado")).toBeNull();
    });

    it("mostra ruas e trecho estimado juntos", () => {
        render(<MapLegend legs={[road, estimated]} />);
        expect(screen.getByText("Rota pelas ruas")).toBeTruthy();
        expect(screen.getByText("Trecho estimado")).toBeTruthy();
    });

    it("sem pernas não renderiza legenda", () => {
        const { container } = render(<MapLegend legs={[]} />);
        expect(container.firstChild).toBeNull();
    });

    it("perna sem path vira estimada, ou linha reta no modo haversine", () => {
        const stops = [
            { lat: 1, lng: 1, path: null },
            { lat: 2, lng: 2, path: null },
            {
                lat: 3,
                lng: 3,
                path: [
                    [2, 2],
                    [3, 3],
                ] as [number, number][],
            },
        ];
        expect(legsFromStops(stops, false).map((l) => l.kind)).toEqual(["estimated", "road"]);
        expect(legsFromStops(stops, true).map((l) => l.kind)).toEqual(["straight", "road"]);
    });

    it("labels the original-order layer and plan arcs", () => {
        render(
            <MapLegend
                legs={[
                    {
                        kind: "original",
                        points: [
                            [0, 0],
                            [1, 1],
                        ],
                    },
                ]}
                arcs
            />,
        );
        expect(screen.getByText("Ordem original (linha reta)")).toBeInTheDocument();
        expect(screen.getByText("Atribuição do plano")).toBeInTheDocument();
    });
});
