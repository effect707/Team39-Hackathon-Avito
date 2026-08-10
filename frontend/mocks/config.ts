export const isMockApi =
    (import.meta.env.VITE_API_MODE ?? (import.meta.env.MODE === "mock" ? "mock" : "backend")) ===
    "mock";
