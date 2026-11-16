import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RouteStop } from "../api/types";
import { setReducedMotion } from "../test/motion";
import DotMatrix from "./DotMatrix";
import HeroNumber from "./HeroNumber";
import MiniRoute from "./MiniRoute";
import { SidePanel, SidePanelLayout } from "./SidePanel";
import StopTimeline, { timelineFromRoute } from "./StopTimeline";
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
});
