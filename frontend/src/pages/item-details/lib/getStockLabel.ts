import type { QueueEntryStatus } from "@/entities/queue";

export const getStockLabel = (
    available: number,
    queueStatus: QueueEntryStatus | null,
    isLimited: boolean,
): string | null => {
    if (isLimited && queueStatus === "PURCHASED") return null;
    return available > 0 ? `Доступно: ${available}` : "Все экземпляры оформляют";
};
