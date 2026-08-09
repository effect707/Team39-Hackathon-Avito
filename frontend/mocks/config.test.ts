import { describe, expect, it } from "vitest";
import { shouldUseMockFallback } from "./config";

describe("API fallback", () => {
    it("использует mock API, если backend сообщает, что endpoint ещё не реализован", () => {
        expect(shouldUseMockFallback({ status: 501 })).toBe(true);
        expect(shouldUseMockFallback({ status: 404 })).toBe(false);
    });

    it("не подменяет настоящую ошибку backend mock-данными", () => {
        expect(shouldUseMockFallback({ status: 503 })).toBe(false);
    });
});
