import type { BaseQueryFn, FetchArgs, FetchBaseQueryError } from "@reduxjs/toolkit/query";
import type { RootState } from "@/app/providers/store/store";
import type { PaymentResultRequest } from "@/entities/queue";
import { mockBackend } from "./mockBackend";

export const mockBaseQuery: BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> = async (
    args,
    api,
) => {
    const request = typeof args === "string" ? { url: args, method: "GET" } : args;
    const method = request.method ?? "GET";
    const parts = request.url.split("/").filter(Boolean);
    const currentUserId = (api.getState() as RootState).session.user?.id ?? "";

    try {
        if (request.url === "/products")
            return { data: { products: await mockBackend.listProducts() } };

        if (parts[0] === "products" && parts.length === 2 && method === "GET")
            return { data: await mockBackend.getProduct(parts[1]) };

        if (parts[0] === "products" && parts[2] === "alternatives")
            return { data: { products: await mockBackend.getAlternatives(parts[1]) } };

        if (
            parts[0] === "products" &&
            parts[2] === "queue" &&
            parts[3] === "me" &&
            method === "GET"
        )
            return { data: await mockBackend.getQueueState(currentUserId, parts[1]) };

        if (
            parts[0] === "products" &&
            parts[2] === "queue" &&
            parts[3] === "join" &&
            method === "POST"
        )
            return { data: await mockBackend.joinQueue(currentUserId, parts[1]) };

        if (
            parts[0] === "products" &&
            parts[2] === "queue" &&
            parts[3] === "me" &&
            method === "DELETE"
        )
            return { data: await mockBackend.leaveQueue(currentUserId, parts[1]) };

        if (parts[0] === "grants" && parts[2] === "checkout") {
            const queueState = await mockBackend.startCheckout(currentUserId, parts[1]);
            return { data: { grant: queueState.grant } };
        }

        if (parts[0] === "demo" && parts[1] === "grants" && parts[3] === "payment-result")
            return {
                data: await mockBackend.submitPayment(
                    currentUserId,
                    parts[2],
                    request.body as PaymentResultRequest,
                ),
            };

        return { error: { status: 404, data: { message: "Mock endpoint not found" } } };
    } catch (error) {
        return {
            error: {
                status: 400,
                data: { message: error instanceof Error ? error.message : "Mock error" },
            },
        };
    }
};
