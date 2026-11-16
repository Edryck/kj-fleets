import { createContext, useContext, useLayoutEffect, useRef, type ReactNode } from "react";

export interface TitleBlockConfig {
    title?: string;
    eyebrow?: ReactNode;
    meta?: ReactNode;
    actions?: ReactNode;
}

export interface TitleBlockStore {
    get(): TitleBlockConfig;
    set(owner: symbol, config: TitleBlockConfig): void;
    clear(owner: symbol): void;
    subscribe(listener: () => void): () => void;
}

const EMPTY: TitleBlockConfig = {};

export function createTitleBlockStore(): TitleBlockStore {
    let owner: symbol | null = null;
    let config = EMPTY;
    const listeners = new Set<() => void>();
    const notify = () => listeners.forEach((listener) => listener());
    return {
        get: () => config,
        set(next, value) {
            owner = next;
            config = value;
            notify();
        },
        clear(previous) {
            if (owner !== previous) return;
            owner = null;
            config = EMPTY;
            notify();
        },
        subscribe(listener) {
            listeners.add(listener);
            return () => {
                listeners.delete(listener);
            };
        },
    };
}

export const TitleBlockContext = createContext<TitleBlockStore | null>(null);

export function useTitleBlock(config: TitleBlockConfig): void {
    const store = useContext(TitleBlockContext);
    const owner = useRef<symbol | null>(null);
    owner.current ??= Symbol("title");

    useLayoutEffect(() => {
        store?.set(owner.current!, config);
    });

    useLayoutEffect(() => {
        const id = owner.current!;
        return () => store?.clear(id);
    }, [store]);
}
