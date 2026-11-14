const EMPTY = "—";

const number = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });

// rate é fração 0..1; null (n = 0) nunca vira "0%"
export function formatRate(rate: number | null | undefined): string {
    if (rate == null || !Number.isFinite(rate)) return EMPTY;
    // o epsilon evita 0.8765 virar 87,6 por erro de ponto flutuante
    return `${number.format(Math.round(rate * 1000 + 1e-9) / 10)}%`;
}

// busyPct e avgSavingsPct já vêm em 0..100
export function formatPercent(value: number | null | undefined): string {
    return value == null ? EMPTY : `${number.format(value)}%`;
}

export function formatMinutes(minutes: number | null | undefined): string {
    if (minutes == null) return EMPTY;
    const total = Math.round(minutes);
    if (total < 60) return `${total}min`;
    const hours = Math.floor(total / 60);
    const rest = total % 60;
    return rest === 0 ? `${hours}h` : `${hours}h ${rest}min`;
}

export function formatKm(km: number | null | undefined): string {
    return km == null ? EMPTY : `${number.format(km)} km`;
}

export function formatDateTime(iso: string | null | undefined, timeZone?: string): string {
    if (!iso) return EMPTY;
    return new Intl.DateTimeFormat("pt-BR", {
        dateStyle: "short",
        timeStyle: "short",
        timeZone,
    }).format(new Date(iso));
}

export function formatTime(iso: string, timeZone?: string): string {
    return new Intl.DateTimeFormat("pt-BR", { timeStyle: "medium", timeZone }).format(
        new Date(iso),
    );
}

// "há 12 s", "há 5 min"; chamada com `now` para a tela poder atualizar sem refetch
export function formatAgo(iso: string | null | undefined, now = Date.now()): string {
    if (!iso) return EMPTY;
    const seconds = Math.max(0, Math.round((now - Date.parse(iso)) / 1000));
    if (seconds < 60) return `há ${seconds} s`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `há ${minutes} min`;
    const hours = Math.floor(minutes / 60);
    return hours < 24 ? `há ${hours} h` : `há ${Math.floor(hours / 24)} d`;
}
