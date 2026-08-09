import type { SessionUser } from "@/entities/session";
import { mockBackend } from "@mocks/mockBackend";

const hashPassword = async (password: string) => {
    const bytes = new TextEncoder().encode(password);
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join(
        "",
    );
};

export const signUp = async (
    name: string,
    login: string,
    password: string,
): Promise<SessionUser> => {
    const normalizedLogin = login.trim().toLowerCase();
    if (mockBackend.getUsers().some((user) => user.login === normalizedLogin)) {
        throw new Error("Пользователь с таким логином уже существует");
    }
    const user = {
        id: crypto.randomUUID(),
        name: name.trim(),
        login: normalizedLogin,
        passwordHash: await hashPassword(password),
    };
    mockBackend.saveUser(user);
    return { id: user.id, name: user.name, login: user.login };
};

export const signIn = async (login: string, password: string): Promise<SessionUser> => {
    const normalizedLogin = login.trim().toLowerCase();
    const passwordHash = await hashPassword(password);
    const user = mockBackend
        .getUsers()
        .find(
            (candidate) =>
                candidate.login === normalizedLogin && candidate.passwordHash === passwordHash,
        );
    if (!user) throw new Error("Неверный логин или пароль");
    return { id: user.id, name: user.name, login: user.login };
};
