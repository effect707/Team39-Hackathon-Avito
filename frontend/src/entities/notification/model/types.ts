export type NotificationType = "progress" | "granted" | "warning" | "expired";

export interface AppNotification {
    id: string;
    productId: string;
    productTitle: string;
    type: NotificationType;
    title: string;
    createdAt: string;
    read: boolean;
}

export interface UserNotification {
    userId: string;
    notification: AppNotification;
}
