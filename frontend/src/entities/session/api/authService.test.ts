import { beforeEach, describe, expect, it } from "vitest";
import { mockBackend } from "@mocks/mockBackend";
import { signIn, signUp } from "./authService";

describe("demo auth", () => {
    beforeEach(() => localStorage.clear());

    it("создаёт стабильного пользователя и хранит только hash пароля", async () => {
        const registered = await signUp("Анна", "Anna@example.ru", "secret1");
        const authenticated = await signIn("anna@example.ru", "secret1");
        expect(authenticated).toEqual(registered);
        expect(mockBackend.getUsers()[0].passwordHash).not.toContain("secret1");
    });

    it("отклоняет неверный пароль", async () => {
        await signUp("Анна", "anna@example.ru", "secret1");
        await expect(signIn("anna@example.ru", "wrong-password")).rejects.toThrow(
            "Неверный логин или пароль",
        );
    });
});
