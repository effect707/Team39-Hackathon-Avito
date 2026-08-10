import type { BaseQueryFn, FetchArgs, FetchBaseQueryError } from "@reduxjs/toolkit/query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { makeStore } from "@/app/providers/store/store";
import { configureBaseQuery } from "@/shared/api/baseApi";
import { mockBaseQuery } from "@mocks/mockBaseQuery";
import { productApi } from "./productApi";

const backendProduct = {
    id: "10000000-0000-4000-8000-000000000001",
    title: "Фотоаппарат Fujifilm X100V",
    category: "Фото и видео",
    price: "129990.00",
    image_url: null,
    queue_enabled: true,
    lifecycle_status: "ACTIVE" as const,
    inventory: { available: 1, reserved: 2, sold: 3 },
};

describe("productApi backend contract", () => {
    afterEach(() => configureBaseQuery(mockBaseQuery));

    it("unwraps the product list envelope and derives frontend-only inventory fields", async () => {
        const query = vi.fn(async () => ({ data: { products: [backendProduct] } }));
        configureBaseQuery(query as BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError>);
        const store = makeStore();

        const products = await store
            .dispatch(productApi.endpoints.listProducts.initiate())
            .unwrap();

        expect(query).toHaveBeenCalledWith("/products", expect.anything(), undefined);
        expect(products).toEqual([
            expect.objectContaining({
                id: backendProduct.id,
                isLimited: true,
                image_url: undefined,
                inventory: { available: 1, reserved: 2, sold: 3, total: 6 },
            }),
        ]);
    });
});
