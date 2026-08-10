import { describe, expect, it } from "vitest";
import { isMockApi, shouldUseMockFallback } from "./config";

describe("API fallback", () => {
    it("uses the real backend by default", () => {
        expect(isMockApi).toBe(false);
    });

    it("использует mock API, если backend сообщает, что endpoint ещё не реализован", () => {
        expect(shouldUseMockFallback({ status: 501 })).toBe(true);
        expect(shouldUseMockFallback({ status: 404 })).toBe(false);
    });

    it("не подменяет настоящую ошибку backend mock-данными", () => {
        expect(shouldUseMockFallback({ status: 503 })).toBe(false);
    });
});
