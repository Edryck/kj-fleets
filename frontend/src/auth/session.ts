import { useQuery } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";
import { request } from "../api/http";
import type { LoginResponse, Me, Role } from "../api/types";

export interface Session {
    token: string;
    role: Role;
    expiresAt: number;
}

const TOKEN_KEY = "kjfleets.token";
const EXPIRES_KEY = "kjfleets.expiresAt";
const ROLE_KEY = "kjfleets.role";

let current: Session | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;
let expiredNotice = false;
const listeners = new Set<() => void>();

function notify() {
    listeners.forEach((listener) => listener());
}

function scheduleExpiry(session: Session) {
    clearTimeout(timer);
    // setTimeout estoura acima de ~24 dias; o JWT dura 8 h, então não passa disso
    timer = setTimeout(() => clearSession("expired"), Math.max(0, session.expiresAt - Date.now()));
}

function readStored(): Session | null {
    try {
        const token = sessionStorage.getItem(TOKEN_KEY);
        const role = sessionStorage.getItem(ROLE_KEY) as Role | null;
        const expiresAt = Date.parse(sessionStorage.getItem(EXPIRES_KEY) ?? "");
        if (!token || !role || Number.isNaN(expiresAt)) return null;
        return { token, role, expiresAt };
    } catch {
        return null;
    }
}

function clearStored() {
    try {
        sessionStorage.removeItem(TOKEN_KEY);
        sessionStorage.removeItem(EXPIRES_KEY);
        sessionStorage.removeItem(ROLE_KEY);
    } catch {
        // storage bloqueado: nada a limpar
    }
}

export function getSession(): Session | null {
    if (!current) {
        current = readStored();
        if (current) scheduleExpiry(current);
    }
    if (current && current.expiresAt <= Date.now()) clearSession("expired");
    return current;
}

export function startSession(response: LoginResponse): void {
    current = {
        token: response.token,
        role: response.role,
        expiresAt: Date.parse(response.expiresAt),
    };
    expiredNotice = false;
    try {
        sessionStorage.setItem(TOKEN_KEY, response.token);
        sessionStorage.setItem(EXPIRES_KEY, response.expiresAt);
        sessionStorage.setItem(ROLE_KEY, response.role);
    } catch {
        // sem storage a sessão vive só em memória
    }
    scheduleExpiry(current);
    notify();
}

// no-op se já estiver deslogado: evita notificar de novo e entrar em loop de redirect
export function clearSession(reason: "logout" | "expired" = "logout"): void {
    clearTimeout(timer);
    clearStored();
    if (!current) return;
    current = null;
    expiredNotice = reason === "expired";
    notify();
}

// ler e limpar separados: o StrictMode roda o inicializador do useState duas vezes
export function peekExpiredNotice(): boolean {
    return expiredNotice;
}

export function dismissExpiredNotice(): void {
    expiredNotice = false;
}

export function login(username: string, password: string): Promise<LoginResponse> {
    return request<LoginResponse>("POST", "/auth/login", { username, password }).then(
        (response) => {
            startSession(response);
            return response;
        },
    );
}

export const logout = () => clearSession("logout");

export function subscribeSession(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

export function useSession(): Session | null {
    return useSyncExternalStore(subscribeSession, getSession);
}

export function useMe() {
    const session = useSession();
    return useQuery({
        queryKey: ["me", session?.token],
        queryFn: () =>
            request<Me>("GET", "/me").then((me) => {
                syncRole(me.role);
                return me;
            }),
        enabled: !!session,
    });
}

// o perfil pode mudar no servidor (admin trocou); a API já usa o novo, então o menu e as guardas acompanham
function syncRole(role: Role) {
    if (!current || current.role === role) return;
    current = { ...current, role };
    try {
        sessionStorage.setItem(ROLE_KEY, role);
    } catch {
        // sem storage: vale só em memória
    }
    notify();
}

// só para testes
export function resetSessionForTests() {
    clearTimeout(timer);
    current = null;
    expiredNotice = false;
    listeners.clear();
}
