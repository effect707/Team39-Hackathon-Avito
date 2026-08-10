import { describe, expect, it } from "vitest";
import { getQueueCta } from "./getQueueCta";

describe("getQueueCta", () => {
    it.each([
        [null, true, false, "Купить", false],
        ["WAITING", true, false, "Место в очереди: 6", false],
        ["GRANTED", true, false, "Перейти к оформлению", false],
        ["CHECKOUT_PENDING", true, false, "Продолжить оформление", false],
        ["SOLD_OUT", true, true, "Товар закончился", true],
        ["PURCHASED", true, false, "Купить", false],
        ["PURCHASED", true, true, "Товар закончился", true],
        ["EXPIRED", true, false, "Купить", false],
        ["PAYMENT_FAILED", true, false, "Купить", false],
        ["CANCELLED", true, false, "Купить", false],
        ["JOINING", true, false, "Купить", false],
        ["ERROR", true, false, "Купить", false],
        [null, false, false, "Купить", false],
        [null, false, true, "Товар закончился", true],
    ] as const)(
        "возвращает действие для статуса %s",
        (status, limited, soldOut, label, disabled) => {
            expect(getQueueCta(status, limited, soldOut, 6)).toEqual({ label, disabled });
        },
    );
});
