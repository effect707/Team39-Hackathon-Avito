import { render } from "@testing-library/react";
import { Provider } from "react-redux";
import { MemoryRouter, Route, Routes } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { makeStore } from "@/app/providers/store/store";
import { signedIn } from "@/entities/session";
import { mockProducts } from "@mocks/mockData";
import { ItemDetailsPage } from "./ItemDetailsPage";

const apiMocks = vi.hoisted(() => ({
    queueQuery: vi.fn(() => ({ data: null })),
}));

vi.mock("@/entities/product", () => ({
    useGetProductQuery: () => ({ data: mockProducts[1], isLoading: false, isError: false }),
}));

vi.mock("@/entities/queue", () => ({
    useGetMyQueueStateQuery: apiMocks.queueQuery,
    useJoinQueueMutation: () => [vi.fn(), { isLoading: false }],
    useLeaveQueueMutation: () => [vi.fn(), { isLoading: false }],
}));

describe("ItemDetailsPage", () => {
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
});
