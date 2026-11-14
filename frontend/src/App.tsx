import { useState } from "react";
import { readTheme, toggleTheme, type Theme } from "./theme";

export default function App() {
    const [theme, setTheme] = useState<Theme>(readTheme);

    return (
        <main style={{ padding: 32 }}>
            <h1>KJ Fleets</h1>
            <button type="button" onClick={() => setTheme(toggleTheme())}>
                Tema: {theme === "dark" ? "escuro" : "claro"}
            </button>
        </main>
    );
}
