import type { ThemeConfig } from "antd";

export const antdTheme: ThemeConfig = {
    token: {
        colorPrimary: "#1677ff",
        borderRadius: 12,
        fontSize: 16,
        controlHeight: 44,
    },

    components: {
        Button: {
            controlHeight: 44,
            borderRadius: 12,
            fontWeight: 600,
        },
        Input: {
            controlHeight: 44,
            borderRadius: 12,
        },
    },
};