import type { QueueEntryStatus } from "@/entities/queue";

export const isCheckoutAvailable = (status: QueueEntryStatus) =>
    status === "GRANTED" || status === "CHECKOUT_PENDING";
