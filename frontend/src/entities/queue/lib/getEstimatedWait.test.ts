import { describe, expect, it } from "vitest";
import { getEstimatedWait } from "@/entities/queue";

describe("getEstimatedWait", () => {
    it.each([
        [1, "меньше 2 минут"],
        [2, "примерно 2 минуты"],
        [6, "примерно 8–12 минут"],
        [12, "примерно 18–27 минут"],
    ])("показывает диапазон ожидания для позиции %i", (position, expected) => {
        expect(getEstimatedWait(position)).toBe(expected);
    });
});
