import { Avatar, Button, Dropdown, Input, type MenuProps } from "antd";
import { LockKeyhole, LogOut, Search, UserRound } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router";
import type { AppNotification } from "@/entities/notification";
import type { SessionUser } from "@/entities/session";
import { getAuthPath } from "@/shared/config/routes";
import { NotificationsDropdown } from "./NotificationsDropdown";
import styles from "./Header.module.css";

interface HeaderProps {
    user: SessionUser | null;
    notifications: AppNotification[];
    onSignOut: () => void;
    onNotificationRead: (notificationId: string) => void;
    onAllNotificationsRead: () => void;
    onNotificationsClear: () => void;
}

export const Header = ({
    user,
    notifications,
    onSignOut,
    onNotificationRead,
    onAllNotificationsRead,
    onNotificationsClear,
}: HeaderProps) => {
    const navigate = useNavigate();
    const location = useLocation();
    const menu: MenuProps["items"] = [
        { key: "profile", icon: <UserRound size={17} />, label: "Личный кабинет", disabled: true },
        { type: "divider" },
        {
            key: "logout",
            icon: <LogOut size={17} />,
            label: "Выйти",
            onClick: () => {
                onSignOut();
                navigate("/", { replace: true });
            },
        },
    ];
    return (
        <header className={styles.header}>
            <div className={styles.container}>
                <Link to="/" aria-label="На главную">
                    <img src="/Avito_logo.svg.webp" alt="Avito" className={styles.logo} />
                </Link>
                <div className={styles.search}>
                    <Input
                        className={styles.searchInput}
                        prefix={<Search size={18} />}
                        placeholder="Поиск по объявлениям"
                        aria-label="Поиск"
                    />
                    <Button type="primary" className={styles.searchButton}>
                        Найти
                    </Button>
                </div>
                {user ? (
                    <div className={styles.userActions}>
                        <NotificationsDropdown
                            items={notifications}
                            onNotificationRead={onNotificationRead}
                            onAllNotificationsRead={onAllNotificationsRead}
                            onNotificationsClear={onNotificationsClear}
                        />
                        <Dropdown menu={{ items: menu }} trigger={["click"]}>
                            <Button
                                type="text"
                                className={styles.avatarButton}
                                aria-label="Меню профиля"
                            >
                                <Avatar>{user.name.slice(0, 1).toUpperCase()}</Avatar>
                            </Button>
                        </Dropdown>
                    </div>
                ) : (
                    <Button
                        className={styles.authButton}
                        onClick={() =>
                            navigate(getAuthPath(location.pathname + location.search, "sign-in"), {
                                state: { from: location.pathname + location.search },
                            })
                        }
                    >
                        <LockKeyhole size={19} />
                        Вход и регистрация
                    </Button>
                )}
            </div>
        </header>
    );
};
