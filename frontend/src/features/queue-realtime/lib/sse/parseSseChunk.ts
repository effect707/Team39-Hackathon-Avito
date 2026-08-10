import type { SSESignal } from "@/entities/queue";

export const parseSseChunk = (chunk: string): { signals: SSESignal[]; rest: string } => {
    const blocks = chunk.replace(/\r\n?/g, "\n").split("\n\n");
    const rest = blocks.pop() ?? "";
    const signals = blocks.flatMap((block) => {
        const event = block
            .split("\n")
            .find((line) => line.startsWith("event:"))
            ?.slice(6)
            .trim();
        if (event !== "queue.changed") return [];
        const data = block
            .split("\n")
            .filter((line) => line.startsWith("data:"))
            .map((line) => line.slice(5).trim())
            .join("\n");
        if (!data) return [];
        try {
            const signal = JSON.parse(data) as Omit<SSESignal, "type">;
            return [{ ...signal, type: "queue.changed" as const }];
        } catch {
            return [];
        }
    });
    return { signals, rest };
};
