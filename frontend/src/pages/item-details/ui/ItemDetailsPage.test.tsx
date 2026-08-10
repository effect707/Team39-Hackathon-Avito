import { cleanup, render, screen } from "@testing-library/react";
import { Provider } from "react-redux";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeStore } from "@/app/providers/store/store";
import type { QueueState } from "@/entities/queue";
import { signedIn } from "@/entities/session";
import { mockProducts } from "@mocks/mockData";
import { ItemDetailsPage } from "./ItemDetailsPage";

const apiMocks = vi.hoisted(() => ({
    queueQuery: vi.fn<() => { data: QueueState | null }>(() => ({ data: null })),
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
        apiMocks.queueQuery.mockReturnValue({ data: null });
        apiMocks.productQuery.mockReturnValue({
            data: mockProducts[1],
            isLoading: false,
            isError: false,
        });
        apiMocks.alternativesQuery.mockReturnValue({ data: [], isLoading: false });
    });

    afterEach(cleanup);

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
        expect(screen.getByText(mockProducts[0].title)).toBeInTheDocument();
    });
});
