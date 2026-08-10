import { beforeEach, describe, expect, it } from "vitest";
import {
    notificationAdded,
    notificationRead,
    notificationsCleared,
    notificationsHydrated,
    notificationReducer,
} from "./notificationSlice";

describe("notificationReducer", () => {
    beforeEach(() => localStorage.clear());
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
        const hydrated = notificationReducer(undefined, notificationsHydrated("user-1"));
        const once = notificationReducer(hydrated, notificationAdded({ userId: "user-1", notification }));
        const twice = notificationReducer(once, notificationAdded({ userId: "user-1", notification }));
        expect(twice.items).toHaveLength(1);
    });

    it("хранит уведомления отдельно для каждого пользователя и очищает их", () => {
        const notification = {
            id: "p1:GRANTED:GRANTED",
            productId: "p1",
            productTitle: "Статуэтка",
            type: "granted" as const,
            title: "Можно оформлять",
            createdAt: "2026-08-09T10:00:00Z",
            read: false,
        };
        const userOne = notificationReducer(
            notificationReducer(undefined, notificationsHydrated("user-1")),
            notificationAdded({ userId: "user-1", notification }),
        );
        const userTwo = notificationReducer(userOne, notificationsHydrated("user-2"));
        expect(userTwo.items).toHaveLength(0);
        const restored = notificationReducer(userTwo, notificationsHydrated("user-1"));
        expect(restored.items).toHaveLength(1);
        expect(notificationReducer(restored, notificationsCleared()).items).toHaveLength(0);
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
                activeUserId: "user-1",
                items: [
                    { ...notification, id: "notification-1" },
                    { ...notification, id: "notification-2" },
                ],
                dismissedIds: [],
            },
            notificationRead("notification-1"),
        );

        expect(state.items).toEqual([
            expect.objectContaining({ id: "notification-1", read: true }),
            expect.objectContaining({ id: "notification-2", read: false }),
        ]);
    });
});
