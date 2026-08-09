import type { ThemeConfig } from "antd";

export const antdTheme: ThemeConfig = {
    token: {
        colorPrimary: "#00aaff",
        colorLink: "#00aaff",
        colorText: "#000000",
        fontFamily: '"Roboto Variable", Roboto, sans-serif',
        borderRadius: 14,
        fontSize: 16,
        controlHeight: 44,
    },

    components: {
        Button: {
            controlHeight: 44,
            borderRadius: 12,
            fontWeight: 600,
        },
        Modal: { borderRadiusLG: 28 },
        Input: {
            controlHeight: 44,
            borderRadius: 12,
        },
    },
};
