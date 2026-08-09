import { createBrowserRouter } from "react-router";
import { Layout } from "@/app/layout";
import { ErrorPage } from "@/pages/error";
import { HomePage } from "@/pages/home";
import { ItemDetailsPage } from "@/pages/item-details";
import { NotFoundPage } from "@/pages/not-found";
import { OrderPage } from "@/pages/order";
import { routePaths } from "@/shared/config/routes";

export const router = createBrowserRouter([
    {
        element: <Layout />,
        errorElement: <ErrorPage />,
        children: [
            {
                path: routePaths.home,
                element: <HomePage />,
            },
            {
                path: routePaths.itemDetails,
                element: <ItemDetailsPage />,
            },
            {
                path: routePaths.checkout,
                element: <OrderPage />,
            },
            {
                path: routePaths.signIn,
                element: <HomePage />,
            },
            {
                path: routePaths.signUp,
                element: <HomePage />,
            },
            {
                path: routePaths.notFound,
                element: <NotFoundPage />,
            },
        ],
    },
]);
