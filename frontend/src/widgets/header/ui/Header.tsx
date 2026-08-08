import { Button, Input } from "antd";
import { LockKeyhole } from "lucide-react";
import styles from "./Header.module.css";
import { Search } from "lucide-react";

export const Header = () => {
    return (
        <header className={styles.header}>
            <div className={styles.container}>
                <img src={"./public/Avito_logo.svg.webp"} alt="Avito" className={styles.logo} />

                <div className={styles.search}>
                    <Input
                        className={styles.searchInput}
                        prefix={<Search size={18} />}
                        placeholder="Поиск по объявлениям"
                    />
                    <Button
                        type="primary"
                        className={styles.searchButton}
                    >
                        Найти
                    </Button>
                </div>

                <Button className={styles.authButton}>
                    <LockKeyhole />
                    Вход и регистрация
                </Button>
            </div>
        </header>
    )
};