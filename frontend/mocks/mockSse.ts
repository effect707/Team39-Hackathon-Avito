import type { SSESignal } from "@/entities/queue";

interface MockSubscription {
    productId: string;
    userId: string;
    onSignal: (signal: SSESignal) => void;
    onConnectionChange: (connected: boolean) => void;
}

export const subscribeMock = ({ productId, onSignal, onConnectionChange }: MockSubscription) => {
    const channel =
        typeof BroadcastChannel === "undefined" ? null : new BroadcastChannel("avito-fair-queue");

    onConnectionChange(true);
    if (channel) {
        channel.onmessage = () =>
            onSignal({
                type: "queue.changed",
                product_id: productId,
                queue_entry_id: "mock",
                occurred_at: new Date().toISOString(),
            });
    }

    return () => channel?.close();
};
