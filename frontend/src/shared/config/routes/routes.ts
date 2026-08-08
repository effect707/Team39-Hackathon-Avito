export const AppRoute = {
    HOME: "home",
    ITEM_DETAILS: "item-details",
    NOT_FOUND: "not-found",
    SING_IN: "sing-in",
} as const;

export type AppRoute = (typeof AppRoute)[keyof typeof AppRoute];

export const routePaths = {
    [AppRoute.HOME]: "/",
    [AppRoute.ITEM_DETAILS]: "/items/:itemId",
    [AppRoute.NOT_FOUND]: "*",
    [AppRoute.SING_IN]: "/sing-in",
} satisfies Record<AppRoute, string>;

export const getItemDetailsPath = (itemId: string): string => `/items/${itemId}`;
