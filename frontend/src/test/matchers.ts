type MatcherResult = { pass: boolean; message: () => string };

const describe = (el: unknown) =>
    el instanceof Element
        ? `<${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ""}${el.className && typeof el.className === "string" ? `.${el.className.split(/\s+/).join(".")}` : ""}>`
        : String(el);

const asElement = (received: unknown): Element => {
    if (!(received instanceof Element)) {
        throw new Error(`expected a DOM element, received ${describe(received)}`);
    }
    return received;
};

const result = (pass: boolean, positive: string, negative: string): MatcherResult => ({
    pass,
    message: () => (pass ? negative : positive),
});

export function accessibleName(el: Element): string {
    const label = el.getAttribute("aria-label");
    if (label?.trim()) return label.trim();
    const labelledBy = el.getAttribute("aria-labelledby");
    if (labelledBy) {
        const text = labelledBy
            .split(/\s+/)
            .map((id) => el.ownerDocument.getElementById(id)?.textContent ?? "")
            .join(" ")
            .replace(/\s+/g, " ")
            .trim();
        if (text) return text;
    }
    const alt = el.getAttribute("alt");
    if (alt?.trim()) return alt.trim();
    return (el.textContent ?? "").replace(/\s+/g, " ").trim();
}

const isDisabled = (el: Element) =>
    el.hasAttribute("disabled") ||
    el.getAttribute("aria-disabled") === "true" ||
    el.closest("fieldset[disabled]") !== null;

export const domMatchers = {
    toBeInTheDocument(received: unknown): MatcherResult {
        const el = asElement(received);
        const pass = el.ownerDocument.documentElement.contains(el);
        return result(
            pass,
            `expected ${describe(el)} to be in the document`,
            `expected ${describe(el)} not to be in the document`,
        );
    },

    toHaveAttribute(received: unknown, name: string, value?: string): MatcherResult {
        const el = asElement(received);
        const actual = el.getAttribute(name);
        const pass = value === undefined ? el.hasAttribute(name) : actual === value;
        const wanted = value === undefined ? `attribute "${name}"` : `${name}="${value}"`;
        return result(
            pass,
            `expected ${describe(el)} to have ${wanted}, found ${actual === null ? "none" : `"${actual}"`}`,
            `expected ${describe(el)} not to have ${wanted}`,
        );
    },

    toHaveClass(received: unknown, ...names: string[]): MatcherResult {
        const el = asElement(received);
        const wanted = names.flatMap((n) => n.split(/\s+/)).filter(Boolean);
        const pass = wanted.length > 0 && wanted.every((n) => el.classList.contains(n));
        return result(
            pass,
            `expected ${describe(el)} to have class ${wanted.join(" ")}`,
            `expected ${describe(el)} not to have class ${wanted.join(" ")}`,
        );
    },

    toBeDisabled(received: unknown): MatcherResult {
        const el = asElement(received);
        return result(
            isDisabled(el),
            `expected ${describe(el)} to be disabled`,
            `expected ${describe(el)} not to be disabled`,
        );
    },

    toBeEnabled(received: unknown): MatcherResult {
        const el = asElement(received);
        return result(
            !isDisabled(el),
            `expected ${describe(el)} to be enabled`,
            `expected ${describe(el)} not to be enabled`,
        );
    },

    toBeChecked(received: unknown): MatcherResult {
        const el = asElement(received);
        const pass =
            el instanceof HTMLInputElement && (el.type === "checkbox" || el.type === "radio")
                ? el.checked
                : el.getAttribute("aria-checked") === "true";
        return result(
            pass,
            `expected ${describe(el)} to be checked`,
            `expected ${describe(el)} not to be checked`,
        );
    },

    toHaveValue(received: unknown, value: unknown): MatcherResult {
        const el = asElement(received);
        let actual: unknown = null;
        if (el instanceof HTMLInputElement) {
            actual = el.type === "number" ? (el.value === "" ? null : Number(el.value)) : el.value;
        } else if (el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) {
            actual = el.value;
        }
        const pass = Object.is(actual, value);
        return result(
            pass,
            `expected ${describe(el)} to have value ${JSON.stringify(value)}, found ${JSON.stringify(actual)}`,
            `expected ${describe(el)} not to have value ${JSON.stringify(value)}`,
        );
    },

    toHaveAccessibleName(received: unknown, name?: string): MatcherResult {
        const el = asElement(received);
        const actual = accessibleName(el);
        const pass = name === undefined ? actual.length > 0 : actual === name;
        const wanted = name === undefined ? "an accessible name" : `accessible name "${name}"`;
        return result(
            pass,
            `expected ${describe(el)} to have ${wanted}, found "${actual}"`,
            `expected ${describe(el)} not to have ${wanted}`,
        );
    },
};
