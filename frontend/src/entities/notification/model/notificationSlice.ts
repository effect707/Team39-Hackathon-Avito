import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { AppNotification, UserNotification } from "./types";

const STORAGE_KEY = "avito-fair-queue:notifications:v1";
interface NotificationStorage {
    byUser: Record<string, AppNotification[]>;
    dismissedByUser: Record<string, string[]>;
}

const restoreStorage = (): NotificationStorage => {
    try {
        const value = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") as Partial<NotificationStorage> | null;
        return { byUser: value?.byUser ?? {}, dismissedByUser: value?.dismissedByUser ?? {} };
    } catch {
        return { byUser: {}, dismissedByUser: {} };
    }
};

let storage = restoreStorage();
const persistStorage = () => localStorage.setItem(STORAGE_KEY, JSON.stringify(storage));

const notificationSlice = createSlice({
    name: "notifications",
    initialState: { activeUserId: null as string | null, items: [] as AppNotification[], dismissedIds: [] as string[] },
    reducers: {
        notificationsHydrated(state, action: PayloadAction<string>) {
            storage = restoreStorage();
            state.activeUserId = action.payload;
            state.items = (storage.byUser[action.payload] ?? []).map((item) => ({ ...item }));
            state.dismissedIds = [...(storage.dismissedByUser[action.payload] ?? [])];
        },
        notificationAdded(state, action: PayloadAction<UserNotification>) {
            const { userId, notification } = action.payload;
            if (
                state.activeUserId !== userId ||
                state.dismissedIds.includes(notification.id) ||
                state.items.some((item) => item.id === notification.id)
            ) return;
            state.items.unshift(notification);
            storage.byUser[userId] = state.items.map((item) => ({ ...item }));
            persistStorage();
        },
        allNotificationsRead(state) {
            state.items.forEach((item) => { item.read = true; });
            if (state.activeUserId) {
                storage.byUser[state.activeUserId] = state.items.map((item) => ({ ...item }));
                persistStorage();
            }
        },
        notificationRead(state, action: PayloadAction<string>) {
            const notification = state.items.find((item) => item.id === action.payload);
            if (notification) notification.read = true;
            if (state.activeUserId) {
                storage.byUser[state.activeUserId] = state.items.map((item) => ({ ...item }));
                persistStorage();
            }
        },
        notificationsCleared(state) {
            if (state.activeUserId) {
                storage.byUser[state.activeUserId] = [];
                storage.dismissedByUser[state.activeUserId] = state.items.map((item) => item.id);
                persistStorage();
            }
            state.items = [];
            state.dismissedIds = state.activeUserId ? [...(storage.dismissedByUser[state.activeUserId] ?? [])] : [];
        },
        notificationsReset(state) {
            state.activeUserId = null;
            state.items = [];
            state.dismissedIds = [];
        },
    },
});

export const {
    notificationAdded,
    allNotificationsRead,
    notificationRead,
    notificationsCleared,
    notificationsHydrated,
    notificationsReset,
} = notificationSlice.actions;
export const notificationReducer = notificationSlice.reducer;
