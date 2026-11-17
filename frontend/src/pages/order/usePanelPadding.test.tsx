import { render } from "@testing-library/react";
import { useRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { usePanelPadding } from "./usePanelPadding";

const observed = new Set<Element>();

class FakeResizeObserver {
    observe(el: Element) {
        observed.add(el);
    }
    unobserve(el: Element) {
        observed.delete(el);
    }
    disconnect() {
        observed.clear();
    }
}

function Panels({ loaded }: { loaded: boolean }) {
    const ref = useRef<HTMLDivElement>(null);
    usePanelPadding(ref);
    return (
        <div ref={ref}>
            <div className="order-side" />
            {loaded ? (
                <section className="order-strip" data-testid="route" />
            ) : (
                <div className="order-strip" data-testid="loading" />
            )}
        </div>
    );
}

afterEach(() => {
    vi.unstubAllGlobals();
    observed.clear();
});

describe("usePanelPadding", () => {
    it("watches the route strip that replaces the loading one", async () => {
        vi.stubGlobal("ResizeObserver", FakeResizeObserver);
        const { rerender, getByTestId } = render(<Panels loaded={false} />);
        expect(observed.has(getByTestId("loading"))).toBe(true);
        rerender(<Panels loaded />);
        await Promise.resolve();
        expect(observed.has(getByTestId("route"))).toBe(true);
    });
});
