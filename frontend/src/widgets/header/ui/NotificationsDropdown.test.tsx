import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router";
import { describe, expect, it } from "vitest";
import type { AppNotification } from "@/entities/notification";
import { NotificationsDropdown } from "./NotificationsDropdown";

const Location = () => <output data-testid="location">{useLocation().pathname}</output>;

describe("NotificationsDropdown", () => {
    it("marks the selected notification as read and navigates to its product", async () => {
        const user = userEvent.setup();
        let readNotificationId = "";
        const items: AppNotification[] = [
            {
                id: "notification-1",
                productId: "product-42",
                productTitle: "Статуэтка",
                type: "granted",
                title: "Ваша очередь подошла",
                createdAt: "2026-08-09T10:00:00Z",
                read: false,
            },
        ];

        render(
            <MemoryRouter initialEntries={["/"]}>
                <NotificationsDropdown
                    items={items}
                    onNotificationRead={(notificationId) => {
                        readNotificationId = notificationId;
                    }}
                    onAllNotificationsRead={() => undefined}
                    onNotificationsClear={() => undefined}
                />
                <Location />
            </MemoryRouter>,
        );

        await user.click(screen.getByRole("button", { name: "Уведомления" }));
        await user.click(await screen.findByRole("button", { name: /Статуэтка/i }));

        expect(screen.getByTestId("location")).toHaveTextContent("/items/product-42");
        expect(readNotificationId).toBe("notification-1");
    });
});
