import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import AlgorithmFields from "./AlgorithmFields";

afterEach(cleanup);

function Harness({ waypoints, start = "" }: { waypoints: number; start?: string }) {
    const [algorithm, setAlgorithm] = useState(start);
    const [seed, setSeed] = useState("");
    return (
        <AlgorithmFields
            algorithm={algorithm}
            onAlgorithm={setAlgorithm}
            seed={seed}
            onSeed={setSeed}
            waypointCount={waypoints}
        />
    );
}

describe("AlgorithmFields", () => {
    it("só mostra seed para têmpera simulada", async () => {
        render(<Harness waypoints={3} />);
        expect(screen.queryByLabelText("Seed")).toBeNull();
        await userEvent.selectOptions(screen.getByLabelText("Algoritmo"), "SIMULATED_ANNEALING");
        expect(screen.getByLabelText("Seed")).toBeTruthy();
        await userEvent.selectOptions(screen.getByLabelText("Algoritmo"), "TWO_OPT");
        expect(screen.queryByLabelText("Seed")).toBeNull();
    });

    it("desabilita Held-Karp com mais de 15 paradas e explica", () => {
        render(<Harness waypoints={16} />);
        const option = screen.getByRole("option", { name: /Held-Karp/ }) as HTMLOptionElement;
        expect(option.disabled).toBe(true);
        expect(option.title).toMatch(/até 15 paradas/);
    });

    it("libera Held-Karp com 15 paradas", () => {
        render(<Harness waypoints={15} />);
        expect(
            (screen.getByRole("option", { name: /Held-Karp/ }) as HTMLOptionElement).disabled,
        ).toBe(false);
    });
});
