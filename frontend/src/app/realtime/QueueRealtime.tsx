import { useEffect } from "react";
import { App } from "antd";
import { useAppDispatch, useAppSelector } from "@/app/providers";
import { productApi } from "@/entities/product";
import { queueApi } from "@/entities/queue";
import { notificationAdded } from "@/entities/notification";
import type { QueueState } from "@/entities/queue";
import { subscribe } from "@/features/queue-realtime";
import { isMockApi } from "@mocks/config";
import { subscribeMock } from "@mocks/mockSse";
import { mockBackend } from "@mocks/mockBackend";

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
    const dispatch = useAppDispatch();
    const { message } = App.useApp();
    const subscribeToQueue = isMockApi ? subscribeMock : subscribe;

    useEffect(() => {
        if (!user) return;
        const products = mockBackend.knownQueues();
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
                    const state = await dispatch(
                        queueApi.endpoints.getMyQueueState.initiate(productId, {
                            forceRefetch: true,
                        }),
                    ).unwrap();
                    const product = await dispatch(
                        productApi.endpoints.getProduct.initiate(productId, { forceRefetch: true }),
                    ).unwrap();
                    if (state) {
                        const item = notificationFor(state, product.title);
                        dispatch(notificationAdded(item));
                        message.info(`${item.title}: ${product.title}`);
                    }
                },
            }),
        );
        return () => cleanups.forEach((cleanup) => cleanup());
    }, [dispatch, message, subscribeToQueue, user]);

    return null;
};
