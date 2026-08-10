import type { SSESignal } from "@/entities/queue";
import { parseSseChunk } from "./parseSseChunk";

interface Subscription {
    productId: string;
    userId: string;
    onSignal: (signal: SSESignal) => void;
    onConnectionChange: (connected: boolean) => void;
}

export const subscribe = ({ productId, userId, onSignal, onConnectionChange }: Subscription) => {
    const controller = new AbortController();
    let stopped = false;
    let retry = 0;
    let retryTimer: number | undefined;
    let connecting = false;

    const connect = async () => {
        if (stopped || !navigator.onLine || connecting) return;

        connecting = true;
        try {
            const response = await fetch(
                `${import.meta.env.VITE_API_URL ?? "/api/v1"}/products/${productId}/queue/events`,
                {
                    headers: { Accept: "text/event-stream", "X-Demo-User-ID": userId },
                    signal: controller.signal,
                },
            );

            if (!response.ok || !response.body) throw new Error("SSE connection failed");
            onConnectionChange(true);
            retry = 0;

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = "";

            while (!stopped) {
                const { value, done } = await reader.read();
                if (done) throw new Error("SSE stream ended");
                const parsed = parseSseChunk(buffer + decoder.decode(value, { stream: true }));
                buffer = parsed.rest;
                parsed.signals.forEach(onSignal);
            }
        } catch {
            if (stopped) return;
            onConnectionChange(false);
            retry += 1;
            retryTimer = window.setTimeout(
                () => {
                    retryTimer = undefined;
                    void connect();
                },
                Math.min(1000 * 2 ** retry, 30_000),
            );
        } finally {
            connecting = false;
        }
    };
    const online = () => {
        if (retryTimer !== undefined) {
            window.clearTimeout(retryTimer);
            retryTimer = undefined;
        }
        retry = 0;
        void connect();
    };
    const offline = () => onConnectionChange(false);
    window.addEventListener("online", online);
    window.addEventListener("offline", offline);
    void connect();
    return () => {
        stopped = true;
        controller.abort();
        if (retryTimer !== undefined) window.clearTimeout(retryTimer);
        window.removeEventListener("online", online);
        window.removeEventListener("offline", offline);
    };
};
