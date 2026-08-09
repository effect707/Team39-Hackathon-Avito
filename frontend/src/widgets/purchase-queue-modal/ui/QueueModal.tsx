import { Button, Modal } from "antd";
import { BellRing } from "lucide-react";
import { getEstimatedWait, type QueueState } from "@/entities/queue";
import styles from "./QueueModal.module.css";

export const QueueModal = ({
    open,
    state,
    leaving,
    onClose,
    onLeave,
}: {
    open: boolean;
    state: QueueState;
    leaving: boolean;
    onClose: () => void;
    onLeave: () => void;
}) => (
    <Modal className={styles.modal} width={500} open={open} footer={null} onCancel={onClose}>
        <div className={styles.icon}>
            <BellRing />
        </div>
        <h2 className={styles.title}>Вы в очереди</h2>
        <p className={styles.position}>
            Ваше место<strong>{state.position ?? "—"}</strong>
        </p>
        <p className={styles.wait}>Ожидание: {getEstimatedWait(state.position ?? 1)}</p>
        <div className={styles.note}>
            {state.message}. {state.next_action}.
        </div>
        <div className={styles.actions}>
            <Button className={styles.stay} type="primary" onClick={onClose}>
                Хорошо
            </Button>
            <Button danger loading={leaving} onClick={onLeave}>
                Выйти из очереди
            </Button>
        </div>
    </Modal>
);
