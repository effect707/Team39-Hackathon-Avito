import { describe, expect, it } from "vitest";
import { formatPrice } from "./price";

describe("formatPrice", () => {
    it("formats numeric and string prices in Russian locale", () => {
        expect(formatPrice(1234567)).toBe("1\u00a0234\u00a0567 ₽");
        expect(formatPrice("999")).toBe("999 ₽");
    });
});
