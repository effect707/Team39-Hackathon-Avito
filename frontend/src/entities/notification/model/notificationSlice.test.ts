import { describe, expect, it } from "vitest";
import { notificationAdded, notificationRead, notificationReducer } from "./notificationSlice";

describe("notificationReducer", () => {
    it("не добавляет повторное уведомление одного состояния товара", () => {
        const notification = {
            id: "p1:WAITING:5",
            productId: "p1",
            productTitle: "Статуэтка",
            type: "progress" as const,
            title: "Очередь обновилась",
            createdAt: "2026-08-09T10:00:00Z",
            read: false,
        };
        const once = notificationReducer(undefined, notificationAdded(notification));
        const twice = notificationReducer(once, notificationAdded(notification));
        expect(twice.items).toHaveLength(1);
    });

    it("помечает прочитанным только выбранное уведомление", () => {
        const notification = {
            id: "p1:WAITING:5",
            productId: "p1",
            productTitle: "Статуэтка",
            type: "progress" as const,
            title: "Очередь обновилась",
            createdAt: "2026-08-09T10:00:00Z",
            read: false,
        };
        const state = notificationReducer(
            {
                items: [
                    { ...notification, id: "notification-1" },
                    { ...notification, id: "notification-2" },
                ],
            },
            notificationRead("notification-1"),
        );

        expect(state.items).toEqual([
            expect.objectContaining({ id: "notification-1", read: true }),
            expect.objectContaining({ id: "notification-2", read: false }),
        ]);
    });
});
