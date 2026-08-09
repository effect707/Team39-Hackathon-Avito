import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { AppNotification } from "./types";

const notificationSlice = createSlice({
    name: "notifications",
    initialState: { items: [] as AppNotification[] },
    reducers: {
        notificationAdded(state, action: PayloadAction<AppNotification>) {
            if (!state.items.some((item) => item.id === action.payload.id)) {
                state.items.unshift(action.payload);
            }
        },
        allNotificationsRead(state) {
            state.items.forEach((item) => {
                item.read = true;
            });
        },
        notificationRead(state, action: PayloadAction<string>) {
            const notification = state.items.find((item) => item.id === action.payload);
            if (notification) notification.read = true;
        },
        notificationsCleared(state) {
            state.items = [];
        },
    },
});

export const { notificationAdded, allNotificationsRead, notificationRead, notificationsCleared } =
    notificationSlice.actions;
export const notificationReducer = notificationSlice.reducer;
