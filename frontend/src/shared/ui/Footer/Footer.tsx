import styles from "./Footer.module.css";

const footerLinks = [
    { title: "Помощь", href: "#" },
    { title: "Безопасность", href: "#" },
    { title: "Правила", href: "#" },
    { title: "О компании", href: "#" },
];

export const Footer = () => {
    return (
        <footer className={styles.footer}>
            <div className={styles.content}>
                <nav className={styles.links}>
                    {footerLinks.map(({ title, href }) => (
                        <a key={title} href={href} className={styles.link}>
                            {title}
                        </a>
                    ))}
                </nav>

                <p className={styles.copyright}>
                    © 2026 Команда 39. Учебный проект для хакатона.
                </p>
            </div>
        </footer>
    );
};