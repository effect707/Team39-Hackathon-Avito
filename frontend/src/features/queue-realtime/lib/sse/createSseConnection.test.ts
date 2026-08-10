import { afterEach, describe, expect, it, vi } from "vitest";
import { subscribe } from "./createSseConnection";

describe("subscribe", () => {
    afterEach(() => {
        vi.unstubAllGlobals();
        vi.useRealTimers();
    });

    it("clears a scheduled reconnect when unsubscribed", async () => {
        vi.useFakeTimers();
        vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

        const cleanup = subscribe({
            productId: "product-1",
            userId: "user-1",
            onSignal: vi.fn(),
            onConnectionChange: vi.fn(),
        });

        await Promise.resolve();
        await Promise.resolve();
        expect(vi.getTimerCount()).toBe(1);

        cleanup();

        expect(vi.getTimerCount()).toBe(0);
    });

    it("connects to the backend queue events route with demo identity", async () => {
        vi.useFakeTimers();
        const fetchMock = vi.fn().mockRejectedValue(new Error("offline"));
        vi.stubGlobal("fetch", fetchMock);

        const cleanup = subscribe({
            productId: "product-1",
            userId: "user-1",
            onSignal: vi.fn(),
            onConnectionChange: vi.fn(),
        });
        await Promise.resolve();
        await Promise.resolve();

        expect(fetchMock).toHaveBeenCalledWith(
            "/api/v1/products/product-1/queue/events",
            expect.objectContaining({
                headers: { Accept: "text/event-stream", "X-Demo-User-ID": "user-1" },
            }),
        );

        cleanup();
    });
});
