import { createBrowserRouter } from "react-router";
import { routePaths } from "@/shared/config/routes";
import { ItemDetailsPage } from "@/pages/item-details";
import { NotFoundPage } from "@/pages/not-found";
import { SingInPage } from "@/pages/sing-in";
import { HomePage } from "@/pages/home";

export const router = createBrowserRouter([
    {
        path: routePaths.home,
        element: <HomePage />,
    },
    {
        path: routePaths["item-details"],
        element: <ItemDetailsPage />,
    },
    {
        path: routePaths["not-found"],
        element: <NotFoundPage />,
    },
    {
        path: routePaths["sing-in"],
        element: <SingInPage />,
    },
]);
