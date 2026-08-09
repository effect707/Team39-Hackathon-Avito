import type { PaymentResultRequest, PaymentResultResponse, QueueState } from "../model/types";
import { baseApi } from "@/shared/api/baseApi";

export const queueApi = baseApi.injectEndpoints({
    endpoints: (builder) => ({
        getMyQueueState: builder.query<QueueState | null, string>({
            query: (id) => `/products/${id}/queue/me`,
            providesTags: (_result, _error, id) => [{ type: "Queue", id }],
        }),
        getQueueByGrant: builder.query<QueueState | null, string>({
            query: (id) => `/grants/${id}`,
            providesTags: (result) => (result ? [{ type: "Queue", id: result.product_id }] : []),
        }),
        joinQueue: builder.mutation<QueueState, string>({
            query: (id) => ({ url: `/products/${id}/queue`, method: "POST" }),
            invalidatesTags: (_result, _error, id) => [
                { type: "Queue", id },
                { type: "Product", id },
            ],
        }),
        leaveQueue: builder.mutation<QueueState, string>({
            query: (id) => ({ url: `/products/${id}/queue`, method: "DELETE" }),
            invalidatesTags: (_result, _error, id) => [{ type: "Queue", id }],
        }),
        startCheckout: builder.mutation<QueueState, string>({
            query: (id) => ({ url: `/grants/${id}/checkout`, method: "POST" }),
            invalidatesTags: ["Queue"],
        }),
        submitDemoPaymentResult: builder.mutation<
            PaymentResultResponse,
            { grantId: string; request: PaymentResultRequest }
        >({
            query: ({ grantId, request }) => ({
                url: `/grants/${grantId}/payment-result`,
                method: "POST",
                body: request,
            }),
            invalidatesTags: ["Queue", "Product"],
        }),
    }),
});

export const {
    useGetMyQueueStateQuery,
    useGetQueueByGrantQuery,
    useJoinQueueMutation,
    useLeaveQueueMutation,
    useStartCheckoutMutation,
    useSubmitDemoPaymentResultMutation,
} = queueApi;
