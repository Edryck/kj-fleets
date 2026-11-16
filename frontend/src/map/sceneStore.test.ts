import { expect, it } from "vitest";
import { clearScene, getFollowState, getScene, publishScene, setFollowState } from "./sceneStore";

it("keeps the last published scene and ignores clears from stale owners", () => {
    const a = Symbol("a");
    const b = Symbol("b");
    publishScene(a, { markers: [] });
    publishScene(b, { markers: [{ id: "x", lat: 0, lng: 0, kind: "driver" }] });
    clearScene(a);
    expect(getScene()?.owner).toBe(b);
    clearScene(b);
    expect(getScene()).toBeNull();
});

it("resets the follow state when a new owner publishes", () => {
    const a = Symbol("a");
    const b = Symbol("b");
    publishScene(a, { markers: [] });
    setFollowState("suspended");
    publishScene(a, { markers: [] });
    expect(getFollowState()).toBe("suspended");
    publishScene(b, { markers: [] });
    expect(getFollowState()).toBe("following");
});
