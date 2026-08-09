import { describe, expect, it } from "vitest";
import { getAuthClosePath, getAuthPath } from "./routes";

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
