import type { Product } from "../model/types";
import { baseApi } from "@/shared/api/baseApi";

export const productApi = baseApi.injectEndpoints({
    endpoints: (builder) => ({
        listProducts: builder.query<Product[], void>({
            query: () => "/products",
            providesTags: (result) => [
                { type: "Product", id: "LIST" },
                ...(result ?? []).map(({ id }) => ({ type: "Product" as const, id })),
            ],
        }),
        getProduct: builder.query<Product, string>({
            query: (id) => `/products/${id}`,
            providesTags: (_result, _error, id) => [{ type: "Product", id }],
        }),
        getAlternatives: builder.query<Product[], string>({
            query: (id) => `/products/${id}/alternatives`,
        }),
    }),
});

export const { useGetProductQuery, useGetAlternativesQuery, useListProductsQuery } = productApi;
