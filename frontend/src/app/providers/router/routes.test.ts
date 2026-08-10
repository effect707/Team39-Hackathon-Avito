import { describe, expect, it } from "vitest";
import { getAuthClosePath, getAuthPath, getCheckoutPath } from "./routes";

describe("auth route", () => {
    it("keeps the current page and opens sign-in as a modal", () => {
        expect(getAuthPath("/items/product-1", "sign-in")).toBe("/items/product-1?auth=sign-in");
    });

    it("removes only the auth modal parameter when it closes", () => {
        expect(getAuthClosePath("/items/product-1?auth=sign-in&tab=details")).toBe(
            "/items/product-1?tab=details",
        );
    });
});

describe("checkout route", () => {
    it("keeps both product and grant identifiers so REST state can be restored", () => {
        expect(getCheckoutPath("product-1", "grant-1")).toBe("/checkout/product-1/grant-1");
    });
});
