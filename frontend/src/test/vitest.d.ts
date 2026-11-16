import "vitest";

declare module "vitest" {
    interface Assertion<T> {
        toBeInTheDocument(): void;
        toHaveAttribute(name: string, value?: string): void;
        toHaveClass(...names: string[]): void;
        toBeDisabled(): void;
        toBeEnabled(): void;
        toBeChecked(): void;
        toHaveValue(value: unknown): void;
        toHaveAccessibleName(name?: string): void;
        readonly __domTarget?: T;
    }
}
