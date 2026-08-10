import { describe, expect, it } from "vitest";
import { getQueueCta } from "./getQueueCta";

describe("getQueueCta", () => {
    it.each([
        [null, true, false, "Купить", false, false],
        ["WAITING", true, false, "Место в очереди: 6", false, false],
        ["GRANTED", true, false, "Перейти к оформлению", false, false],
        ["CHECKOUT_PENDING", true, false, "Продолжить оформление", false, false],
        ["SOLD_OUT", true, true, "Товар закончился", true, false],
        ["PURCHASED", true, false, "Купить", false, false],
        ["PURCHASED", true, true, "Товар закончился", true, false],
        ["EXPIRED", true, false, "Купить", false, false],
        ["PAYMENT_FAILED", true, false, "Купить", false, false],
        ["CANCELLED", true, false, "Купить", false, false],
        ["JOINING", true, false, "Купить", false, false],
        ["ERROR", true, false, "Купить", false, false],
        [null, false, false, "Купить", false, false],
        [null, false, true, "Товар закончился", true, false],
        ["GRANTED", true, false, "Купить", false, true],
        ["CHECKOUT_PENDING", true, false, "Купить", false, true],
    ] as const)(
        "возвращает действие для статуса %s",
        (status, limited, soldOut, label, disabled, grantExpired) => {
            expect(getQueueCta(status, limited, soldOut, 6, grantExpired)).toEqual({
                label,
                disabled,
            });
        },
    );
});
