import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
    Alert,
    Alerts as AlertsData,
    GraphRoute,
    GraphStatus,
    Me,
    Meta,
    RoutingReport,
    YearlyTrends,
} from "../../api/types";
import { setReducedMotion } from "../../test/motion";
import { renderAt } from "../../test/render";
import { WithTitleBlock } from "../../test/titleBlock";
import Account from "../Account";
import Alerts from "../Alerts";
import RoadGraph from "../RoadGraph";
import Routing from "../Routing";
import Trends from "../Trends";

const { mockRequest, mapProps } = vi.hoisted(() => ({
    mockRequest: vi.fn(),
    mapProps: { current: null as null | Record<string, unknown> },
}));

vi.mock("../../patterns/GlassMapFrame", () => {
    const Frame = (props: Record<string, unknown>) => {
        mapProps.current = props;
        return <div data-testid="glass-map" />;
    };
    return { GlassMapFrame: Frame, default: Frame };
});

vi.mock("../../api/http", async (importOriginal) => ({
    ...(await importOriginal<typeof import("../../api/http")>()),
    request: mockRequest,
}));

const meta: Meta = {
    generatedAt: "2026-11-17T12:00:00Z",
    timezone: "America/Sao_Paulo",
    period: "now",
    from: null,
    to: null,
};

const ago = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();

const alert = (
    type: Alert["type"],
    severity: Alert["severity"],
    subjectType: string,
    subjectId: string,
    message: string,
    suggestedAction: string,
    minutes: number,
): Alert => ({
    type,
    severity,
    subjectType,
    subjectId,
    message,
    suggestedAction,
    since: ago(minutes),
});

const ALERTS: AlertsData = {
    meta,
    items: [
        alert(
            "DRIVER_NO_SIGNAL",
            "HIGH",
            "DRIVER",
            "drv-1",
            "Marcos sem sinal há 25 min",
            "Ligar para o motorista",
            25,
        ),
        alert(
            "DRIVER_NO_SIGNAL",
            "MEDIUM",
            "DRIVER",
            "drv-2",
            "Ana sem sinal há 12 min",
            "Aguardar o próximo sinal",
            12,
        ),
        alert(
            "DRIVER_NO_SIGNAL",
            "HIGH",
            "DRIVER",
            "drv-3",
            "Paulo sem sinal há 40 min",
            "Ligar para o motorista",
            40,
        ),
        alert(
            "STALE_ORDER",
            "MEDIUM",
            "ORDER",
            "ord-1",
            "Pedido parado há 40 min",
            "Despachar ou cancelar",
            40,
        ),
        alert(
            "STALE_ORDER",
            "LOW",
            "ORDER",
            "ord-2",
            "Pedido parado há 15 min",
            "Conferir o pedido",
            15,
        ),
    ],
    counts: { DRIVER_NO_SIGNAL: 3, STALE_ORDER: 2 },
};

const TRENDS: YearlyTrends = {
    meta,
    months: [
        {
            month: "2026-10",
            created: 4,
            completed: 3,
            failed: 1,
            cancelled: 0,
            successRate: { rate: 0.75, n: 4 },
            avgCycleMinutes: null,
            savedKm: null,
            avgSavingsPct: null,
        },
        {
            month: "2026-11",
            created: 2,
            completed: 2,
            failed: 0,
            cancelled: 0,
            successRate: { rate: 1, n: 2 },
            avgCycleMinutes: null,
            savedKm: null,
            avgSavingsPct: null,
        },
    ],
    byDriver: [],
};

const ROUTING: RoutingReport = {
    meta,
    routes: 12,
    plannedKm: 340.5,
    baselineKm: 402.3,
    savedKm: 61.8,
    avgSavingsPct: 15.4,
    byAlgorithm: {
        TWO_OPT: { routes: 8, savedKm: 44.1, avgSavingsPct: 16 },
        NEAREST_NEIGHBOR: { routes: 4, savedKm: 17.7, avgSavingsPct: 12 },
    },
    batchDispatchPct: { rate: 0.25, n: 12 },
};

const ME: Me = {
    publicId: "usr-1",
    username: "admin",
    role: "ADMIN",
    name: null,
    email: null,
    phone: null,
};

const GRAPH: GraphStatus = {
    mode: "ROAD",
    loaded: true,
    region: "Sul do Brasil",
    osmFile: "sul.osm.pbf",
    nodes: 1234567,
    edges: 2345678,
    importedAt: "2026-11-14T12:00:00Z",
    loadMillis: 8000,
    reason: null,
};

const PATH: [number, number][] = [
    [-25.43, -49.27],
    [-25.435, -49.275],
    [-25.44, -49.28],
];

const ROUTE: GraphRoute = { km: 1.4, path: PATH, distanceSource: "ROAD", ms: 12 };

beforeEach(() => {
    mapProps.current = null;
    setReducedMotion(true);
    mockRequest.mockReset();
    mockRequest.mockImplementation((_method: string, path: string) => {
        if (path === "/dashboard/alerts") return Promise.resolve(ALERTS);
        if (path === "/dashboard/trends/yearly") return Promise.resolve(TRENDS);
        if (path === "/dashboard/routing/savings") return Promise.resolve(ROUTING);
        if (path === "/me") return Promise.resolve(ME);
        if (path === "/graph/status") return Promise.resolve(GRAPH);
        if (path === "/graph/route") return Promise.resolve(ROUTE);
        return Promise.reject(new Error(`unexpected ${path}`));
    });
});

const show = (path: string, ui: JSX.Element, role: "ADMIN" | "CUSTOMER" = "ADMIN") =>
    renderAt(path, <WithTitleBlock>{ui}</WithTitleBlock>, { role });

describe("Alerts", () => {
    it("leads with the total and groups by type with a severity stripe", async () => {
        show("/alerts", <Alerts />);
        expect(await screen.findByText("Alertas ativos")).toBeInTheDocument();
        expect(screen.getByText("5")).toBeInTheDocument();
        const group = screen.getByRole("region", { name: /Motorista sem sinal/ });
        expect(group).toHaveAttribute("data-severity", "HIGH");
        expect(within(group).getByText("Marcos sem sinal há 25 min")).toBeInTheDocument();
        expect(within(group).getAllByText("Ligar para o motorista")).toHaveLength(2);
        expect(within(group).getByRole("link", { name: "drv-1" })).toHaveAttribute(
            "href",
            "/drivers/drv-1",
        );
    });

    it("re-groups by the filtered severity", async () => {
        show("/alerts", <Alerts />);
        await screen.findByText("Alertas ativos");
        await userEvent.click(screen.getByRole("button", { name: "Baixa" }));
        expect(screen.queryByRole("region", { name: /Motorista sem sinal/ })).toBeNull();
        expect(screen.getByRole("region", { name: /Pedido parado/ })).toHaveAttribute(
            "data-severity",
            "LOW",
        );
    });
});

describe("Trends", () => {
    it("leads with the year total", async () => {
        show("/analytics/trends", <Trends />);
        const label = await screen.findByText("Pedidos no ano");
        expect(label.closest(".hero-number")!.textContent).toContain("6");
    });
});

describe("Routing", () => {
    it("leads with saved km and shows batch dispatch", async () => {
        show("/analytics/routing", <Routing />);
        const label = await screen.findByText("km economizados");
        expect(label.closest(".hero-number")!.textContent).toContain("61,8");
        expect(
            screen.getByText("Despachos em lote").closest(".hero-number")!.textContent,
        ).toContain("25");
    });
});

describe("Account", () => {
    it("shows a large avatar with the initials", async () => {
        show("/account", <Account />);
        expect(await screen.findByText("AD")).toHaveClass("avatar-lg");
        expect(screen.getByRole("heading", { name: "Trocar senha" })).toBeInTheDocument();
    });
});

describe("RoadGraph", () => {
    it("shows the graph size large and draws the tested route on the glass map", async () => {
        show("/admin/graph", <RoadGraph />);
        expect(await screen.findByText("Carregado")).toBeInTheDocument();
        expect(screen.getByText("1.234.567").closest(".graph-figure")).not.toBeNull();
        expect(screen.getByText("2.345.678").closest(".graph-figure")).not.toBeNull();
        const pickAt = (lat: number, lng: number) =>
            act(() => (mapProps.current!.onPick as (a: number, b: number) => void)(lat, lng));
        pickAt(-25.43, -49.27);
        pickAt(-25.44, -49.28);
        await waitFor(() =>
            expect(mapProps.current!.legs).toEqual([{ kind: "road", points: PATH }]),
        );
        expect(await screen.findByText("1,4 km")).toBeInTheDocument();
    });
});
