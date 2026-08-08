import type { PropsWithChildren } from "react";
import { ConfigProvider } from "antd";
import { antdTheme } from "@/shared/config/antd";

export const AntdProvider = ({ children }: PropsWithChildren) => {
    return <ConfigProvider theme={antdTheme}>{children}</ConfigProvider>;
};