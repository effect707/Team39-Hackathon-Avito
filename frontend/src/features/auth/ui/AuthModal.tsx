import { useState } from "react";
import { Alert, Button, Form, Input, Modal } from "antd";
import { useLocation, useNavigate } from "react-router";
import { signIn, signUp, type SessionUser } from "@/entities/session";
import { getAuthClosePath, getAuthPath, type AuthMode } from "@/shared/config/routes";
import styles from "./AuthModal.module.css";

interface Values {
    name?: string;
    login: string;
    password: string;
    confirm?: string;
}

export const AuthModal = ({ onSignedIn }: { onSignedIn: (user: SessionUser) => void }) => {
    const location = useLocation();
    const navigate = useNavigate();
    const [submitState, setSubmitState] = useState<
        { status: "idle" } | { status: "loading" } | { status: "error"; message: string }
    >({ status: "idle" });
    const authMode = new URLSearchParams(location.search).get("auth") as AuthMode | null;
    const isSignUp = location.pathname === "/sign-up" || authMode === "sign-up";
    const opened = isSignUp || location.pathname === "/sign-in" || authMode === "sign-in";

    const close = () => {
        const routeState = location.state as { from?: string; resumeQueue?: boolean } | null;
        const isStandaloneAuthRoute =
            location.pathname === "/sign-in" || location.pathname === "/sign-up";
        navigate(
            routeState?.from ??
                (isStandaloneAuthRoute
                    ? "/"
                    : getAuthClosePath(location.pathname + location.search)),
            {
                state: routeState?.resumeQueue ? { resumeQueue: true } : null,
            },
        );
    };
    const switchMode = () => {
        const mode = isSignUp ? "sign-in" : "sign-up";
        const currentPath = location.pathname + location.search;
        navigate(
            currentPath === "/sign-in" || currentPath === "/sign-up"
                ? `/${mode}`
                : getAuthPath(currentPath, mode),
            { state: location.state },
        );
    };
    const submit = async (values: Values) => {
        setSubmitState({ status: "loading" });
        try {
            if (isSignUp && values.password !== values.confirm)
                throw new Error("Пароли не совпадают");
            const user = isSignUp
                ? await signUp(values.name ?? "", values.login, values.password)
                : await signIn(values.login, values.password);
            onSignedIn(user);
            close();
        } catch (reason) {
            setSubmitState({
                status: "error",
                message: reason instanceof Error ? reason.message : "Не удалось продолжить",
            });
        } finally {
            setSubmitState((state) => (state.status === "loading" ? { status: "idle" } : state));
        }
    };

    return (
        <Modal
            className={styles.modal}
            width={640}
            open={opened}
            onCancel={close}
            footer={null}
            destroyOnHidden
        >
            <div className={styles.content}>
                <h1 className={styles.title}>{isSignUp ? "Регистрация" : "Вход"}</h1>
                <Form<Values>
                    className={styles.form}
                    layout="vertical"
                    onFinish={submit}
                    requiredMark={false}
                >
                    {isSignUp && (
                        <Form.Item
                            name="name"
                            rules={[{ required: true, message: "Введите имя" }]}
                            noStyle
                        >
                            <Input
                                className={styles.field}
                                aria-label="Имя"
                                placeholder="Имя"
                                autoComplete="name"
                            />
                        </Form.Item>
                    )}
                    <Form.Item
                        name="login"
                        rules={[{ required: true, message: "Введите логин" }]}
                        noStyle
                    >
                        <Input
                            className={styles.field}
                            aria-label="Логин"
                            placeholder="Телефон или почта"
                            autoComplete="username"
                        />
                    </Form.Item>
                    <Form.Item
                        name="password"
                        rules={[{ required: true, min: 6, message: "Минимум 6 символов" }]}
                        noStyle
                    >
                        <Input.Password
                            className={styles.field}
                            aria-label="Пароль"
                            placeholder="Пароль"
                            autoComplete={isSignUp ? "new-password" : "current-password"}
                        />
                    </Form.Item>
                    {isSignUp && (
                        <Form.Item
                            name="confirm"
                            rules={[{ required: true, message: "Повторите пароль" }]}
                            noStyle
                        >
                            <Input.Password
                                className={styles.field}
                                aria-label="Повторите пароль"
                                placeholder="Повторите пароль"
                                autoComplete="new-password"
                            />
                        </Form.Item>
                    )}
                    {submitState.status === "error" && (
                        <Alert type="error" showIcon title={submitState.message} />
                    )}
                    <Button
                        className={styles.submit}
                        type="primary"
                        htmlType="submit"
                        loading={submitState.status === "loading"}
                    >
                        {isSignUp ? "Создать аккаунт" : "Войти"}
                    </Button>
                </Form>
            </div>
            <div className={styles.footer}>
                <p>{isSignUp ? "Уже есть аккаунт?" : "Нет аккаунта на Авито?"}</p>
                <Button className={styles.switch} onClick={switchMode}>
                    {isSignUp ? "Войти" : "Зарегистрироваться"}
                </Button>
                <p className={styles.legal}>
                    Продолжая, вы принимаете условия использования и политику конфиденциальности.
                </p>
            </div>
        </Modal>
    );
};
