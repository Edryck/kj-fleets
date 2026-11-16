import { act, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useNavigate, type NavigateFunction } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import Glass from "../glass/Glass";
import { setReducedMotion } from "../test/motion";
import PageTransition from "./PageTransition";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

let navigateRef: NavigateFunction = () => {};

function Probe() {
    navigateRef = useNavigate();
    return null;
}

function renderTransition(path: string) {
    render(
        <MemoryRouter initialEntries={[path]}>
            <Probe />
            <Routes>
                <Route element={<PageTransition />}>
                    <Route path="/a" element={<Glass>página A</Glass>} />
                    <Route path="/b" element={<Glass>página B</Glass>} />
                </Route>
            </Routes>
        </MemoryRouter>,
    );
    return { navigate: (to: string) => void navigateRef(to) };
}

it("keeps the leaving page for 220 ms before showing the next one", async () => {
    setReducedMotion(false);
    const { navigate } = renderTransition("/a");
    act(() => navigate("/b"));
    expect(screen.getByText("página A")).toBeInTheDocument();
    expect(screen.getByRole("main")).toHaveAttribute("data-phase", "leaving");
    act(() => vi.advanceTimersByTime(220));
    expect(screen.getByText("página B")).toBeInTheDocument();
    expect(screen.getByRole("main")).toHaveAttribute("data-phase", "entering");
});

it("swaps immediately with reduced motion", () => {
    setReducedMotion(true);
    const { navigate } = renderTransition("/a");
    act(() => navigate("/b"));
    expect(screen.getByText("página B")).toBeInTheDocument();
});
