import { Button, Modal } from "antd";
import type { PaymentResultRequest } from "@/entities/queue";
import styles from "./DemoPaymentModal.module.css";

export const DemoPaymentModal = ({
    open,
    loading,
    isLimited,
    onCancel,
    onResult,
}: {
    open: boolean;
    loading: boolean;
    isLimited: boolean;
    onCancel: () => void;
    onResult: (result: PaymentResultRequest["result"]) => void;
}) => (
    <Modal className={styles.modal} width={520} open={open} footer={null} onCancel={onCancel}>
        <span className={styles.badge}>Demo-оплата</span>
        <h2 className={styles.title}>Выберите результат оплаты</h2>
        <p className={styles.copy}>
            В реальном приложении результат придёт от платёжной системы. Для демонстрации выберите
            сценарий.
        </p>
        <div className={styles.actions}>
            <Button type="primary" loading={loading} onClick={() => onResult("success")}>
                Оплата прошла
            </Button>
            <Button loading={loading} onClick={() => onResult("failure")}>
                Оплата не прошла
            </Button>
            {isLimited && (
                <Button loading={loading} onClick={() => onResult("timeout")}>
                    Истекло время
                </Button>
            )}
        </div>
    </Modal>
);

export const PaymentResultModal = ({
    status,
    message,
    nextAction,
    onClose,
}: {
    status: "success" | "failure" | "timeout" | null;
    message: string;
    nextAction: string;
    onClose: () => void;
}) => (
    <Modal
        className={styles.result}
        width={500}
        open={status === "success" || status === "failure"}
        footer={null}
        onCancel={onClose}
    >
        <span className={status === "success" ? styles.success : styles.failure}>
            {status === "success"
                ? "Готово"
                : status === "timeout"
                  ? "Время истекло"
                  : "Ошибка оплаты"}
        </span>
        <h2 className={styles.title}>{message}</h2>
        <p className={styles.copy}>{nextAction}</p>
        <Button type="primary" onClick={onClose}>
            {status === "success" ? "Вернуться к покупкам" : "Понятно"}
        </Button>
    </Modal>
);
