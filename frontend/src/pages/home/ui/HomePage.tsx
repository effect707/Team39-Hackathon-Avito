import { Header } from "@/widgets/header";
import styles from "./HomePage.module.css";
import { ProductCard } from "@/entities/product";
import { Footer } from "@/shared/ui/Footer";

const product = [
    {
        id: "1",
        title: "Статуэтка Стэна Ли: Король Камео MC-030",
        price: 46_230,
        image: "./public/bk2.jpeg",
        isLimited: true
    },
    {
        id: "3",
        title: "Фигурка «Лило и Стич»: Стич в летнем настроении DS-126 D-Stage, 15 см",
        price: 4_720,
        image: "./public/bk3.jpeg",
        isLimited: false
    },
    {
        id: "2",
        title: "Статуэтка Королевы Гримхильды Master Craft MC-061",
        price: 47_330,
        image: "./public/bk1.jpeg",
        isLimited: true
    }
];

export const HomePage = () => {
    return (
        <>
            <Header/>
                <div className={styles.catalog}>
                    {product.map((item) => (
                        <ProductCard key={item.id} product={item}/>
                    ))}
                </div>
            <Footer/>
        </>
)
};
