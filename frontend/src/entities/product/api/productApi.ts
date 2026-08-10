import { mapProductResponse } from "../lib/mapProductResponse";
import type { Product, ProductListResponse, ProductResponse } from "../model/types";
import { baseApi } from "@/shared/api/baseApi";

export const productApi = baseApi.injectEndpoints({
    endpoints: (builder) => ({
        listProducts: builder.query<Product[], void>({
            query: () => "/products",
            transformResponse: (response: ProductListResponse) =>
                response.products.map(mapProductResponse),
            providesTags: (result) => [
                { type: "Product", id: "LIST" },
                ...(result ?? []).map(({ id }) => ({ type: "Product" as const, id })),
            ],
        }),
        getProduct: builder.query<Product, string>({
            query: (id) => `/products/${id}`,
            transformResponse: (response: ProductResponse) => mapProductResponse(response),
            providesTags: (_result, _error, id) => [{ type: "Product", id }],
        }),
        getAlternatives: builder.query<Product[], string>({
            query: (id) => `/products/${id}/alternatives`,
            transformResponse: (response: ProductListResponse) =>
                response.products.map(mapProductResponse),
        }),
    }),
});

export const { useGetProductQuery, useGetAlternativesQuery, useListProductsQuery } = productApi;
