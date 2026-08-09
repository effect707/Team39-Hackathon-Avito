import type { FetchBaseQueryError } from "@reduxjs/toolkit/query";

export const isMockApi = (import.meta.env.VITE_API_MODE ?? "mock") === "mock";

export const shouldUseMockFallback = (error: Pick<FetchBaseQueryError, "status">) =>
    error.status === 501;
