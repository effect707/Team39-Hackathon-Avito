import { useEffect, useRef, useState } from "react";
import { Button, Form, Input, Modal, Skeleton, message } from "antd";
import { ArrowLeft, Clock3, Package, ShieldCheck } from "lucide-react";
import { useNavigate, useParams } from "react-router";
import { useDispatch } from "react-redux";
import { getItemDetailsPath } from "@/shared/config/routes";
import { formatPrice } from "@/shared/lib/format/price";
import { useGetProductQuery } from "@/entities/product";
import { getCountdown } from "@/entities/grant";
import { notificationAdded } from "@/entities/notification";
import {
    useGetQueueByGrantQuery,
    useLeaveQueueMutation,
    useStartCheckoutMutation,
    useSubmitDemoPaymentResultMutation,
} from "@/entities/queue";
import { DemoPaymentModal, PaymentResultModal } from "@/features/demo-payment";
import { getOrderMode } from "../lib/getOrderMode";
import { isCheckoutAvailable } from "../lib/isCheckoutAvailable";
import styles from "./OrderPage.module.css";

const TimerNotification = ({
    productId,
    productTitle,
    seconds,
}: {
    productId: string;
    productTitle: string;
    seconds: number;
}) => {
    const dispatch = useDispatch();
    useEffect(() => {
        if (seconds > 0 && seconds <= 120) {
            dispatch(
                notificationAdded({
                    id: `${productId}:warning:120`,
                    productId,
                    productTitle,
                    type: "warning",
                    title: "Осталось меньше двух минут",
                    createdAt: new Date().toISOString(),
                    read: false,
                }),
            );
        }
    }, [dispatch, productId, productTitle, seconds]);
    return null;
};

export const OrderPage = () => {
    const { grantId = "" } = useParams();
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const {
        data: queueState,
        isLoading,
        isFetching,
        refetch,
    } = useGetQueueByGrantQuery(grantId, { refetchOnMountOrArgChange: true });
    const { data: product } = useGetProductQuery(queueState?.product_id ?? "", {
        skip: !queueState,
    });
    const orderMode = getOrderMode(product?.isLimited ?? false);
    const [startCheckout, start] = useStartCheckoutMutation();
    const [submitPayment, payment] = useSubmitDemoPaymentResultMutation();
    const [leaveQueue] = useLeaveQueueMutation();
    const [now, setNow] = useState(0);
    const [paymentOpen, setPaymentOpen] = useState(false);
    const [result, setResult] = useState<
        | { status: "idle" }
        | { status: "success" | "failure" | "timeout"; message: string; nextAction: string }
    >({ status: "idle" });
    const [leaveOpen, setLeaveOpen] = useState(false);
    const idempotencyKey = useRef<string | null>(null);
    useEffect(() => {
        if (!product?.isLimited) return;
        const initial = window.setTimeout(() => setNow(Date.now()), 0);
        const timer = window.setInterval(() => setNow(Date.now()), 1000);
        return () => {
            window.clearTimeout(initial);
            window.clearInterval(timer);
        };
    }, [product?.isLimited]);
    const countdown = getCountdown(queueState?.grant?.expires_at ?? "", now);
    const isExpired = queueState?.status === "EXPIRED" || countdown.totalSeconds === 0;
    useEffect(() => {
        if (product?.isLimited && queueState?.grant && countdown.totalSeconds === 0) void refetch();
    }, [countdown.totalSeconds, product?.isLimited, queueState?.grant, refetch]);
    useEffect(() => {
        if (
            isFetching ||
            !queueState ||
            isCheckoutAvailable(queueState.status) ||
            queueState.status === "EXPIRED"
        )
            return;
        navigate(`/items/${queueState.product_id}`, { replace: true });
    }, [isFetching, navigate, queueState]);
    useEffect(() => {
        if (!isExpired || !product) return;
        dispatch(
            notificationAdded({
                id: `${product.id}:EXPIRED:EXPIRED`,
                productId: product.id,
                productTitle: product.title,
                type: "expired",
                title: "Время на покупку истекло",
                createdAt: new Date().toISOString(),
                read: false,
            }),
        );
    }, [dispatch, isExpired, product]);
    if (isLoading || isFetching || !queueState || !product) {
        return <Skeleton active paragraph={{ rows: 12 }} />;
    }
    if (!isCheckoutAvailable(queueState.status) && !isExpired) return null;
    const openPayment = async () => {
        if (isExpired || countdown.totalSeconds === 0) return;
        try {
            if (queueState.status === "GRANTED") await startCheckout(grantId).unwrap();
            setPaymentOpen(true);
        } catch {
            message.error("Право на покупку больше недоступно");
            void refetch();
        }
    };
    const chooseResult = async (selected: "success" | "failure" | "timeout") => {
        try {
            idempotencyKey.current ??= crypto.randomUUID();
            const response = await submitPayment({
                grantId,
                request: { idempotency_key: idempotencyKey.current, result: selected },
            }).unwrap();
            setPaymentOpen(false);
            setResult({
                status: selected,
                message: response.queue_state.message,
                nextAction: response.queue_state.next_action,
            });
        } catch {
            message.error("Не удалось получить результат оплаты. Повторите попытку.");
        }
    };
    const confirmLeave = async () => {
        await leaveQueue(product.id).unwrap();
        navigate(`/items/${product.id}`, { replace: true });
    };
    return (
        <main className={styles.page}>
            {orderMode.showTimer && (
                <TimerNotification
                    productId={product.id}
                    productTitle={product.title}
                    seconds={countdown.totalSeconds}
                />
            )}
            <Button
                type="link"
                className={styles.back}
                onClick={() =>
                    product.isLimited ? setLeaveOpen(true) : navigate(`/items/${product.id}`)
                }
            >
                <ArrowLeft size={19} />
                Назад
            </Button>
            <h1>{orderMode.title}</h1>
            <div className={styles.grid}>
                <div className={styles.left}>
                    <section className={styles.section}>
                        <h2>Способ получения</h2>
                        <div className={styles.delivery}>
                            <h3>Авито Доставка</h3>
                            <p>Пункт выдачи: Москва, улица Тверская, 12</p>
                            <div className={styles.productRow}>
                                <img src={product.image_url} alt="" />
                                <div>
                                    <Package size={20} />
                                    <strong>{product.title}</strong>
                                </div>
                            </div>
                        </div>
                    </section>
                    <section className={styles.section}>
                        <h2>Получатель</h2>
                        <Form
                            className={styles.fields}
                            layout="vertical"
                            requiredMark={false}
                            onFinish={openPayment}
                            id="checkout-form"
                        >
                            <Form.Item
                                label="ФИО"
                                name="name"
                                rules={[{ required: true, message: "Введите ФИО" }]}
                            >
                                <Input
                                    className={styles.field}
                                    placeholder="Иванов Иван Иванович"
                                />
                            </Form.Item>
                            <Form.Item
                                label="Телефон"
                                name="phone"
                                rules={[{ required: true, message: "Введите телефон" }]}
                            >
                                <Input className={styles.field} placeholder="+7 999 000-00-00" />
                            </Form.Item>
                            <Form.Item
                                label="Почта"
                                name="email"
                                rules={[
                                    {
                                        required: true,
                                        type: "email",
                                        message: "Введите корректную почту",
                                    },
                                ]}
                            >
                                <Input className={styles.field} placeholder="mail@example.ru" />
                            </Form.Item>
                        </Form>
                    </section>
                </div>
                <aside className={styles.aside}>
                    <div className={styles.order}>
                        <h2>Ваш заказ</h2>
                        <div className={styles.row}>
                            <span>1 товар</span>
                            <span>{formatPrice(product.price)}</span>
                        </div>
                        <div className={styles.row}>
                            <span>Авито Доставка</span>
                            <span>0 ₽</span>
                        </div>
                        <div className={`${styles.row} ${styles.total}`}>
                            <span>Итого</span>
                            <span>{formatPrice(product.price)}</span>
                        </div>
                        <Button
                            className={styles.pay}
                            type="primary"
                            htmlType="submit"
                            form="checkout-form"
                            loading={start.isLoading}
                            disabled={isExpired || countdown.totalSeconds === 0}
                        >
                            Перейти к оплате
                        </Button>
                    </div>
                    {orderMode.showTimer && (
                        <div
                            className={`${styles.timer} ${countdown.isWarning ? styles.warning : ""}`}
                        >
                            <h2>Время на покупку</h2>
                            <div className={styles.timerValue}>{countdown.label}</div>
                            <p>Товар закреплён за вами до окончания таймера</p>
                        </div>
                    )}
                    <div className={styles.protection}>
                        <h2>
                            {product.isLimited ? "Как работает защита" : "Безопасное оформление"}
                        </h2>
                        <div className={styles.protectionGrid}>
                            {product.isLimited ? (
                                <>
                                    <div className={styles.protectItem}>
                                        <ShieldCheck />
                                        <p>Место нельзя передать другому</p>
                                    </div>
                                    <div className={styles.protectItem}>
                                        <Clock3 />
                                        <p>Время проверяет сервер</p>
                                    </div>
                                </>
                            ) : (
                                <div className={styles.protectItem}>
                                    <ShieldCheck />
                                    <p>Данные заказа защищены</p>
                                </div>
                            )}
                        </div>
                    </div>
                </aside>
            </div>
            <DemoPaymentModal
                open={paymentOpen}
                loading={payment.isLoading}
                isLimited={product.isLimited}
                onCancel={() => setPaymentOpen(false)}
                onResult={chooseResult}
            />
            <PaymentResultModal
                status={result.status === "idle" ? null : result.status}
                message={result.status === "idle" ? "" : result.message}
                nextAction={result.status === "idle" ? "" : result.nextAction}
                onClose={() =>
                    navigate(result.status === "success" ? "/" : getItemDetailsPath(product.id))
                }
            />
            <Modal
                open={isExpired}
                closable={false}
                mask={{ closable: false }}
                keyboard={false}
                footer={
                    <Button type="primary" onClick={() => navigate("/")}>
                        На главную
                    </Button>
                }
            >
                <h2>Время на покупку истекло</h2>
                <p>Товар больше не закреплён за вами. Вы можете попробовать купить его снова.</p>
            </Modal>
            <Modal
                open={leaveOpen}
                title="Отказаться от покупки?"
                okText="Отказаться"
                cancelText="Продолжить оформление"
                okButtonProps={{ danger: true }}
                onOk={confirmLeave}
                onCancel={() => setLeaveOpen(false)}
            >
                <p>
                    Товар лимитированный. После отказа право на покупку будет потеряно, а при
                    повторном входе вы окажетесь в конце очереди.
                </p>
            </Modal>
        </main>
    );
};
