import type { QueueEntryStatus } from "@/entities/queue";
import { assertNever } from "@/shared/lib/assertNever";

export const getQueueCta = (
    status: QueueEntryStatus | null,
    isLimited: boolean,
    isSoldOut: boolean,
    position?: number | null,
) => {
    if (status === "SOLD_OUT" || isSoldOut) return { label: "Товар закончился", disabled: true };
    if (!isLimited) return { label: "Купить", disabled: false };
    if (status === null) return { label: "Купить", disabled: false };

    switch (status) {
        case "WAITING":
            return { label: `Место в очереди: ${position ?? "—"}`, disabled: false };
        case "GRANTED":
            return { label: "Перейти к оформлению", disabled: false };
        case "CHECKOUT_PENDING":
            return { label: "Продолжить оформление", disabled: false };
        case "PURCHASED":
        case "JOINING":
        case "EXPIRED":
        case "PAYMENT_FAILED":
        case "CANCELLED":
        case "ERROR":
            return { label: "Купить", disabled: false };
        default:
            return assertNever(status, "getQueueCta");
    }
};
