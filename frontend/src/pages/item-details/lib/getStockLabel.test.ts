import { describe, expect, it } from "vitest";
import { getStockLabel } from "./getStockLabel";

describe("getStockLabel", () => {
    it("не показывает остаточную плашку после покупки товара", () => {
        expect(getStockLabel(0, 0, 1, 1, "PURCHASED", true)).toBeNull();
    });

    it("показывает остаток для товара, доступного к покупке", () => {
        expect(getStockLabel(1, 0, 0, 1, null, true)).toBe("Доступно: 1");
    });

    it("показывает остаток обычного товара после покупки", () => {
        expect(getStockLabel(7, 0, 1, 8, "PURCHASED", false)).toBe("Доступно: 7");
    });

    it("показывает оформленные экземпляры после полной покупки", () => {
        expect(getStockLabel(0, 0, 1, 1, null, true)).toBe("Все экземпляры оформлены");
    });

    it("показывает оформляемые экземпляры при активном резерве", () => {
        expect(getStockLabel(0, 1, 0, 1, null, true)).toBe("Все экземпляры оформляются");
    });
});
