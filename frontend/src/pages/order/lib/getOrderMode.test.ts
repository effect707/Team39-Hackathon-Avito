import { describe, expect, it } from "vitest";
import { getOrderMode } from "./getOrderMode";

describe("getOrderMode", () => {
    it("показывает таймер только для лимитированного товара", () => {
        expect(getOrderMode(true)).toEqual({ title: "Оформление заказа", showTimer: true });
        expect(getOrderMode(false)).toEqual({ title: "Оформление заказа", showTimer: false });
    });
});
