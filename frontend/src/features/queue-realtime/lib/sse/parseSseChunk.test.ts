import { describe, expect, it } from "vitest";
import { parseSseChunk } from "./parseSseChunk";

describe("parseSseChunk", () => {
    it("извлекает queue.changed и сохраняет незавершённый хвост", () => {
        const result = parseSseChunk(
            'event: queue.changed\ndata: {"product_id":"p1","queue_entry_id":"q1","occurred_at":"2026-08-09T10:00:00Z"}\n\nevent: queue',
        );
        expect(result.signals).toEqual([
            {
                type: "queue.changed",
                product_id: "p1",
                queue_entry_id: "q1",
                occurred_at: "2026-08-09T10:00:00Z",
            },
        ]);
        expect(result.rest).toBe("event: queue");
    });

    it("поддерживает CRLF и несколько строк data", () => {
        const result = parseSseChunk(
            'event: queue.changed\r\ndata: {"product_id":"p1",\r\ndata: "queue_entry_id":"q1","occurred_at":"2026-08-09T10:00:00Z"}\r\n\r\n',
        );

        expect(result.signals).toHaveLength(1);
        expect(result.signals[0].product_id).toBe("p1");
        expect(result.rest).toBe("");
    });
});
