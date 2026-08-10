import { act, cleanup, render, screen } from "@testing-library/react";
import { Provider } from "react-redux";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeStore } from "@/app/providers/store/store";
import type { QueueState } from "@/entities/queue";
import { signedIn } from "@/entities/session";
import { mockProducts } from "@mocks/mockData";
import { ItemDetailsPage } from "./ItemDetailsPage";

const apiMocks = vi.hoisted(() => ({
    queueQuery: vi.fn<() => { data: QueueState | null; refetch?: ReturnType<typeof vi.fn> }>(
        () => ({
            data: null,
            refetch: vi.fn(),
        }),
    ),
    productQuery: vi.fn(),
    alternativesQuery: vi.fn(),
}));

vi.mock("@/entities/product", () => ({
    useGetProductQuery: apiMocks.productQuery,
    useGetAlternativesQuery: apiMocks.alternativesQuery,
    ProductCard: ({ product }: { product: { title: string } }) => (
        <article>{product.title}</article>
    ),
}));

vi.mock("@/entities/queue", () => ({
    useGetMyQueueStateQuery: apiMocks.queueQuery,
    useJoinQueueMutation: () => [vi.fn(), { isLoading: false }],
    useLeaveQueueMutation: () => [vi.fn(), { isLoading: false }],
}));

describe("ItemDetailsPage", () => {
    beforeEach(() => {
        apiMocks.queueQuery.mockReturnValue({ data: null, refetch: vi.fn() });
        apiMocks.productQuery.mockReturnValue({
            data: mockProducts[1],
            isLoading: false,
            isError: false,
        });
        apiMocks.alternativesQuery.mockReturnValue({ data: [], isLoading: false });
    });

    afterEach(cleanup);

    it("updates the purchase countdown in the product card", () => {
        vi.useFakeTimers();
        try {
            vi.setSystemTime(new Date("2026-08-10T12:00:00.000Z"));
            apiMocks.queueQuery.mockReturnValue({
                data: {
                    queue_entry_id: "entry-1",
                    product_id: "grimilde",
                    ticket_no: 1,
                    status: "GRANTED",
                    position: null,
                    message: "Можно приступать к оформлению",
                    next_action: "Перейти к оформлению",
                    grant: {
                        id: "grant-1",
                        product_id: "grimilde",
                        inventory_unit_id: "unit-1",
                        status: "ACTIVE",
                        expires_at: "2026-08-10T12:05:00.000Z",
                    },
                },
            });

            render(
                <Provider store={makeStore()}>
                    <MemoryRouter initialEntries={["/items/grimilde"]}>
                        <Routes>
                            <Route path="/items/:productId" element={<ItemDetailsPage />} />
                        </Routes>
                    </MemoryRouter>
                </Provider>,
            );

        expect(screen.getByRole("timer")).toHaveTextContent("05:00");
        expect(screen.queryByText("Можно приступать к оформлению")).not.toBeInTheDocument();
        act(() => vi.advanceTimersByTime(1000));
            expect(screen.getByRole("timer")).toHaveTextContent("04:59");
        } finally {
            vi.useRealTimers();
        }
    });

    it("switches the product action to buy when the grant expires locally", () => {
        vi.useFakeTimers();
        try {
            vi.setSystemTime(new Date("2026-08-10T12:00:00.000Z"));
            apiMocks.queueQuery.mockReturnValue({
                data: {
                    queue_entry_id: "entry-1",
                    product_id: "grimilde",
                    ticket_no: 1,
                    status: "GRANTED",
                    position: null,
                    message: "Можно приступать к оформлению",
                    next_action: "Перейти к оформлению",
                    grant: {
                        id: "grant-1",
                        product_id: "grimilde",
                        inventory_unit_id: "unit-1",
                        status: "ACTIVE",
                        expires_at: "2026-08-10T12:00:01.000Z",
                    },
                },
                refetch: vi.fn(),
            });

            render(
                <Provider store={makeStore()}>
                    <MemoryRouter initialEntries={["/items/grimilde"]}>
                        <Routes>
                            <Route path="/items/:productId" element={<ItemDetailsPage />} />
                        </Routes>
                    </MemoryRouter>
                </Provider>,
            );

            expect(screen.getByRole("button", { name: "Перейти к оформлению" })).toBeEnabled();
            act(() => vi.advanceTimersByTime(1000));
            expect(screen.getByRole("button", { name: "Купить" })).toBeEnabled();
            expect(
                screen.queryByRole("button", { name: "Перейти к оформлению" }),
            ).not.toBeInTheDocument();
        } finally {
            vi.useRealTimers();
        }
    });

    it("refetches queue state when the product page mounts", () => {
        const store = makeStore();
        store.dispatch(signedIn({ id: "user-1", name: "Анна", login: "anna" }));

        render(
            <Provider store={store}>
                <MemoryRouter initialEntries={["/items/grimilde"]}>
                    <Routes>
                        <Route path="/items/:productId" element={<ItemDetailsPage />} />
                    </Routes>
                </MemoryRouter>
            </Provider>,
        );

        expect(apiMocks.queueQuery).toHaveBeenCalledWith("grimilde", {
            skip: false,
            refetchOnMountOrArgChange: true,
        });
    });

    it("does not render empty rich-content sections for the minimal backend product", () => {
        apiMocks.productQuery.mockReturnValue({
            data: {
                ...mockProducts[1],
                characteristics: undefined,
                description: undefined,
                location: undefined,
                seller: undefined,
            },
            isLoading: false,
            isError: false,
        });

        render(
            <Provider store={makeStore()}>
                <MemoryRouter initialEntries={["/items/grimilde"]}>
                    <Routes>
                        <Route path="/items/:productId" element={<ItemDetailsPage />} />
                    </Routes>
                </MemoryRouter>
            </Provider>,
        );

        expect(screen.queryByRole("heading", { name: "Характеристики" })).not.toBeInTheDocument();
        expect(screen.queryByRole("heading", { name: "Описание" })).not.toBeInTheDocument();
        expect(screen.queryByText("Продавец")).not.toBeInTheDocument();
    });

    it("loads backend alternatives after an unsuccessful terminal queue state", () => {
        apiMocks.queueQuery.mockReturnValue({
            data: {
                queue_entry_id: "entry-1",
                product_id: "grimilde",
                ticket_no: 1,
                status: "PAYMENT_FAILED",
                position: null,
                message: "Оплата не прошла, резерв освобождён",
                next_action: "Открыть аналоги",
                grant: null,
            },
        });
        apiMocks.alternativesQuery.mockReturnValue({ data: [mockProducts[0]], isLoading: false });

        render(
            <Provider store={makeStore()}>
                <MemoryRouter initialEntries={["/items/grimilde"]}>
                    <Routes>
                        <Route path="/items/:productId" element={<ItemDetailsPage />} />
                    </Routes>
                </MemoryRouter>
            </Provider>,
        );

        expect(apiMocks.alternativesQuery).toHaveBeenCalledWith("grimilde", { skip: false });
        expect(screen.getByRole("heading", { name: "Похожие объявления" })).toBeInTheDocument();
        expect(screen.getAllByText(mockProducts[0].title).length).toBeGreaterThan(0);
    });

    it("keeps the queue modal open and shows alternatives when the product sells out", async () => {
        const store = makeStore();
        store.dispatch(signedIn({ id: "user-1", name: "Анна", login: "anna" }));
        apiMocks.queueQuery.mockReturnValue({
            data: {
                queue_entry_id: "entry-1",
                product_id: "grimilde",
                ticket_no: 1,
                status: "SOLD_OUT",
                position: null,
                message: "Товар закончился до вашей очереди",
                next_action: "Открыть аналоги",
                grant: null,
            },
        });
        apiMocks.alternativesQuery.mockReturnValue({ data: [mockProducts[0]], isLoading: false });

        render(
            <Provider store={store}>
                <MemoryRouter
                    initialEntries={[{ pathname: "/items/grimilde", state: { resumeQueue: true } }]}
                >
                    <Routes>
                        <Route path="/items/:productId" element={<ItemDetailsPage />} />
                    </Routes>
                </MemoryRouter>
            </Provider>,
        );

        expect(
            await screen.findByRole("heading", { name: "Товар закончился" }),
        ).toBeInTheDocument();
        expect(screen.getAllByText(mockProducts[0].title).length).toBeGreaterThan(0);
    });
});
