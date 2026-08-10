import { Badge, Button, Dropdown, Empty } from "antd";
import { Bell, CheckCheck, CircleAlert, Clock3, MoveUp, Trash2 } from "lucide-react";
import { useNavigate } from "react-router";
import { type AppNotification, type NotificationType } from "@/entities/notification";
import { getItemDetailsPath } from "@/shared/config/routes";
import styles from "./Header.module.css";
import * as React from "react";

const icons: Record<NotificationType, React.ReactNode> = {
    progress: <MoveUp size={18} />,
    granted: <CheckCheck size={18} />,
    warning: <Clock3 size={18} />,
    expired: <CircleAlert size={18} />,
};

interface NotificationsDropdownProps {
    items: AppNotification[];
    onNotificationRead: (notificationId: string) => void;
    onAllNotificationsRead: () => void;
    onNotificationsClear: () => void;
}

export const NotificationsDropdown = ({
    items,
    onNotificationRead,
    onAllNotificationsRead,
    onNotificationsClear,
}: NotificationsDropdownProps) => {
    const navigate = useNavigate();
    const unread = items.filter((item) => !item.read).length;
    const handleNotificationClick = (item: AppNotification) => {
        onNotificationRead(item.id);
        navigate(getItemDetailsPath(item.productId));
    };
    const content = (
        <div className={styles.notifications}>
            <div className={styles.notificationsHead}>
                <strong>Уведомления</strong>
                <span>
                    <Button type="link" onClick={onAllNotificationsRead}>
                        Прочитать все
                    </Button>
                    <Button
                        type="text"
                        danger
                        disabled={items.length === 0}
                        onClick={onNotificationsClear}
                        aria-label="Очистить уведомления"
                        title="Очистить уведомления"
                    >
                        <Trash2 size={17} />
                    </Button>
                </span>
            </div>
            {items.length === 0 ? (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Пока нет уведомлений" />
            ) : (
                items.map((item) => (
                    <button
                        className={styles.notification}
                        key={item.id}
                        type="button"
                        aria-label={`Открыть товар ${item.productTitle}`}
                        onClick={() => handleNotificationClick(item)}
                    >
                        <span className={styles.notificationIcon}>{icons[item.type]}</span>
                        <div>
                            <strong>{item.title}</strong>
                            <p>{item.productTitle}</p>
                            <time>
                                {new Date(item.createdAt).toLocaleTimeString("ru-RU", {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                })}
                            </time>
                        </div>
                        {!item.read && <span className={styles.unread} />}
                    </button>
                ))
            )}
        </div>
    );
    return (
        <Dropdown trigger={["click"]} placement="bottomRight" popupRender={() => content}>
            <Button className={styles.iconButton} aria-label="Уведомления" type="text">
                <Badge count={unread} size="small">
                    <Bell size={23} />
                </Badge>
            </Button>
        </Dropdown>
    );
};
