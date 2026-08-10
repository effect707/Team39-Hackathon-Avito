import { configureBaseQuery, backendQuery } from "@/shared/api/baseApi";
import { isMockApi, shouldUseMockFallback } from "./config";
import { mockBaseQuery } from "./mockBaseQuery";

export const configureMockApi = () => {
    if (isMockApi) {
        configureBaseQuery(mockBaseQuery);
        return;
    }

    configureBaseQuery(async (args, api, extraOptions) => {
        const result = await backendQuery(args, api, extraOptions);
        return result.error && shouldUseMockFallback(result.error)
            ? mockBaseQuery(args, api, extraOptions)
            : result;
    });
};
