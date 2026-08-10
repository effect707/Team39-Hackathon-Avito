import { Button, Modal } from "antd";
import { BellRing, PackageX } from "lucide-react";
import { getEstimatedWait, type QueueState } from "@/entities/queue";
import { ProductCard, type Product } from "@/entities/product";
import styles from "./QueueModal.module.css";

export const QueueModal = ({
    open,
    state,
    leaving,
    alternatives,
    onClose,
    onLeave,
}: {
    open: boolean;
    state: QueueState;
    leaving: boolean;
    alternatives: Product[];
    onClose: () => void;
    onLeave: () => void;
}) => {
    const soldOut = state.status === "SOLD_OUT";

    return (
        <Modal className={styles.modal} width={soldOut ? 760 : 500} open={open} footer={null} onCancel={onClose}>
            <div className={styles.icon}>{soldOut ? <PackageX /> : <BellRing />}</div>
            <h2 className={styles.title}>{soldOut ? "Товар закончился" : "Вы в очереди"}</h2>
            {!soldOut && (
                <>
                    <p className={styles.position}>
                        Ваше место<strong>{state.position ?? "—"}</strong>
                    </p>
                    <p className={styles.wait}>Ожидание: {getEstimatedWait(state.position ?? 1)}</p>
                </>
            )}
            <div className={styles.note}>
                {state.message}. {state.next_action}.
            </div>
            {soldOut && alternatives.length > 0 && (
                <section className={styles.alternatives}>
                    <h3>Возможно, вам подойдут похожие товары</h3>
                    <div className={styles.alternativesGrid}>
                        {alternatives.map((alternative) => (
                            <ProductCard key={alternative.id} product={alternative} />
                        ))}
                    </div>
                </section>
            )}
            <div className={styles.actions}>
                <Button className={styles.stay} type="primary" onClick={onClose}>
                    Хорошо
                </Button>
                {!soldOut && (
                    <Button danger loading={leaving} onClick={onLeave}>
                        Выйти из очереди
                    </Button>
                )}
            </div>
        </Modal>
    );
};
