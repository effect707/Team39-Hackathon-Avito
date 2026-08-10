import type { BaseQueryFn, FetchArgs, FetchBaseQueryError } from "@reduxjs/toolkit/query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { makeStore } from "@/app/providers/store/store";
import { signedIn } from "@/entities/session";
import type { QueueState } from "@/entities/queue/model/types";
import { configureBaseQuery } from "@/shared/api/baseApi";
import { mockBaseQuery } from "@mocks/mockBaseQuery";
import { queueApi } from "./queueApi";

const userId = "40000000-0000-4000-8000-000000000001";
const productId = "10000000-0000-4000-8000-000000000001";
const queueState: QueueState = {
    queue_entry_id: "30000000-0000-4000-8000-000000000001",
    product_id: productId,
    ticket_no: 1,
    status: "WAITING",
    position: 1,
    message: "Вы №1 в очереди",
    next_action: "Ждать обновления или выйти",
    grant: null,
};

describe("queueApi backend contract", () => {
    afterEach(() => {
        configureBaseQuery(mockBaseQuery);
        localStorage.clear();
    });

    it("uses the registered join and leave routes and tracks the queue for realtime", async () => {
        const query = vi.fn(async () => ({ data: queueState }));
        configureBaseQuery(query as BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError>);
        const store = makeStore();
        store.dispatch(signedIn({ id: userId, name: "Анна", login: "anna" }));

        await store.dispatch(queueApi.endpoints.joinQueue.initiate(productId)).unwrap();

        expect(query).toHaveBeenNthCalledWith(
            1,
            { url: `/products/${productId}/queue/join`, method: "POST" },
            expect.anything(),
            undefined,
        );
        expect(
            (
                store.getState() as unknown as {
                    queueWatch?: { byUser: Record<string, string[]> };
                }
            ).queueWatch?.byUser[userId],
        ).toEqual([productId]);
        expect(
            (makeStore().getState() as { queueWatch: { byUser: Record<string, string[]> } })
                .queueWatch.byUser[userId],
        ).toEqual([productId]);

        await store.dispatch(queueApi.endpoints.leaveQueue.initiate(productId)).unwrap();

        expect(query).toHaveBeenNthCalledWith(
            2,
            { url: `/products/${productId}/queue/me`, method: "DELETE" },
            expect.anything(),
            undefined,
        );
        expect(
            (makeStore().getState() as { queueWatch: { byUser: Record<string, string[]> } })
                .queueWatch.byUser[userId],
        ).toEqual([]);
    });

    it("treats QUEUE_ENTRY_NOT_FOUND as an empty personal queue state", async () => {
        configureBaseQuery(async () => ({
            error: {
                status: 404,
                data: {
                    error: {
                        code: "QUEUE_ENTRY_NOT_FOUND",
                        message: "Заявка не найдена",
                        request_id: "request-1",
                    },
                },
            },
        }));
        const store = makeStore();

        const state = await store
            .dispatch(queueApi.endpoints.getMyQueueState.initiate(productId))
            .unwrap();

        expect(state).toBeNull();
    });

    it("submits mock payment results through the demo-only backend route", async () => {
        const query = vi.fn(async () => ({ data: {} }));
        configureBaseQuery(query as BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError>);
        const store = makeStore();
        const grantId = "50000000-0000-4000-8000-000000000001";
        const request = {
            idempotency_key: "60000000-0000-4000-8000-000000000001",
            result: "success" as const,
        };

        await store
            .dispatch(queueApi.endpoints.submitDemoPaymentResult.initiate({ grantId, request }))
            .unwrap();

        expect(query).toHaveBeenCalledWith(
            { url: `/demo/grants/${grantId}/payment-result`, method: "POST", body: request },
            expect.anything(),
            undefined,
        );
    });
});
