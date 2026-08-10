import type { FetchBaseQueryError } from "@reduxjs/toolkit/query";
import type {
    CheckoutStartedResponse,
    ErrorEnvelope,
    PaymentResultRequest,
    PaymentResultResponse,
    QueueState,
} from "../model/types";
import { queueUnwatched, queueWatched } from "../model/queueWatchSlice";
import { baseApi } from "@/shared/api/baseApi";

const currentUserId = (state: unknown) =>
    (state as { session?: { user?: { id?: string } | null } }).session?.user?.id;

const shouldWatch = (state: QueueState) =>
    ["JOINING", "WAITING", "GRANTED", "CHECKOUT_PENDING", "ERROR"].includes(state.status);

const isQueueEntryNotFound = (error: FetchBaseQueryError) =>
    error.status === 404 &&
    (error.data as Partial<ErrorEnvelope> | undefined)?.error?.code === "QUEUE_ENTRY_NOT_FOUND";

export const queueApi = baseApi.injectEndpoints({
    endpoints: (builder) => ({
        getMyQueueState: builder.query<QueueState | null, string>({
            queryFn: async (id, _api, _extraOptions, baseQuery) => {
                const result = await baseQuery(`/products/${id}/queue/me`);
                if (result.error) {
                    const error = result.error as FetchBaseQueryError;
                    return isQueueEntryNotFound(error) ? { data: null } : { error };
                }
                return { data: result.data as QueueState };
            },
            providesTags: (_result, _error, id) => [{ type: "Queue", id }],
            onQueryStarted: async (productId, { dispatch, getState, queryFulfilled }) => {
                const userId = currentUserId(getState());
                try {
                    const { data } = await queryFulfilled;
                    if (!userId) return;
                    dispatch(
                        (data && shouldWatch(data) ? queueWatched : queueUnwatched)({
                            userId,
                            productId,
                        }),
                    );
                } catch {
                    return;
                }
            },
        }),
        joinQueue: builder.mutation<QueueState, string>({
            query: (id) => ({ url: `/products/${id}/queue/join`, method: "POST" }),
            invalidatesTags: (_result, _error, id) => [
                { type: "Queue", id },
                { type: "Product", id },
            ],
            onQueryStarted: async (productId, { dispatch, getState, queryFulfilled }) => {
                const userId = currentUserId(getState());
                try {
                    const { data } = await queryFulfilled;
                    if (userId && shouldWatch(data)) dispatch(queueWatched({ userId, productId }));
                } catch {
                    return;
                }
            },
        }),
        leaveQueue: builder.mutation<QueueState, string>({
            query: (id) => ({ url: `/products/${id}/queue/me`, method: "DELETE" }),
            invalidatesTags: (_result, _error, id) => [{ type: "Queue", id }],
            onQueryStarted: async (productId, { dispatch, getState, queryFulfilled }) => {
                const userId = currentUserId(getState());
                try {
                    await queryFulfilled;
                    if (userId) dispatch(queueUnwatched({ userId, productId }));
                } catch {
                    return;
                }
            },
        }),
        startCheckout: builder.mutation<CheckoutStartedResponse, string>({
            query: (id) => ({ url: `/grants/${id}/checkout`, method: "POST" }),
            invalidatesTags: ["Queue"],
        }),
        submitDemoPaymentResult: builder.mutation<
            PaymentResultResponse,
            { grantId: string; request: PaymentResultRequest }
        >({
            query: ({ grantId, request }) => ({
                url: `/demo/grants/${grantId}/payment-result`,
                method: "POST",
                body: request,
            }),
            invalidatesTags: ["Queue", "Product"],
        }),
    }),
});

export const {
    useGetMyQueueStateQuery,
    useJoinQueueMutation,
    useLeaveQueueMutation,
    useStartCheckoutMutation,
    useSubmitDemoPaymentResultMutation,
} = queueApi;
