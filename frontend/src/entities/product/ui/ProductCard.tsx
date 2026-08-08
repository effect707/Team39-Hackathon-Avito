import type { IProduct } from "@/entities/product/model/types.ts";
import styles from "./ProductCard.module.css";
import { Heart, Ellipsis } from "lucide-react";

interface ProductCardProps {
    product: IProduct;
}

export const ProductCard = ({ product }: ProductCardProps) => {
  return (
      <article className={styles.card}>
          <div className={styles.imageWrapper}>
              <img
                  className={styles.image}
                  src={product.image}
                  alt={product.title}
              />

              {product.isLimited && (
                  <span className={styles.badge}>
                     Лимитированный товар
                  </span>
              )}
          </div>

          <div className={styles.content}>
              <div className={styles.info}>
                  <h2 className={styles.title}>
                      {product.title}
                  </h2>

                  <p className={styles.price}>
                      {product.price.toLocaleString("ru-RU")} ₽
                  </p>
              </div>

              <div className={styles.action}>
                  <Heart size={22}/>
                  <Ellipsis size={22} />
              </div>
          </div>
      </article>
  )
}