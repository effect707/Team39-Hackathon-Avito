import { describe, expect, it } from "vitest";
import { getQueueCta } from "./getQueueCta";

describe("getQueueCta", () => {
    it.each([
        [null, true, 3, "Купить", false],
        ["WAITING", true, 3, "Место в очереди: 6", false],
        ["GRANTED", true, 3, "Перейти к оформлению", false],
        ["CHECKOUT_PENDING", true, 3, "Продолжить оформление", false],
        ["SOLD_OUT", true, 0, "Товар закончился", true],
        ["PURCHASED", true, 3, "Купить", false],
        ["PURCHASED", true, 0, "Товар закончился", true],
        ["EXPIRED", true, 3, "Купить", false],
        ["PAYMENT_FAILED", true, 3, "Купить", false],
        ["CANCELLED", true, 3, "Купить", false],
        ["JOINING", true, 3, "Купить", false],
        ["ERROR", true, 3, "Купить", false],
        ["EXPIRED", true, 0, "Товар закончился", true],
        [null, false, 0, "Купить", false],
    ] as const)(
        "возвращает действие для статуса %s",
        (status, limited, available, label, disabled) => {
            expect(getQueueCta(status, limited, available, 6)).toEqual({ label, disabled });
        },
    );
});
