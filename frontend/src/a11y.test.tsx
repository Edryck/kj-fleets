import { screen } from "@testing-library/react";
import { Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import type { Role } from "./api/types";
import StatusBadge from "./components/StatusBadge";
import Shell from "./layout/Shell";
import glassCss from "./styles/glass.css?raw";
import tokensCss from "./styles/tokens.css?raw";
import { renderAt } from "./test/render";

vi.mock("./api/http", async (importOriginal) => ({
    ...(await importOriginal<typeof import("./api/http")>()),
    request: vi.fn(() => new Promise(() => {})),
}));
vi.mock("./map/MapStage", () => ({ default: () => null }));
vi.mock("./realtime/stomp", async (importOriginal) => ({
    ...(await importOriginal<typeof import("./realtime/stomp")>()),
    connect: () => {},
    disconnect: () => {},
}));
vi.mock("./realtime/useTopic", () => ({
    useTopic: () => {},
    useTopics: () => {},
    useConnectionState: () => "connected",
    useReloadOnReconnect: () => {},
    useOrderEventsInvalidation: () => {},
}));

const flatTokens = tokensCss.replace(/\s+/g, " ");

function themeColor(theme: "dark" | "light", name: string): string {
    const start = flatTokens.indexOf(`[data-theme="${theme}"]`);
    const block = flatTokens.slice(start, flatTokens.indexOf("}", start));
    const match = block.match(new RegExp(`${name}: (#[0-9a-fA-F]{6})`));
    if (!match) throw new Error(`${name} missing in ${theme}`);
    return match[1];
}

function luminance(hex: string): number {
    const channel = (i: number) => {
        const c = parseInt(hex.slice(i, i + 2), 16) / 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

function contrast(a: string, b: string): number {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
}

function renderShellAs(role: Role, path: string) {
    return renderAt(
        path,
        <Routes>
            <Route element={<Shell />}>
                <Route path="*" element={<p>conteúdo</p>} />
            </Route>
        </Routes>,
        { role },
    );
}

describe("accessibility", () => {
    it.each(["ADMIN", "DISPATCHER", "FLEET_MANAGER", "CUSTOMER"] as const)(
        "every button in the %s shell has an accessible name",
        (role) => {
            renderShellAs(role, "/dashboard");
            const buttons = screen.getAllByRole("button");
            expect(buttons.length).toBeGreaterThan(2);
            for (const button of buttons) expect(button).toHaveAccessibleName();
        },
    );

    it("every rail link has an accessible name", () => {
        renderShellAs("ADMIN", "/dashboard");
        for (const link of screen.getAllByRole("link")) expect(link).toHaveAccessibleName();
    });

    it("status pills always carry a text label, never color alone", () => {
        renderAt("/x", <StatusBadge kind="vehicle" value="MAINTENANCE" />);
        expect(screen.getByText("Manutenção")).toBeInTheDocument();
    });

    it.each(["dark", "light"] as const)(
        "text tokens reach 4.5:1 on the %s background and on solid surfaces",
        (theme) => {
            const failing: string[] = [];
            for (const fg of [
                "--color-text",
                "--color-text-muted",
                "--color-text-subtle",
                "--color-link",
                "--color-success",
                "--color-warning",
                "--color-danger",
                "--color-info",
                "--color-offline",
            ]) {
                for (const bg of ["--color-bg", "--color-solid-raised"]) {
                    const ratio = contrast(themeColor(theme, fg), themeColor(theme, bg));
                    if (ratio < 4.5) failing.push(`${fg} on ${bg} = ${ratio.toFixed(2)}`);
                }
            }
            expect(failing).toEqual([]);
        },
    );

    it("reduced transparency renders solid surfaces", () => {
        expect(glassCss).toMatch(
            /prefers-reduced-transparency:\s*reduce[\s\S]*background:\s*var\(--color-solid-raised\)/,
        );
    });
});
