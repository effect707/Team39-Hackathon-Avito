import { describe, expect, it } from "vitest";
import { getStockLabel } from "./getStockLabel";

describe("getStockLabel", () => {
    it("не показывает остаточную плашку после покупки товара", () => {
        expect(getStockLabel(0, "PURCHASED", true)).toBeNull();
    });

    it("показывает остаток для товара, доступного к покупке", () => {
        expect(getStockLabel(1, null, true)).toBe("Доступно: 1");
    });

    it("показывает остаток обычного товара после покупки", () => {
        expect(getStockLabel(7, "PURCHASED", false)).toBe("Доступно: 7");
    });
});
