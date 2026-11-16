import { mountGlassDefs } from "./glassRegistry";

const HIDDEN = { position: "absolute", width: 0, height: 0, pointerEvents: "none" } as const;

export default function GlassDefs() {
    return (
        <svg
            ref={mountGlassDefs}
            aria-hidden="true"
            focusable="false"
            width="0"
            height="0"
            style={HIDDEN}
        />
    );
}
