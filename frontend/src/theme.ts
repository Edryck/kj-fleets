export type Theme = "dark" | "light";

const STORAGE_KEY = "kjfleets.theme";

export function readTheme(): Theme {
    try {
        return localStorage.getItem(STORAGE_KEY) === "light" ? "light" : "dark";
    } catch {
        return "dark";
    }
}

export function applyTheme(theme: Theme): void {
    document.documentElement.dataset.theme = theme;
    try {
        localStorage.setItem(STORAGE_KEY, theme);
    } catch {
        // storage bloqueado (aba privada, sem permissão): o tema vale só nesta carga
    }
}

export function toggleTheme(): Theme {
    const next: Theme = readTheme() === "dark" ? "light" : "dark";
    applyTheme(next);
    return next;
}
