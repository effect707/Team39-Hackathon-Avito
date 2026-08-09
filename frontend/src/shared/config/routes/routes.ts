export const routePaths = {
    home: "/",
    itemDetails: "/items/:productId",
    checkout: "/checkout/:grantId",
    signIn: "/sign-in",
    signUp: "/sign-up",
    notFound: "*",
} as const;

export const getItemDetailsPath = (productId: string) => `/items/${productId}`;
export const getCheckoutPath = (grantId: string) => `/checkout/${grantId}`;

export type AuthMode = "sign-in" | "sign-up";

export const getAuthPath = (currentPath: string, mode: AuthMode) => {
    const url = new URL(currentPath, "http://localhost");
    url.searchParams.set("auth", mode);
    return `${url.pathname}${url.search}${url.hash}`;
};

export const getAuthClosePath = (currentPath: string) => {
    const url = new URL(currentPath, "http://localhost");
    url.searchParams.delete("auth");
    return `${url.pathname}${url.search}${url.hash}`;
};
