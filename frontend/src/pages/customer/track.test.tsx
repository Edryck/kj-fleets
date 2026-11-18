import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../../api/http";
import type { TrackResponse } from "../../api/types";
import { timelineFromEvents } from "../../patterns/eventTimeline";
import { setReducedMotion } from "../../test/motion";
import { renderAt } from "../../test/render";
import Track from "../Track";

const { mockRequest } = vi.hoisted(() => ({ mockRequest: vi.fn() }));

vi.mock("../../api/http", async (importOriginal) => ({
    ...(await importOriginal<typeof import("../../api/http")>()),
    request: mockRequest,
}));

const response = (extra: Partial<TrackResponse> = {}): TrackResponse => ({
    trackingNumber: "KJ7Q2M9XAB",
    status: "DISPATCHED",
    createdAt: "2026-11-16T12:00:00Z",
    finishedAt: null,
    etaMinutes: null,
    timeline: [
        { code: "created", status: "CREATED", at: "2026-11-16T12:00:00Z" },
        { code: "dispatched", status: "DISPATCHED", at: "2026-11-16T12:20:00Z" },
    ],
    ...extra,
});

const show = (code = "KJ7Q2M9XAB") =>
    renderAt(
        `/track/${code}`,
        <Routes>
            <Route path="/track/:trackingNumber" element={<Track />} />
        </Routes>,
    );

beforeEach(() => {
    setReducedMotion(true);
    mockRequest.mockReset();
});

describe("timelineFromEvents", () => {
    it("maps tracking events to a timeline with the latest one as current", () => {
        const items = timelineFromEvents([
            { code: "created", status: "CREATED", at: "2026-11-16T12:00:00Z" },
            { code: "dispatched", status: "DISPATCHED", at: "2026-11-16T12:20:00Z" },
        ]);
        expect(items.map((i) => i.state)).toEqual(["done", "next"]);
        expect(items.map((i) => i.name)).toEqual(["Pedido criado", "Despachado"]);
    });

    it("marks every event done once the order is finished", () => {
        const items = timelineFromEvents([
            { code: "created", status: "CREATED", at: "2026-11-16T12:00:00Z" },
            { code: "completed", status: "COMPLETED", at: "2026-11-16T13:00:00Z" },
        ]);
        expect(items.map((i) => i.state)).toEqual(["done", "done"]);
    });
});

describe("public tracking", () => {
    it("shows a glass card with the big status and the event timeline over the ambient background", async () => {
        mockRequest.mockResolvedValue(response());
        show();
        expect(await screen.findByRole("heading", { name: "Despachado" })).toBeInTheDocument();
        expect(screen.getByRole("list", { name: "Eventos" })).toBeInTheDocument();
        expect(screen.queryByText("Chegada estimada")).toBeNull();
        expect(document.querySelector(".ambient")).not.toBeNull();
    });

    it("shows the API ETA once the driver is moving", async () => {
        mockRequest.mockResolvedValue(response({ status: "DRIVER_ENROUTE", etaMinutes: 38 }));
        show();
        expect(await screen.findByRole("heading", { name: "A caminho" })).toBeInTheDocument();
        const eta = screen.getByText("Chegada estimada").closest(".hero-number")!;
        expect(eta.textContent).toContain("38");
    });

    it("asks to check the code when it is not found", async () => {
        mockRequest.mockRejectedValue(new ApiError(404, "NOT_FOUND", "não encontrado"));
        show("KJ000");
        expect(await screen.findByText("Código não encontrado")).toBeInTheDocument();
        await userEvent.click(screen.getByRole("button", { name: "Conferir o código" }));
        expect(document.activeElement).toBe(screen.getByLabelText("Código do pedido"));
    });
});
