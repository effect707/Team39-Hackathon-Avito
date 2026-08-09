import "@testing-library/jest-dom/vitest";
import { webcrypto } from "node:crypto";
import { configureMockApi } from "@mocks/configureMockApi";

configureMockApi();

class ResizeObserverMock {
    observe() {
        return undefined;
    }
    unobserve() {
        return undefined;
    }
    disconnect() {
        return undefined;
    }
}

Object.defineProperty(window, "ResizeObserver", {
    writable: true,
    value: ResizeObserverMock,
});

Object.defineProperty(globalThis, "crypto", { value: webcrypto, configurable: true });

class BroadcastChannelMock {
    onmessage: ((event: MessageEvent) => void) | null = null;
    postMessage() {
        return undefined;
    }
    close() {
        return undefined;
    }
}

Object.defineProperty(globalThis, "BroadcastChannel", {
    value: BroadcastChannelMock,
    configurable: true,
});
