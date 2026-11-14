import { describe, expect, it } from "vitest";
import { messageFor } from "./errors";

describe("messageFor", () => {
    it("código conhecido usa o texto mapeado", () => {
        expect(messageFor("USERNAME_TAKEN", "x")).toBe(
            "Esse usuário já existe (mesmo desativado).",
        );
    });
    it("código desconhecido usa a mensagem da API", () => {
        expect(messageFor("ALGO_NOVO", "Mensagem da API")).toBe("Mensagem da API");
    });
    it("nunca mostra status HTTP", () => {
        expect(messageFor("ALGO_NOVO", "")).not.toMatch(/\d{3}/);
    });
});
