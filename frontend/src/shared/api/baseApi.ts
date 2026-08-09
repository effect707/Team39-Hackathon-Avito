import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import type { BaseQueryFn, FetchArgs, FetchBaseQueryError } from "@reduxjs/toolkit/query";

export const backendQuery = fetchBaseQuery({
    baseUrl: import.meta.env.VITE_API_URL ?? "/api/v1",
    prepareHeaders: (headers, { getState }) => {
        const state = getState() as { session?: { user?: { id?: string } | null } };
        const userId = state.session?.user?.id;
        if (userId) headers.set("X-Demo-User-ID", userId);
        return headers;
    },
});

let runtimeQuery: BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> = backendQuery;

export const configureBaseQuery = (
    query: BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError>,
) => {
    runtimeQuery = query;
};

export const baseApi = createApi({
    reducerPath: "api",
    baseQuery: (args, api, extraOptions) => runtimeQuery(args, api, extraOptions),
    tagTypes: ["Product", "Queue"],
    endpoints: () => ({}),
});
