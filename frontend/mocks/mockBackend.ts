import type { Product } from "@/entities/product";
import type { PaymentResultRequest, PaymentResultResponse, QueueState } from "@/entities/queue";
import type { StoredUser } from "@/entities/session";
import { mockProducts } from "./mockData";

const DB_KEY = "avito-hackathon-queue:mock:v2";
const KNOWN_QUEUES_KEY = "avito-hackathon-queue:known:v1";

interface MockDatabase {
    version: 2;
    users: StoredUser[];
    queues: Record<string, QueueState>;
    paymentResults: Record<string, PaymentResultResponse>;
    inventory: Record<string, Product["inventory"]>;
}

const emptyDatabase = (): MockDatabase => ({
    version: 2,
    users: [],
    queues: {},
    paymentResults: {},
    inventory: {},
});

const readDatabase = (): MockDatabase => {
    try {
        const data = JSON.parse(localStorage.getItem(DB_KEY) ?? "null") as MockDatabase | null;
        return data?.version === 2
            ? { ...emptyDatabase(), ...data, inventory: data.inventory ?? {} }
            : emptyDatabase();
    } catch {
        return emptyDatabase();
    }
};

const writeDatabase = (database: MockDatabase) => {
    localStorage.setItem(DB_KEY, JSON.stringify(database));
    if (typeof BroadcastChannel !== "undefined") {
        const channel = new BroadcastChannel("avito-fair-queue");
        channel.postMessage({ type: "queue.changed" });
        channel.close();
    }
};

const queueKey = (userId: string, productId: string) => `${userId}:${productId}`;

const countActiveGrants = (database: MockDatabase, productId: string) =>
    Object.values(database.queues).filter(
        (state) =>
            state.product_id === productId &&
            ["GRANTED", "CHECKOUT_PENDING"].includes(state.status) &&
            state.grant &&
            Date.parse(state.grant.expires_at) > Date.now(),
    ).length;

const getNextTicketNo = (database: MockDatabase, productId: string) =>
    Math.max(
        0,
        ...Object.values(database.queues)
            .filter((state) => state.product_id === productId)
            .map((state) => state.ticket_no),
    ) + 1;

const hasWaitingEntries = (database: MockDatabase, productId: string) =>
    Object.values(database.queues).some(
        (state) => state.product_id === productId && state.status === "WAITING",
    );

const getNextWaitingPosition = (database: MockDatabase, productId: string) =>
    Object.values(database.queues).filter(
        (state) => state.product_id === productId && state.status === "WAITING",
    ).length + 1;

const promoteWaitingEntries = (database: MockDatabase, productId: string) => {
    const product = mockProducts.find((item) => item.id === productId);
    if (!product) return;

    const inventory = database.inventory[productId] ?? product.inventory;
    while (inventory.available > countActiveGrants(database, productId)) {
        const waitingEntry = Object.entries(database.queues)
            .filter(([, state]) => state.product_id === productId && state.status === "WAITING")
            .sort(([, left], [, right]) => left.ticket_no - right.ticket_no)[0];
        if (!waitingEntry) return;

        const [key, state] = waitingEntry;
        database.queues[key] = {
            ...state,
            status: "GRANTED",
            position: null,
            message: "Товар закреплён за вами",
            next_action: "Перейдите к оформлению до окончания времени",
            grant: {
                id: crypto.randomUUID(),
                product_id: productId,
                inventory_unit_id: crypto.randomUUID(),
                status: "ACTIVE",
                expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
            },
        };
    }
    const waitingEntries = Object.entries(database.queues)
        .filter(([, state]) => state.product_id === productId && state.status === "WAITING")
        .sort(([, left], [, right]) => left.ticket_no - right.ticket_no);
    waitingEntries.forEach(([key, state], index) => {
        database.queues[key] = { ...state, position: index + 1 };
    });
};

const expireGrantIfNeeded = (
    database: MockDatabase,
    key: string,
    state: QueueState,
): QueueState => {
    if (
        !state.grant ||
        !["GRANTED", "CHECKOUT_PENDING"].includes(state.status) ||
        Date.parse(state.grant.expires_at) > Date.now()
    ) {
        return state;
    }
    const expired: QueueState = {
        ...state,
        status: "EXPIRED",
        position: null,
        message: "Время на покупку истекло",
        next_action: "Можно снова купить товар, если он ещё доступен",
        grant: { ...state.grant, status: "EXPIRED" },
    };
    database.queues[key] = expired;
    return expired;
};

export const mockBackend = {
    listProducts: async (): Promise<Product[]> => {
        const database = readDatabase();
        return mockProducts.map((product) => ({
            ...product,
            inventory: { ...(database.inventory[product.id] ?? product.inventory) },
        }));
    },

    getProduct: async (productId: string): Promise<Product> => {
        const product = mockProducts.find((item) => item.id === productId);
        if (!product) throw new Error("Объявление не найдено");
        const inventory = readDatabase().inventory[productId] ?? product.inventory;
        return { ...product, inventory: { ...inventory } };
    },

    getAlternatives: async (productId: string): Promise<Product[]> => {
        const products = await mockBackend.listProducts();
        return products.filter((item) => item.id !== productId);
    },

    getUsers: () => readDatabase().users,

    saveUser: (user: StoredUser) => {
        const database = readDatabase();
        database.users.push(user);
        writeDatabase(database);
    },

    joinQueue: async (userId: string, productId: string): Promise<QueueState> => {
        const database = readDatabase();
        const key = queueKey(userId, productId);
        const existing = database.queues[key];
        if (
            existing &&
            !["CANCELLED", "EXPIRED", "PAYMENT_FAILED", "PURCHASED", "SOLD_OUT"].includes(
                existing.status,
            )
        ) {
            return existing;
        }

        const product = await mockBackend.getProduct(productId);
        const granted =
            product.inventory.available > countActiveGrants(database, productId) &&
            !hasWaitingEntries(database, productId);
        const state: QueueState = granted
            ? {
                  queue_entry_id: crypto.randomUUID(),
                  product_id: productId,
                  ticket_no: getNextTicketNo(database, productId),
                  status: "GRANTED",
                  message: "Товар закреплён за вами",
                  next_action: "Перейдите к оформлению до окончания времени",
                  grant: {
                      id: crypto.randomUUID(),
                      product_id: productId,
                      inventory_unit_id: crypto.randomUUID(),
                      status: "ACTIVE",
                      expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
                  },
              }
            : {
                  queue_entry_id: crypto.randomUUID(),
                  product_id: productId,
                  ticket_no: getNextTicketNo(database, productId),
                  status: "WAITING",
                  position: getNextWaitingPosition(database, productId),
                  message: "Вы в очереди на этот товар",
                  next_action: "Мы сообщим, когда товар будет доступен для оформления",
                  grant: null,
              };

        database.queues[key] = state;
        writeDatabase(database);
        mockBackend.rememberQueue(productId);
        return state;
    },

    getQueueState: async (userId: string, productId: string): Promise<QueueState | null> => {
        const database = readDatabase();
        const key = queueKey(userId, productId);
        const current = database.queues[key];
        if (!current) return null;
        const state = expireGrantIfNeeded(database, key, current);
        if (state !== current) {
            promoteWaitingEntries(database, productId);
            writeDatabase(database);
        }
        return state;
    },

    findQueueByGrant: async (userId: string, grantId: string): Promise<QueueState | null> => {
        const database = readDatabase();
        const entry = Object.entries(database.queues).find(
            ([key, state]) => key.startsWith(`${userId}:`) && state.grant?.id === grantId,
        );
        if (!entry) return null;
        const [key, current] = entry;
        const state = expireGrantIfNeeded(database, key, current);
        if (state !== current) {
            promoteWaitingEntries(database, current.product_id);
            writeDatabase(database);
        }
        return state;
    },

    leaveQueue: async (userId: string, productId: string): Promise<QueueState> => {
        const database = readDatabase();
        const key = queueKey(userId, productId);
        const current = database.queues[key];
        if (!current) throw new Error("Активная очередь не найдена");
        const next = {
            ...current,
            status: "CANCELLED" as const,
            position: null,
            message: "Вы вышли из очереди",
            next_action: "При повторном входе вы окажетесь в конце очереди",
            grant: current.grant ? { ...current.grant, status: "CANCELLED" as const } : null,
        };
        database.queues[key] = next;
        if (current.grant) promoteWaitingEntries(database, productId);
        writeDatabase(database);
        mockBackend.forgetQueue(productId);
        return next;
    },

    startCheckout: async (userId: string, grantId: string): Promise<QueueState> => {
        const database = readDatabase();
        const entry = Object.entries(database.queues).find(
            ([key, state]) => key.startsWith(`${userId}:`) && state.grant?.id === grantId,
        );
        if (!entry?.[1].grant) throw new Error("Право на оформление не найдено");
        const [key, stored] = entry;
        const current = expireGrantIfNeeded(database, key, stored);
        if (current !== stored) {
            promoteWaitingEntries(database, current.product_id);
            writeDatabase(database);
        }
        const grant = current.grant;
        if (!grant || current.status !== "GRANTED")
            throw new Error("Право на оформление больше недоступно");
        const next: QueueState = {
            ...current,
            status: "CHECKOUT_PENDING",
            message: "Оформление заказа начато",
            next_action: "Завершите demo-оплату до окончания времени",
            grant: { ...grant, status: "CHECKOUT_PENDING" },
        };
        database.queues[key] = next;
        writeDatabase(database);
        return next;
    },

    submitPayment: async (
        userId: string,
        grantId: string,
        request: PaymentResultRequest,
    ): Promise<PaymentResultResponse> => {
        const database = readDatabase();
        const previous = database.paymentResults[request.idempotency_key];
        if (previous) return previous;
        const entry = Object.entries(database.queues).find(
            ([key, state]) => key.startsWith(`${userId}:`) && state.grant?.id === grantId,
        );
        if (!entry?.[1].grant) throw new Error("Право на оформление не найдено");
        const [key, stored] = entry;
        const current = expireGrantIfNeeded(database, key, stored);
        if (current !== stored) {
            promoteWaitingEntries(database, current.product_id);
            writeDatabase(database);
        }
        const grant = current.grant;
        if (!grant || !["GRANTED", "CHECKOUT_PENDING"].includes(current.status))
            throw new Error("Право на оформление больше недоступно");
        const success = request.result === "success";
        const status = success
            ? "PURCHASED"
            : request.result === "timeout"
              ? "EXPIRED"
              : "PAYMENT_FAILED";
        const grantStatus = success
            ? "PURCHASED"
            : request.result === "timeout"
              ? "EXPIRED"
              : "FAILED";
        const product = await mockBackend.getProduct(current.product_id);
        const next: QueueState = {
            ...current,
            status,
            message: success
                ? "Покупка успешно завершена"
                : request.result === "timeout"
                  ? "Время на оплату закончилось"
                  : "Оплата не прошла",
            next_action: success
                ? "Заказ появится в личном кабинете"
                : product.isLimited
                  ? "Можно снова встать в конец очереди"
                  : "Можно снова оформить заказ",
            grant: { ...grant, status: grantStatus },
        };
        database.queues[key] = next;
        if (success) {
            const inventory = database.inventory[current.product_id] ?? product.inventory;
            database.inventory[current.product_id] = {
                ...inventory,
                available: Math.max(0, inventory.available - 1),
                sold: inventory.sold + 1,
                reserved: Math.max(0, inventory.reserved - 1),
            };
        }
        if (!success) promoteWaitingEntries(database, current.product_id);
        const response = { queue_state: next };
        database.paymentResults[request.idempotency_key] = response;
        writeDatabase(database);
        mockBackend.forgetQueue(current.product_id);
        return response;
    },

    rememberQueue: (productId: string) => {
        const ids = new Set<string>(JSON.parse(localStorage.getItem(KNOWN_QUEUES_KEY) ?? "[]"));
        ids.add(productId);
        localStorage.setItem(KNOWN_QUEUES_KEY, JSON.stringify([...ids]));
    },

    forgetQueue: (productId: string) => {
        const ids = new Set<string>(JSON.parse(localStorage.getItem(KNOWN_QUEUES_KEY) ?? "[]"));
        ids.delete(productId);
        localStorage.setItem(KNOWN_QUEUES_KEY, JSON.stringify([...ids]));
    },

    knownQueues: (): string[] =>
        JSON.parse(localStorage.getItem(KNOWN_QUEUES_KEY) ?? "[]") as string[],
};
