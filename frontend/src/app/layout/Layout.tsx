import { lazy, Suspense } from "react";
import { Outlet, useLocation } from "react-router";
import { useAppDispatch, useAppSelector } from "@/app/providers";
import { allNotificationsRead, notificationRead } from "@/entities/notification";
import { signedIn, signedOut } from "@/entities/session";
import { Header } from "@/widgets/header";
import styles from "./Layout.module.css";
import { Footer } from "@/widgets/footer";
import { QueueRealtime } from "@/app/realtime";
import { Loader } from "@/shared/ui/Loader";

const AuthModal = lazy(() =>
    import("@/features/auth").then((module) => ({ default: module.AuthModal })),
);

export const Layout = () => {
    const location = useLocation();
    const dispatch = useAppDispatch();
    const user = useAppSelector((state) => state.session.user);
    const notifications = useAppSelector((state) => state.notifications.items);
    const authMode = new URLSearchParams(location.search).get("auth");
    const authModalOpen =
        location.pathname === "/sign-in" ||
        location.pathname === "/sign-up" ||
        authMode === "sign-in" ||
        authMode === "sign-up";

    return (
        <div className={styles.layout}>
            <Header
                user={user}
                notifications={notifications}
                onSignOut={() => dispatch(signedOut())}
                onNotificationRead={(notificationId) => dispatch(notificationRead(notificationId))}
                onAllNotificationsRead={() => dispatch(allNotificationsRead())}
            />

            <main className={styles.main}>
                <div className="page-container">
                    <Outlet />
                </div>
            </main>

            <Footer />
            {authModalOpen && (
                <Suspense fallback={<Loader />}>
                    <AuthModal onSignedIn={(nextUser) => dispatch(signedIn(nextUser))} />
                </Suspense>
            )}
            <QueueRealtime />
        </div>
    );
};
