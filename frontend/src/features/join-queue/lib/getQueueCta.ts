import type { QueueEntryStatus } from "@/entities/queue";
import { assertNever } from "@/shared/lib/assertNever";

export const getQueueCta = (
    status: QueueEntryStatus | null,
    isLimited: boolean,
    available: number,
    position?: number | null,
) => {
    if (!isLimited) return { label: "Купить", disabled: false };
    if (status === null) return { label: "Купить", disabled: false };

    switch (status) {
        case "WAITING":
            return { label: `Место в очереди: ${position ?? "—"}`, disabled: false };
        case "GRANTED":
            return { label: "Перейти к оформлению", disabled: false };
        case "CHECKOUT_PENDING":
            return { label: "Продолжить оформление", disabled: false };
        case "SOLD_OUT":
            return { label: "Товар закончился", disabled: true };
        case "PURCHASED":
        case "JOINING":
        case "EXPIRED":
        case "PAYMENT_FAILED":
        case "CANCELLED":
        case "ERROR":
            return available > 0
                ? { label: "Купить", disabled: false }
                : { label: "Товар закончился", disabled: true };
        default:
            return assertNever(status, "getQueueCta");
    }
};
