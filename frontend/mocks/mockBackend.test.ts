import { beforeEach, describe, expect, it } from "vitest";
import { mockBackend } from "./mockBackend";

describe("mockBackend queue", () => {
    beforeEach(() => localStorage.clear());

    it("восстанавливает товары из старого mock-хранилища без inventory", async () => {
        localStorage.setItem(
            "avito-hackathon-queue:mock:v2",
            JSON.stringify({ version: 2, users: [], queues: {}, paymentResults: {} }),
        );

        const products = await mockBackend.listProducts();

        expect(products).toHaveLength(3);
        expect(products[0].inventory.available).toBe(0);
    });

    it("повторный вход не создаёт второе активное место", async () => {
        const first = await mockBackend.joinQueue("user-1", "stan-lee");
        const second = await mockBackend.joinQueue("user-1", "stan-lee");
        expect(second.queue_entry_id).toBe(first.queue_entry_id);
        expect(second.ticket_no).toBe(first.ticket_no);
    });

    it("не выдаёт одну доступную единицу двум аккаунтам", async () => {
        const first = await mockBackend.joinQueue("user-1", "grimilde");
        const second = await mockBackend.joinQueue("user-2", "grimilde");

        expect(first.status).toBe("GRANTED");
        expect(second.status).toBe("WAITING");
        expect(second.grant).toBeNull();
    });

    it("после истечения права продвигает самого раннего ожидающего участника", async () => {
        const first = await mockBackend.joinQueue("user-1", "grimilde");
        await mockBackend.joinQueue("user-2", "grimilde");
        await mockBackend.joinQueue("user-3", "grimilde");
        const database = JSON.parse(
            localStorage.getItem("avito-hackathon-queue:mock:v2") ?? "{}",
        ) as {
            queues: Record<string, { grant?: { expires_at: string } }>;
        };
        database.queues["user-1:grimilde"].grant!.expires_at = new Date(
            Date.now() - 1_000,
        ).toISOString();
        localStorage.setItem("avito-hackathon-queue:mock:v2", JSON.stringify(database));

        await mockBackend.getQueueState("user-1", "grimilde");

        const promoted = await mockBackend.getQueueState("user-2", "grimilde");
        expect(promoted?.status).toBe("GRANTED");
        expect(promoted?.grant).not.toBeNull();
        expect(promoted?.ticket_no).toBeGreaterThan(first.ticket_no);
        expect((await mockBackend.getQueueState("user-3", "grimilde"))?.position).toBe(1);
    });

    it("продвигает очередь, если право истекло во время checkout", async () => {
        const first = await mockBackend.joinQueue("user-1", "grimilde");
        await mockBackend.joinQueue("user-2", "grimilde");
        const database = JSON.parse(
            localStorage.getItem("avito-hackathon-queue:mock:v2") ?? "{}",
        ) as {
            queues: Record<string, { grant?: { expires_at: string } }>;
        };
        database.queues["user-1:grimilde"].grant!.expires_at = new Date(
            Date.now() - 1_000,
        ).toISOString();
        localStorage.setItem("avito-hackathon-queue:mock:v2", JSON.stringify(database));

        await expect(mockBackend.startCheckout("user-1", first.grant!.id)).rejects.toThrow(
            "Право на оформление больше недоступно",
        );

        expect((await mockBackend.getQueueState("user-2", "grimilde"))?.status).toBe("GRANTED");
    });

    it("назначает разным аккаунтам разные места ожидания", async () => {
        const first = await mockBackend.joinQueue("user-1", "stan-lee");
        const second = await mockBackend.joinQueue("user-2", "stan-lee");

        expect(first.status).toBe("WAITING");
        expect(second.status).toBe("WAITING");
        expect(first.position).toBe(1);
        expect(second.position).toBe(2);
    });

    it("после отказа повторный вход создаёт новый билет", async () => {
        const first = await mockBackend.joinQueue("user-1", "stan-lee");
        await mockBackend.leaveQueue("user-1", "stan-lee");
        const second = await mockBackend.joinQueue("user-1", "stan-lee");
        expect(second.queue_entry_id).not.toBe(first.queue_entry_id);
    });

    it("после успешной покупки уменьшает доступный остаток товара", async () => {
        const queue = await mockBackend.joinQueue("user-1", "grimilde");
        expect(queue.grant).not.toBeNull();

        await mockBackend.submitPayment("user-1", queue.grant!.id, {
            idempotency_key: "payment-1",
            result: "success",
        });

        const product = await mockBackend.getProduct("grimilde");
        expect(product.inventory.available).toBe(0);
        expect(product.inventory.sold).toBe(1);
    });

    it("после покупки позволяет снова получить право, если товар ещё в наличии", async () => {
        const first = await mockBackend.joinQueue("user-1", "stitch");
        await mockBackend.submitPayment("user-1", first.grant!.id, {
            idempotency_key: "payment-1",
            result: "success",
        });

        const second = await mockBackend.joinQueue("user-1", "stitch");

        expect(second.queue_entry_id).not.toBe(first.queue_entry_id);
        expect(second.status).toBe("GRANTED");
        expect(second.grant).not.toBeNull();
    });

    it("истекает просроченное право и не позволяет начать checkout", async () => {
        const queue = await mockBackend.joinQueue("user-1", "stitch");
        const database = JSON.parse(
            localStorage.getItem("avito-hackathon-queue:mock:v2") ?? "{}",
        ) as {
            queues: Record<string, { grant: { expires_at: string } }>;
        };
        database.queues["user-1:stitch"].grant.expires_at = new Date(
            Date.now() - 1_000,
        ).toISOString();
        localStorage.setItem("avito-hackathon-queue:mock:v2", JSON.stringify(database));

        const expired = await mockBackend.getQueueState("user-1", "stitch");

        expect(expired?.status).toBe("EXPIRED");
        expect(expired?.grant?.status).toBe("EXPIRED");
        expect(expired?.message).toBe("Время на покупку истекло");
        await expect(mockBackend.startCheckout("user-1", queue.grant!.id)).rejects.toThrow(
            "Право на оформление больше недоступно",
        );
        expect((await mockBackend.getQueueState("user-1", "stitch"))?.status).toBe("EXPIRED");
    });
});
