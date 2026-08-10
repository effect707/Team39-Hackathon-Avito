import { configureStore, createListenerMiddleware, isAnyOf } from "@reduxjs/toolkit";
import { baseApi } from "@/shared/api/baseApi";
import { notificationReducer, notificationsHydrated, notificationsReset } from "@/entities/notification";
import { sessionReducer, signedIn, signedOut } from "@/entities/session";
import { queueWatchReducer } from "@/entities/queue/model/queueWatchSlice";

const sessionListener = createListenerMiddleware();

sessionListener.startListening({
    matcher: isAnyOf(signedIn, signedOut),
    effect: (action, listenerApi) => {
        listenerApi.dispatch(baseApi.util.resetApiState());
        if (signedIn.match(action)) listenerApi.dispatch(notificationsHydrated(action.payload.id));
        else listenerApi.dispatch(notificationsReset());
    },
});

export const makeStore = () =>
    configureStore({
        reducer: {
            [baseApi.reducerPath]: baseApi.reducer,
            session: sessionReducer,
            queueWatch: queueWatchReducer,
            notifications: notificationReducer,
        },
        middleware: (getDefaultMiddleware) =>
            getDefaultMiddleware().prepend(sessionListener.middleware).concat(baseApi.middleware),
    });

export const store = makeStore();

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
