import { cleanup } from "@testing-library/react";
import { afterEach, expect, vi } from "vitest";
import { domMatchers } from "./matchers";

expect.extend(domMatchers);

async function endSession() {
    try {
        const session = await import("../auth/session");
        session.clearSession();
    } catch {
        return;
    }
}

afterEach(async () => {
    cleanup();
    vi.unstubAllGlobals();
    await endSession();
});
