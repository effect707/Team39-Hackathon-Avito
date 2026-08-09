import type { SSESignal } from "@/entities/queue";

export const parseSseChunk = (chunk: string): { signals: SSESignal[]; rest: string } => {
    const blocks = chunk.replace(/\r\n?/g, "\n").split("\n\n");
    const rest = blocks.pop() ?? "";
    const signals = blocks.flatMap((block) => {
        const data = block
            .split("\n")
            .filter((line) => line.startsWith("data:"))
            .map((line) => line.slice(5).trim())
            .join("\n");
        if (!data) return [];
        try {
            const signal = JSON.parse(data) as SSESignal;
            return signal.type === "queue.changed" ? [signal] : [];
        } catch {
            return [];
        }
    });
    return { signals, rest };
};
