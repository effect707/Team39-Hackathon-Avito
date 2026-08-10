import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { SessionUser } from "./types";

const STORAGE_KEY = "avito-fair-queue:session:v1";

const restoreSession = (): SessionUser | null => {
    try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") as SessionUser | null;
    } catch {
        return null;
    }
};

const sessionSlice = createSlice({
    name: "session",
    initialState: { user: restoreSession() },
    reducers: {
        signedIn(state, action: PayloadAction<SessionUser>) {
            state.user = action.payload;
            localStorage.setItem(STORAGE_KEY, JSON.stringify(action.payload));
        },
        signedOut(state) {
            state.user = null;
            localStorage.removeItem(STORAGE_KEY);
        },
    },
});

export const { signedIn, signedOut } = sessionSlice.actions;
export const sessionReducer = sessionSlice.reducer;
