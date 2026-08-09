import { Button, Result } from "antd";

export const ErrorState = ({ onRetry }: { onRetry?: () => void }) => (
    <Result
        status="warning"
        title="Не удалось загрузить данные"
        subTitle="Проверьте подключение и попробуйте ещё раз"
        extra={
            onRetry && (
                <Button type="primary" onClick={onRetry}>
                    Повторить
                </Button>
            )
        }
    />
);
