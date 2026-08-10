import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Button, Rate, Skeleton, message } from "antd";
import { BadgeCheck, Clock3, MapPin, PackageCheck, ShieldCheck } from "lucide-react";
import { useLocation, useNavigate, useParams } from "react-router";
import { useSelector } from "react-redux";
import type { SessionUser } from "@/entities/session";
import {
    useGetMyQueueStateQuery,
    useJoinQueueMutation,
    useLeaveQueueMutation,
} from "@/entities/queue";
import { ProductCard, useGetAlternativesQuery, useGetProductQuery } from "@/entities/product";
import { getAuthPath, getCheckoutPath } from "@/shared/config/routes";
import { getQueueCta } from "@/features/join-queue";
import { ErrorState } from "@/shared/ui/ErrorState";
import { Loader } from "@/shared/ui/Loader";
import { formatPrice } from "@/shared/lib/format/price";
import { getStockLabel } from "../lib/getStockLabel";
import styles from "./ItemDetailsPage.module.css";

const unsuccessfulStatuses = new Set(["EXPIRED", "PAYMENT_FAILED", "SOLD_OUT"]);

const QueueModal = lazy(() =>
    import("@/widgets/purchase-queue-modal").then((module) => ({
        default: module.QueueModal,
    })),
);

const ResumeQueueAction = ({ onResume }: { onResume: () => void }) => {
    const started = useRef(false);
    useEffect(() => {
        if (started.current) return;
        started.current = true;
        const timer = window.setTimeout(onResume, 0);
        return () => window.clearTimeout(timer);
    }, [onResume]);
    return null;
};

export const ItemDetailsPage = () => {
    const { productId = "" } = useParams();
    const user = useSelector(
        (state: { session: { user: SessionUser | null } }) => state.session.user,
    );
    const location = useLocation();
    const navigate = useNavigate();
    const [activeImage, setActiveImage] = useState(0);
    const [queueOpen, setQueueOpen] = useState(false);
    const { data: product, isLoading, isError, refetch } = useGetProductQuery(productId);
    const { data: queueState } = useGetMyQueueStateQuery(productId, {
        skip: !user,
        refetchOnMountOrArgChange: true,
    });
    const productSoldOut = Boolean(
        product &&
        (product.lifecycle_status !== "ACTIVE" ||
            (product.inventory.total > 0 && product.inventory.sold === product.inventory.total)),
    );
    const showAlternatives = Boolean(
        (queueState && unsuccessfulStatuses.has(queueState.status)) || productSoldOut,
    );
    const { data: alternatives = [], isLoading: alternativesLoading } = useGetAlternativesQuery(
        productId,
        { skip: !showAlternatives },
    );
    const [joinQueue, joinResult] = useJoinQueueMutation();
    const [leaveQueue, leaveResult] = useLeaveQueueMutation();
    const resumeQueue = Boolean((location.state as { resumeQueue?: boolean } | null)?.resumeQueue);
    const queueModalOpen = queueOpen || resumeQueue;

    if (isLoading) return <Skeleton active paragraph={{ rows: 12 }} />;
    if (isError || !product) return <ErrorState onRetry={refetch} />;
    const cta = getQueueCta(
        queueState?.status ?? null,
        product.isLimited,
        productSoldOut,
        queueState?.position,
    );
    const stockLabel = getStockLabel(
        product.inventory.available,
        queueState?.status ?? null,
        product.isLimited,
    );
    const images = product.images?.length ? product.images : [product.image_url ?? ""];

    const handleCta = async () => {
        if (!user) {
            navigate(getAuthPath(location.pathname, "sign-in"), {
                state: { from: location.pathname, resumeQueue: true },
            });
            return;
        }
        if (product.isLimited && queueState?.status === "WAITING") {
            setQueueOpen(true);
            return;
        }
        if (
            (queueState?.status === "GRANTED" || queueState?.status === "CHECKOUT_PENDING") &&
            queueState.grant
        ) {
            navigate(getCheckoutPath(product.id, queueState.grant.id));
            return;
        }
        if (!product.isLimited && product.inventory.available <= 0) {
            message.error("Товар закончился");
            return;
        }
        try {
            const next = await joinQueue(product.id).unwrap();
            if (next.status === "WAITING" && product.isLimited) setQueueOpen(true);
            if (next.status === "GRANTED" && next.grant)
                navigate(getCheckoutPath(product.id, next.grant.id));
        } catch {
            message.error("Не удалось присоединиться к очереди");
        }
    };
    const handleLeave = async () => {
        await leaveQueue(product.id).unwrap();
        setQueueOpen(false);
    };
    return (
        <div className={styles.page}>
            <section className={styles.content}>
                <h1>{product.title}</h1>
                <div className={styles.gallery}>
                    <div className={styles.hero}>
                        <img src={images[activeImage]} alt={product.title} />
                        {product.isLimited && (
                            <span className={styles.limitedBadge}>Лимитированный товар</span>
                        )}
                    </div>
                    <div className={styles.thumbnails}>
                        {images.map((image, index) => (
                            <button
                                className={index === activeImage ? styles.activeThumb : ""}
                                key={image}
                                onClick={() => setActiveImage(index)}
                                aria-label={`Фото ${index + 1}`}
                            >
                                <img src={image} alt="" />
                            </button>
                        ))}
                    </div>
                </div>
                {product.characteristics?.length ? (
                    <>
                        <h2>Характеристики</h2>
                        <dl className={styles.characteristics}>
                            {product.characteristics.map((item) => (
                                <div key={item.label}>
                                    <dt>{item.label}</dt>
                                    <dd>{item.value}</dd>
                                </div>
                            ))}
                        </dl>
                    </>
                ) : null}
                {product.description ? (
                    <>
                        <h2>Описание</h2>
                        <p className={styles.description}>{product.description}</p>
                    </>
                ) : null}
                {product.location ? (
                    <p className={styles.location}>
                        <MapPin size={20} />
                        {product.location}
                    </p>
                ) : null}
            </section>
            <aside className={styles.purchase}>
                <div className={styles.purchaseCard}>
                    <div className={styles.price}>{formatPrice(product.price)}</div>
                    {stockLabel && (
                        <div className={styles.stock}>
                            <PackageCheck size={19} />
                            {stockLabel}
                        </div>
                    )}
                    <Button
                        className={styles.cta}
                        type="primary"
                        disabled={cta.disabled}
                        loading={joinResult.isLoading}
                        onClick={handleCta}
                    >
                        {cta.label}
                    </Button>
                    {queueState && <p className={styles.stateMessage}>{queueState.message}</p>}
                </div>
                {product.seller ? (
                    <div className={styles.seller}>
                        <span>Продавец</span>
                        <h3>{product.seller.name}</h3>
                        <Rate disabled allowHalf value={product.seller.rating} />
                        <b>{product.seller.rating}</b>
                    </div>
                ) : null}
            </aside>
            {product.isLimited && (
                <aside className={styles.queueInfo}>
                    <div className={styles.queueCard}>
                        <div className={styles.queueIcon}>
                            <ShieldCheck />
                        </div>
                        <h2>Честная очередь</h2>
                        <p>
                            Для лимитированных товаров действует строгий порядок. Один аккаунт
                            занимает одно место.
                        </p>
                        <ul>
                            <li>
                                <BadgeCheck size={18} />
                                Место закреплено за аккаунтом
                            </li>
                            <li>
                                <Clock3 size={18} />
                                Срок оформления определяет сервер
                            </li>
                        </ul>
                    </div>
                </aside>
            )}
            {showAlternatives ? (
                <section className={styles.alternatives}>
                    <h2>Похожие объявления</h2>
                    {alternativesLoading ? (
                        <Skeleton active paragraph={{ rows: 3 }} />
                    ) : (
                        <div className={styles.alternativesGrid}>
                            {alternatives.map((alternative) => (
                                <ProductCard key={alternative.id} product={alternative} />
                            ))}
                        </div>
                    )}
                </section>
            ) : null}
            {queueState?.status === "WAITING" && queueModalOpen && (
                <Suspense fallback={<Loader />}>
                    <QueueModal
                        open
                        state={queueState}
                        leaving={leaveResult.isLoading}
                        onClose={() => {
                            setQueueOpen(false);
                            navigate(location.pathname, { replace: true, state: null });
                        }}
                        onLeave={handleLeave}
                    />
                </Suspense>
            )}
            {resumeQueue && !queueState && (
                <ResumeQueueAction
                    onResume={() => {
                        navigate(location.pathname, { replace: true, state: null });
                        void handleCta();
                    }}
                />
            )}
        </div>
    );
};
