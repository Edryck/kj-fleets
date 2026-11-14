import { CircleAlert, CircleCheck, X } from "lucide-react";
import { useSyncExternalStore } from "react";

interface ToastItem {
    id: number;
    kind: "success" | "error";
    text: string;
}

let items: ToastItem[] = [];
let nextId = 1;
const listeners = new Set<() => void>();

function push(kind: ToastItem["kind"], text: string) {
    const id = nextId++;
    items = [...items, { id, kind, text }];
    listeners.forEach((l) => l());
    setTimeout(() => dismiss(id), kind === "error" ? 8000 : 4000);
}

function dismiss(id: number) {
    items = items.filter((t) => t.id !== id);
    listeners.forEach((l) => l());
}

export const toast = {
    success: (text: string) => push("success", text),
    error: (text: string) => push("error", text),
};

export default function Toasts() {
    const list = useSyncExternalStore(
        (l) => {
            listeners.add(l);
            return () => listeners.delete(l);
        },
        () => items,
    );
    return (
        <div className="toasts" role="status" aria-live="polite">
            {list.map((t) => (
                <div key={t.id} className={`toast toast-${t.kind}`}>
                    {t.kind === "success" ? (
                        <CircleCheck size={18} aria-hidden="true" />
                    ) : (
                        <CircleAlert size={18} aria-hidden="true" />
                    )}
                    <span>{t.text}</span>
                    <button
                        type="button"
                        className="btn btn-ghost btn-icon"
                        onClick={() => dismiss(t.id)}
                        aria-label="Fechar aviso"
                    >
                        <X size={16} aria-hidden="true" />
                    </button>
                </div>
            ))}
        </div>
    );
}
