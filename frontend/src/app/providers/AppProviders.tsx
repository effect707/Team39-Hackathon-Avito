import type { PropsWithChildren } from "react";
import { Provider } from "react-redux";
import { AntdProvider } from "./antd/AntdProvider";
import { store } from "./store/store";

export const AppProviders = ({ children }: PropsWithChildren) => (
    <Provider store={store}>
        <AntdProvider>{children}</AntdProvider>
    </Provider>
);
