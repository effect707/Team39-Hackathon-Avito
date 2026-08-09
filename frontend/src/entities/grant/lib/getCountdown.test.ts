import { describe, expect, it } from "vitest";
import { getCountdown } from "./getCountdown";

describe("getCountdown", () => {
    it("не показывает отрицательное время после истечения", () => {
        expect(
            getCountdown("2026-08-09T10:00:00.000Z", Date.parse("2026-08-09T10:01:00.000Z")),
        ).toEqual({ totalSeconds: 0, label: "00:00", isWarning: true });
    });
    it("включает предупреждение на последних двух минутах", () => {
        expect(
            getCountdown("2026-08-09T10:01:59.000Z", Date.parse("2026-08-09T10:00:00.000Z")),
        ).toEqual({ totalSeconds: 119, label: "01:59", isWarning: true });
    });
});
