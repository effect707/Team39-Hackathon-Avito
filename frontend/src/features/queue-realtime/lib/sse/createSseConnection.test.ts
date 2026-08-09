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
});
