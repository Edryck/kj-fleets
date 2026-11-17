import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RouteStop } from "../api/types";
import { setReducedMotion } from "../test/motion";
import Avatar from "./Avatar";
import DotMatrix from "./DotMatrix";
import HeroNumber from "./HeroNumber";
import MiniRoute from "./MiniRoute";
import { SidePanel, SidePanelLayout } from "./SidePanel";
import StopTimeline, { timelineFromOrder, timelineFromRoute } from "./StopTimeline";
import VehicleCard from "./VehicleCard";

describe("shared patterns", () => {
    beforeEach(() => setReducedMotion(true));

    it("HeroNumber shows label, value and unit", () => {
        render(<HeroNumber label="Taxa de sucesso · hoje" value={93} unit="%" />);
        expect(screen.getByText("Taxa de sucesso · hoje")).toBeInTheDocument();
        expect(screen.getByText("93")).toBeInTheDocument();
        expect(screen.getByText("%").tagName).toBe("SMALL");
    });

    it("timelineFromRoute marks the first unvisited stop as next", () => {
        const stops = [
            {
                seq: 0,
                type: "PICKUP",
                name: "Armazém",
                visitedAt: "2026-11-16T13:02:00Z",
                legKm: null,
            },
            { seq: 1, type: "WAYPOINT", name: "Bom Preço", visitedAt: null, legKm: 1.6 },
            { seq: 2, type: "DROPOFF", name: "CD Medianeira", visitedAt: null, legKm: 29.2 },
        ] as RouteStop[];
        expect(timelineFromRoute(stops).map((s) => [s.label, s.state, s.kind])).toEqual([
            ["R", "done", "pickup"],
            ["1", "next", "waypoint"],
            ["E", "todo", "dropoff"],
        ]);
    });

    it("timelineFromRoute treats the start point as the driver's departure, never the next stop", () => {
        const stops = [
            { seq: 0, type: "START", name: "", visitedAt: null, legKm: null },
            {
                seq: 1,
                type: "PICKUP",
                name: "Armazém",
                visitedAt: "2026-11-16T13:02:00Z",
                legKm: 45.9,
            },
            { seq: 2, type: "DROPOFF", name: "CD Medianeira", visitedAt: null, legKm: 29.2 },
        ] as RouteStop[];
        expect(timelineFromRoute(stops).map((s) => [s.name, s.state])).toEqual([
            ["Partida", "done"],
            ["Armazém", "done"],
            ["CD Medianeira", "next"],
        ]);
        const fresh = stops.map((s) => ({ ...s, visitedAt: null }));
        expect(timelineFromRoute(fresh).map((s) => s.state)).toEqual(["todo", "next", "todo"]);
    });

    it("timelineFromRoute leaves the distance out of a stop with no leg behind it", () => {
        const stops = [
            { seq: 0, type: "PICKUP", name: "Armazém", visitedAt: null, legKm: 0 },
            { seq: 1, type: "DROPOFF", name: "CD Medianeira", visitedAt: null, legKm: 29.2 },
        ] as RouteStop[];
        expect(timelineFromRoute(stops).map((s) => s.note)).toEqual(["Próxima", "29,2 km"]);
    });

    it("timelineFromRoute flags estimated legs on road routes and the visit radius", () => {
        const stops = [
            {
                seq: 0,
                type: "PICKUP",
                name: "Armazém",
                visitedAt: "2026-11-16T13:02:00Z",
                legKm: null,
                distanceM: 34.6,
                path: null,
            },
            {
                seq: 1,
                type: "WAYPOINT",
                name: "Bom Preço",
                visitedAt: null,
                legKm: 1.6,
                distanceM: null,
                path: null,
            },
            {
                seq: 2,
                type: "DROPOFF",
                name: "CD Medianeira",
                visitedAt: null,
                legKm: 29.2,
                distanceM: null,
                path: [
                    [0, 0],
                    [1, 1],
                ],
            },
        ] as RouteStop[];
        const notes = timelineFromRoute(stops, "ROAD").map((s) => s.note);
        expect(notes[0]).toMatch(/^Concluída às \d{2}:\d{2} · a 35 m do ponto$/);
        expect(notes[1]).toBe("Próxima · 1,6 km · trecho estimado");
        expect(notes[2]).toBe("29,2 km");
        expect(timelineFromRoute(stops, "HAVERSINE")[1].note).toBe("Próxima · 1,6 km");
    });

    it("StopTimeline renders an action for the stops that offer one", () => {
        render(
            <StopTimeline
                stops={[
                    { id: "1", kind: "pickup", label: "R", name: "Armazém", state: "done" },
                    { id: "2", kind: "waypoint", label: "1", name: "Bom Preço", state: "next" },
                ]}
                action={(stop) =>
                    stop.kind === "waypoint" ? <button type="button">Concluir</button> : null
                }
            />,
        );
        expect(screen.getAllByRole("button", { name: "Concluir" })).toHaveLength(1);
    });

    it("timelineFromOrder lists the order places, all done only once completed", () => {
        const order = {
            status: "DISPATCHED",
            pickup: { publicId: "p1", name: "Armazém" },
            waypoints: [{ publicId: "p2", name: "Bom Preço" }],
            dropoff: { publicId: "p3", name: "CD Medianeira" },
        } as Parameters<typeof timelineFromOrder>[0];
        expect(timelineFromOrder(order).map((s) => [s.label, s.name, s.state, s.kind])).toEqual([
            ["R", "Armazém", "todo", "pickup"],
            ["1", "Bom Preço", "todo", "waypoint"],
            ["E", "CD Medianeira", "todo", "dropoff"],
        ]);
        expect(timelineFromOrder({ ...order, status: "COMPLETED" }).map((s) => s.state)).toEqual([
            "done",
            "done",
            "done",
        ]);
    });

    it("StopTimeline renders an ordered list of stops", () => {
        render(
            <StopTimeline
                stops={[{ id: "a", kind: "pickup", label: "R", name: "Armazém", state: "done" }]}
            />,
        );
        expect(screen.getByRole("list", { name: "Paradas" }).tagName).toBe("OL");
    });

    it("MiniRoute pluralizes the waypoint count", () => {
        const { rerender } = render(<MiniRoute pickup="A" dropoff="B" waypoints={1} />);
        expect(screen.getByText("+1 parada")).toBeInTheDocument();
        rerender(<MiniRoute pickup="A" dropoff="B" waypoints={3} />);
        expect(screen.getByText("+3 paradas")).toBeInTheDocument();
    });

    it("DotMatrix changes the legend when scaled", () => {
        render(
            <MemoryRouter>
                <DotMatrix
                    unit={{ one: "pedido", many: "pedidos" }}
                    columns={[
                        {
                            key: "U",
                            label: "Sem motorista",
                            count: 30,
                            stale: 0,
                            color: "var(--color-warning)",
                        },
                    ]}
                />
            </MemoryRouter>,
        );
        expect(screen.getByText("1 ponto = 3 pedidos")).toBeInTheDocument();
        expect(screen.getByText("30")).toBeInTheDocument();
    });

    it("VehicleCard shows the render for known types and a fallback otherwise", () => {
        const { rerender } = render(<VehicleCard plate="BRA2E19" type="Van" status="IN_USE" />);
        expect(screen.getByAltText("Van BRA2E19")).toHaveAttribute("src", "/renders/van-34.webp");
        rerender(<VehicleCard plate="QQE6A14" type="Moto" status="AVAILABLE" />);
        expect(screen.getByText("Sem imagem para “Moto”")).toBeInTheDocument();
        rerender(<VehicleCard plate={null} />);
        expect(screen.getByText("Sem veículo atribuído")).toBeInTheDocument();
    });

    it("SidePanel closes with Escape and shifts the layout", async () => {
        const onClose = vi.fn();
        const { container } = render(
            <SidePanelLayout
                open
                panel={
                    <SidePanel title="Veículo" onClose={onClose}>
                        x
                    </SidePanel>
                }
            >
                <div>lista</div>
            </SidePanelLayout>,
        );
        expect(container.firstElementChild).toHaveClass("has-panel");
        expect(screen.getByRole("dialog", { name: "Veículo" })).toHaveAttribute(
            "aria-modal",
            "false",
        );
        await userEvent.keyboard("{Escape}");
        expect(onClose).toHaveBeenCalled();
        await userEvent.click(screen.getByRole("button", { name: "Fechar" }));
        expect(onClose).toHaveBeenCalledTimes(2);
    });

    it("Avatar shows up to two initials, hidden from assistive tech, in three sizes", () => {
        const { container } = render(
            <>
                <Avatar name="Marcos  Vieira da Silva" />
                <Avatar name="ana" size="lg" />
                <Avatar name="Bruno Teixeira" size="sm" />
            </>,
        );
        const [md, lg, sm] = Array.from(container.querySelectorAll(".avatar"));
        expect(md.textContent).toBe("MS");
        expect(md).toHaveAttribute("aria-hidden", "true");
        expect(md).toHaveClass("is-md");
        expect(lg.textContent).toBe("AN");
        expect(lg).toHaveClass("is-lg");
        expect(sm).toHaveClass("is-sm");
    });
});
