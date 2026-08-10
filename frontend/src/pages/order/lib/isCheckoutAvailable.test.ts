import { describe, expect, it } from "vitest";
import { isCheckoutAvailable } from "./isCheckoutAvailable";

describe("isCheckoutAvailable", () => {
    it("allows checkout only while the grant is active or pending", () => {
        expect(isCheckoutAvailable("GRANTED")).toBe(true);
        expect(isCheckoutAvailable("CHECKOUT_PENDING")).toBe(true);
        expect(isCheckoutAvailable("CANCELLED")).toBe(false);
        expect(isCheckoutAvailable("EXPIRED")).toBe(false);
        expect(isCheckoutAvailable("PAYMENT_FAILED")).toBe(false);
        expect(isCheckoutAvailable("PURCHASED")).toBe(false);
        expect(isCheckoutAvailable("SOLD_OUT")).toBe(false);
    });
});
