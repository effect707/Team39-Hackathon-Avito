import { ProductCard, useListProductsQuery } from "@/entities/product";
import { ErrorState } from "@/shared/ui/ErrorState";
import { Loader } from "@/shared/ui/Loader";
import styles from "./HomePage.module.css";

export const HomePage = () => {
    const { data, isLoading, isError, refetch } = useListProductsQuery();
    if (isLoading) return <Loader />;
    if (isError || !data) return <ErrorState onRetry={refetch} />;
    return (
        <section>
            <h1 className={styles.heading}>Рекомендации для вас</h1>
            <div className={styles.catalog}>
                {data.map((product) => (
                    <ProductCard key={product.id} product={product} />
                ))}
            </div>
        </section>
    );
};
