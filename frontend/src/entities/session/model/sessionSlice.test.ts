import { configureStore } from "@reduxjs/toolkit";
import { beforeEach, describe, expect, it } from "vitest";
import { sessionReducer, signedIn, signedOut } from "./sessionSlice";

describe("sessionSlice", () => {
    beforeEach(() => localStorage.clear());

    it("сохраняет сессию при входе и удаляет её при выходе", () => {
        const store = configureStore({ reducer: sessionReducer });
        store.dispatch(signedIn({ id: "user-1", name: "Анна", login: "anna" }));
        expect(JSON.parse(localStorage.getItem("avito-fair-queue:session:v1") ?? "null")).toEqual({
            id: "user-1",
            name: "Анна",
            login: "anna",
        });
        store.dispatch(signedOut());
        expect(store.getState().user).toBeNull();
        expect(localStorage.getItem("avito-fair-queue:session:v1")).toBeNull();
    });
});
