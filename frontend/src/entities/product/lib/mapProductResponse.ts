import type { Product, ProductResponse } from "../model/types";

export const mapProductResponse = (response: ProductResponse): Product => ({
    ...response,
    image_url: response.image_url ?? undefined,
    isLimited: response.queue_enabled,
    inventory: {
        ...response.inventory,
        total: response.inventory.available + response.inventory.reserved + response.inventory.sold,
    },
});
