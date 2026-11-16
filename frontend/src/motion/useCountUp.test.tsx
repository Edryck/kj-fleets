import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setReducedMotion } from "../test/motion";
import { useCountUp } from "./useCountUp";

function Probe({ value, decimals }: { value: number | null; decimals?: number }) {
    return <span data-testid="v">{useCountUp(value, { decimals })}</span>;
}

describe("useCountUp", () => {
    beforeEach(() =>
        vi.useFakeTimers({
            toFake: ["requestAnimationFrame", "performance", "setTimeout", "Date"],
        }),
    );
    afterEach(() => {
        vi.useRealTimers();
        vi.unstubAllGlobals();
    });

    it("counts from zero to the target", () => {
        setReducedMotion(false);
        render(<Probe value={93} />);
        expect(screen.getByTestId("v").textContent).toBe("0");
        act(() => vi.advanceTimersByTime(1600));
        expect(screen.getByTestId("v").textContent).toBe("93");
    });

    it("shows the final value at once with reduced motion", () => {
        setReducedMotion(true);
        render(<Probe value={606} />);
        expect(screen.getByTestId("v").textContent).toBe("606");
    });

    it("formats decimals in pt-BR and null as a dash", () => {
        setReducedMotion(true);
        const { rerender } = render(<Probe value={15.1} decimals={1} />);
        expect(screen.getByTestId("v").textContent).toBe("15,1");
        rerender(<Probe value={null} />);
        expect(screen.getByTestId("v").textContent).toBe("—");
    });

    it("animates from the previous value when it changes", () => {
        setReducedMotion(false);
        const { rerender } = render(<Probe value={10} />);
        act(() => vi.advanceTimersByTime(1600));
        rerender(<Probe value={20} />);
        act(() => vi.advanceTimersByTime(300));
        const mid = Number(screen.getByTestId("v").textContent);
        expect(mid).toBeGreaterThan(10);
        expect(mid).toBeLessThan(20);
        act(() => vi.advanceTimersByTime(400));
        expect(screen.getByTestId("v").textContent).toBe("20");
    });
});
