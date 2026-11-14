import { clearSession, getSession } from "../auth/session";
import type { ErrorResponse } from "./types";

export class ApiError extends Error {
    status: number;
    code: string;

    constructor(status: number, code: string, message: string) {
        super(message);
        this.status = status;
        this.code = code;
    }
}

const BASE_URL = import.meta.env.VITE_API_URL ?? "";

type Query = Record<string, string | number | boolean | undefined | (string | number)[]>;

function buildUrl(path: string, query?: Query): string {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query ?? {})) {
        if (value === undefined || value === "") continue;
        for (const item of Array.isArray(value) ? value : [value]) params.append(key, String(item));
    }
    const qs = params.toString();
    return `${BASE_URL}${path}${qs ? `?${qs}` : ""}`;
}

export async function request<T>(
    method: string,
    path: string,
    body?: unknown,
    query?: Query,
    { anonymous = false }: { anonymous?: boolean } = {},
): Promise<T> {
    // rota pública: nunca manda o token (um token vencido derrubaria a sessão à toa)
    const session = anonymous ? null : getSession();
    const headers: Record<string, string> = {};
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (session) headers.Authorization = `Bearer ${session.token}`;

    let response: Response;
    try {
        response = await fetch(buildUrl(path, query), {
            method,
            headers,
            body: body === undefined ? undefined : JSON.stringify(body),
        });
    } catch {
        throw new ApiError(0, "NETWORK_ERROR", "Sem conexão com o servidor.");
    }

    if (response.ok) {
        return (response.status === 204 ? undefined : await response.json()) as T;
    }

    // só derruba a sessão se havia uma: 401 do /auth/login (sem token) é credencial errada
    if (response.status === 401 && session) clearSession("expired");

    const error: Partial<ErrorResponse> = await response.json().catch(() => ({}));
    throw new ApiError(
        response.status,
        error.code ?? (response.status >= 500 ? "INTERNAL_ERROR" : "UNKNOWN"),
        error.message ?? "",
    );
}
