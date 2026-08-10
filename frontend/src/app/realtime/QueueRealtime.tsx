import { useEffect } from "react";
import { useAppDispatch, useAppSelector } from "@/app/providers";
import { productApi } from "@/entities/product";
import { queueApi } from "@/entities/queue";
import { notificationAdded } from "@/entities/notification";
import type { QueueState } from "@/entities/queue";
import { subscribe } from "@/features/queue-realtime";
import { isMockApi } from "@mocks/config";
import { subscribeMock } from "@mocks/mockSse";

const noProducts: string[] = [];

const notificationFor = (state: QueueState, title: string) => {
    const suffix = state.status === "WAITING" ? state.position : state.status;
    const type =
        state.status === "GRANTED"
            ? "granted"
            : state.status === "EXPIRED"
              ? "expired"
              : "progress";
    return {
        id: `${state.product_id}:${state.status}:${suffix}`,
        productId: state.product_id,
        productTitle: title,
        type,
        title:
            state.status === "GRANTED"
                ? "Можно приступать к оформлению"
                : state.status === "EXPIRED"
                  ? "Время на покупку истекло"
                  : "Очередь обновилась",
        createdAt: new Date().toISOString(),
        read: false,
    } as const;
};

export const QueueRealtime = () => {
    const user = useAppSelector((state) => state.session.user);
    const products = useAppSelector((state) =>
        user ? (state.queueWatch.byUser[user.id] ?? noProducts) : noProducts,
    );
    const dispatch = useAppDispatch();
    const subscribeToQueue = isMockApi ? subscribeMock : subscribe;

    useEffect(() => {
        if (!user) return;
        const userId = user.id;
        const refreshQueue = async (productId: string) => {
            try {
                const [state, product] = await Promise.all([
                    dispatch(
                        queueApi.endpoints.getMyQueueState.initiate(productId, { forceRefetch: true }),
                    ).unwrap(),
                    dispatch(
                        productApi.endpoints.getProduct.initiate(productId, { forceRefetch: true }),
                    ).unwrap(),
                ]);
                if (!state || userId !== user.id) return;
                const item = notificationFor(state, product.title);
                dispatch(notificationAdded({ userId, notification: item }));
            } catch {
                return;
            }
        };
        const cleanups = products.map((productId) =>
            subscribeToQueue({
                productId,
                userId: user.id,
                onConnectionChange: (connected) => {
                    if (connected)
                        dispatch(queueApi.util.invalidateTags([{ type: "Queue", id: productId }]));
                },
                onSignal: async () => {
                    dispatch(
                        queueApi.util.invalidateTags([
                            { type: "Queue", id: productId },
                            { type: "Product", id: productId },
                        ]),
                    );
                    await refreshQueue(productId);
                },
            }),
        );
        void Promise.all(products.map(refreshQueue));
        return () => cleanups.forEach((cleanup) => cleanup());
    }, [dispatch, products, subscribeToQueue, user]);

    return null;
};
