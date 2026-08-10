import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

const STORAGE_KEY = "avito-fair-queue:queue-watch:v1";

interface QueueWatchState {
    byUser: Record<string, string[]>;
}

const restoreQueueWatch = (): QueueWatchState => {
    try {
        const byUser = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as Record<
            string,
            string[]
        >;
        return { byUser };
    } catch {
        return { byUser: {} };
    }
};

const persistQueueWatch = (state: QueueWatchState) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.byUser));
};

const queueWatchSlice = createSlice({
    name: "queueWatch",
    initialState: restoreQueueWatch,
    reducers: {
        queueWatched(state, action: PayloadAction<{ userId: string; productId: string }>) {
            const { userId, productId } = action.payload;
            const productIds = state.byUser[userId] ?? [];
            if (!productIds.includes(productId)) state.byUser[userId] = [...productIds, productId];
            persistQueueWatch(state);
        },
        queueUnwatched(state, action: PayloadAction<{ userId: string; productId: string }>) {
            const { userId, productId } = action.payload;
            state.byUser[userId] = (state.byUser[userId] ?? []).filter((id) => id !== productId);
            persistQueueWatch(state);
        },
    },
});

export const { queueUnwatched, queueWatched } = queueWatchSlice.actions;
export const queueWatchReducer = queueWatchSlice.reducer;
