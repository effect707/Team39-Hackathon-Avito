import type { PropsWithChildren } from "react";
import { App, ConfigProvider } from "antd";
import { antdTheme } from "./config";

export const AntdProvider = ({ children }: PropsWithChildren) => {
    return (
        <ConfigProvider theme={antdTheme}>
            <App>{children}</App>
        </ConfigProvider>
    );
};
