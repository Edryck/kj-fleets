import { act, render, renderHook, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { setReducedMotion } from "../../test/motion";
import { driverRow } from "./fixtures";
import { StatCell, ppDelta, useFramePoints, useNow } from "./dashParts";

afterEach(() => vi.useRealTimers());

describe("ppDelta", () => {
    it("compares two rates in percentage points", () => {
        expect(ppDelta({ rate: 0.93, n: 120 }, { rate: 0.907, n: 100 })).toEqual({
            diff: 2.3,
            text: "+2,3 p.p.",
            tone: "success",
        });
        expect(ppDelta({ rate: 0.9, n: 10 }, { rate: 0.95, n: 10 })?.text).toBe("-5 p.p.");
    });

    it("says 'igual' for the same rate and nothing without a previous rate", () => {
        expect(ppDelta({ rate: 0.9, n: 10 }, { rate: 0.9, n: 8 })?.text).toBe("igual");
        expect(ppDelta({ rate: 0.9, n: 10 }, null)).toBeNull();
        expect(ppDelta({ rate: null, n: 0 }, { rate: 0.9, n: 8 })).toBeNull();
    });
});

describe("useNow", () => {
    it("ticks on the given interval", () => {
        vi.useFakeTimers();
        vi.setSystemTime(1_000_000);
        const { result } = renderHook(() => useNow(30_000));
        expect(result.current).toBe(1_000_000);
        act(() => vi.advanceTimersByTime(30_000));
        expect(result.current).toBe(1_030_000);
    });
});

describe("StatCell", () => {
    it("shows the value with its unit, the label with the delta and an optional sub line", () => {
        setReducedMotion(true);
        render(
            <StatCell
                label="Falhas · 3%"
                value={4}
                unit="min"
                delta={<span>+1</span>}
                sub="6 cancelados · 4 pelo cliente · 2 pela equipe"
            />,
        );
        expect(screen.getByText("4")).toBeInTheDocument();
        expect(screen.getByText("min")).toBeInTheDocument();
        expect(screen.getByText("Falhas · 3%").parentElement?.textContent).toBe("Falhas · 3%+1");
        expect(
            screen.getByText("6 cancelados · 4 pelo cliente · 2 pela equipe"),
        ).toBeInTheDocument();
    });
});

describe("useFramePoints", () => {
    it("keeps the framing while the same drivers move", () => {
        const first = [
            driverRow("d1", { lat: -24.5, lng: -54.0 }),
            driverRow("d2", { lat: -24.7, lng: -54.2 }),
        ];
        const { result, rerender } = renderHook(({ drivers }) => useFramePoints(drivers), {
            initialProps: { drivers: first },
        });
        const framed = result.current;
        expect(framed).toEqual([
            [-24.5, -54.0],
            [-24.7, -54.2],
        ]);
        rerender({
            drivers: [
                driverRow("d2", { lat: -24.71, lng: -54.21 }),
                driverRow("d1", { lat: -24.51, lng: -54.01 }),
            ],
        });
        expect(result.current).toBe(framed);
    });

    it("reframes when the set of located drivers changes", () => {
        const { result, rerender } = renderHook(({ drivers }) => useFramePoints(drivers), {
            initialProps: { drivers: [driverRow("d1", { lat: -24.5, lng: -54.0 })] },
        });
        rerender({ drivers: [driverRow("d3", { lat: -25.0, lng: -53.5 })] });
        expect(result.current).toEqual([[-25.0, -53.5]]);
        rerender({ drivers: [driverRow("d3", { lat: null, lng: null })] });
        expect(result.current).toEqual([]);
    });
});
