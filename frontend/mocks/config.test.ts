import { describe, expect, it } from "vitest";
import { isMockApi } from "./config";

describe("API mode", () => {
    it("uses the real backend by default", () => {
        expect(isMockApi).toBe(false);
    });
});
