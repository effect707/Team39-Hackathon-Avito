import type { QueueEntryStatus } from "@/entities/queue";

export const getStockLabel = (
    available: number,
    reserved: number,
    sold: number,
    total: number,
    queueStatus: QueueEntryStatus | null,
    isLimited: boolean,
): string | null => {
    if (available === 0 && reserved === 0) return "";
    if (isLimited && queueStatus === "PURCHASED") return null;
    if (available > 0) return `Доступно: ${available}`;
    if (total > 0 && sold === total) return "Все экземпляры оформлены";
    if (reserved > 0) return "Все экземпляры оформляются";
    return "Товар закончился";
};
