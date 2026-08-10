import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { AntdProvider } from "@/app/providers";
import { makeStore } from "@/app/providers/store/store";
import { mockProducts } from "@mocks/mockData";
import { OrderPage } from "./OrderPage";

Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: () => ({
        matches: false,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
    }),
});

const apiMocks = vi.hoisted(() => ({
    queueByProductQuery: vi.fn(),
}));

const expiredQueueState = {
    queue_entry_id: "entry-1",
    product_id: "grimilde",
    ticket_no: 1,
    status: "GRANTED" as const,
    position: null,
    message: "Время на покупку истекло",
    next_action: "Можно снова купить товар, если он ещё доступен",
    grant: {
        id: "grant-1",
        product_id: "grimilde",
        inventory_unit_id: "unit-1",
        status: "ACTIVE" as const,
        expires_at: new Date(-1_000).toISOString(),
    },
};

apiMocks.queueByProductQuery.mockReturnValue({
    data: expiredQueueState,
    isLoading: false,
    isFetching: false,
    refetch: vi.fn(),
});
vi.mock("@/entities/queue", () => ({
    useGetMyQueueStateQuery: apiMocks.queueByProductQuery,
    useGetProductQuery: () => ({ data: mockProducts[1] }),
    useStartCheckoutMutation: () => [vi.fn(), { isLoading: false }],
    useSubmitDemoPaymentResultMutation: () => [vi.fn(), { isLoading: false }],
    useLeaveQueueMutation: () => [vi.fn()],
}));

vi.mock("@/entities/product", () => ({
    useGetProductQuery: () => ({ data: mockProducts[1] }),
}));

const Location = () => <output data-testid="location">{useLocation().pathname}</output>;

describe("OrderPage", () => {
    it("blocks payment and shows an expiry modal", async () => {
        const user = userEvent.setup();
        const store = makeStore();

        render(
            <Provider store={store}>
                <AntdProvider>
                    <MemoryRouter initialEntries={["/checkout/grimilde/grant-1"]}>
                        <Routes>
                            <Route path="/checkout/:productId/:grantId" element={<OrderPage />} />
                            <Route path="/" element={<Location />} />
                        </Routes>
                    </MemoryRouter>
                </AntdProvider>
            </Provider>,
        );

        expect(apiMocks.queueByProductQuery).toHaveBeenCalledWith("grimilde", {
            refetchOnMountOrArgChange: true,
        });

        expect(await screen.findByRole("button", { name: "Перейти к оплате" })).toBeDisabled();
        expect(
            screen.getByRole("heading", { name: "Время на покупку истекло" }),
        ).toBeInTheDocument();
        expect(store.getState().notifications.items).toEqual([
            expect.objectContaining({
                productId: "grimilde",
                type: "expired",
                read: false,
            }),
        ]);

        await user.click(screen.getByRole("button", { name: "На главную" }));

        expect(screen.getByTestId("location")).toHaveTextContent("/");
    });
});
