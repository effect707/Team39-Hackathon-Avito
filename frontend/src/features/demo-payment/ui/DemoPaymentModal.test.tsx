import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DemoPaymentModal, PaymentResultModal } from "./DemoPaymentModal";

describe("DemoPaymentModal", () => {
    it("не показывает истечение времени для обычного товара", () => {
        render(
            <DemoPaymentModal
                open
                loading={false}
                isLimited={false}
                onCancel={vi.fn()}
                onResult={vi.fn()}
            />,
        );

        expect(screen.queryByRole("button", { name: "Истекло время" })).not.toBeInTheDocument();
    });

    it("не показывает результат demo-оплаты при истечении права", () => {
        render(
            <PaymentResultModal
                status="timeout"
                message="Время на оплату закончилось"
                nextAction="Можно снова встать в конец очереди"
                onClose={vi.fn()}
            />,
        );

        expect(
            screen.queryByRole("heading", { name: "Время на оплату закончилось" }),
        ).not.toBeInTheDocument();
    });
});
