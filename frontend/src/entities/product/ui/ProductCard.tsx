import { Ellipsis, Heart } from "lucide-react";
import { Link } from "react-router";
import type { Product } from "../model/types";
import { getItemDetailsPath } from "@/shared/config/routes";
import { formatPrice } from "@/shared/lib/format/price";
import styles from "./ProductCard.module.css";

export const ProductCard = ({ product }: { product: Product }) => (
    <article className={styles.card}>
        <Link className={styles.link} to={getItemDetailsPath(product.id)}>
            <div className={styles.imageWrapper}>
                <img className={styles.image} src={product.image_url} alt={product.title} />
                {product.isLimited && <span className={styles.badge}>Лимитированный товар</span>}
            </div>
            <div className={styles.content}>
                <div className={styles.info}>
                    <h2 className={styles.title}>{product.title}</h2>
                    <p className={styles.price}>{formatPrice(product.price)}</p>
                </div>
                <div className={styles.action}>
                    <Heart size={22} />
                    <Ellipsis size={22} />
                </div>
            </div>
        </Link>
    </article>
);
