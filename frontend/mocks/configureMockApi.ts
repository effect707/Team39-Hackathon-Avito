import { configureBaseQuery, backendQuery } from "@/shared/api/baseApi";
import { isMockApi } from "./config";
import { mockBaseQuery } from "./mockBaseQuery";

export const configureMockApi = () => {
    if (isMockApi) {
        configureBaseQuery(mockBaseQuery);
        return;
    }

    configureBaseQuery(backendQuery);
};
