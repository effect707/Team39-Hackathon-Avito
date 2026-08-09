package queue

import (
	"fmt"
	"time"

	"github.com/team39/avito-fair-queue/backend/internal/state"
)

func messageFor(queueState *State) (string, string) {
	switch queueState.Status {
	case state.EntryJoining:
		return "Добавляем вас в очередь", "Дождаться ответа"
	case state.EntryWaiting:
		return fmt.Sprintf("Вы №%d в очереди", *queueState.Position), "Ждать обновления или выйти"
	case state.EntryGranted:
		ttl := "02:00"
		if queueState.Grant != nil {
			ttl = formatTTL(queueState.Grant.ExpiresAt)
		}
		return fmt.Sprintf("Товар зарезервирован за вами на %s", ttl), "Перейти к покупке"
	case state.EntryCheckoutPending:
		return "Ожидаем результат оплаты", "Дождаться результата"
	case state.EntryPurchased:
		return "Покупка подтверждена", "Открыть заказ"
	case state.EntryExpired:
		return "Время на покупку истекло", "Встать в конец очереди или открыть аналоги"
	case state.EntryPaymentFailed:
		return "Оплата не прошла, резерв освобождён", "Встать в конец очереди или открыть аналоги"
	case state.EntrySoldOut:
		return "Товар закончился", "Открыть похожие объявления"
	case state.EntryCancelled:
		return "Вы покинули очередь", "Вернуться к карточке"
	case state.EntryError:
		return "Не удалось обновить статус. Ваше место сохранено", "Переподключиться или обновить страницу"
	default:
		return "", ""
	}
}

func formatTTL(expiresAt time.Time) string {
	remaining := time.Until(expiresAt)
	if remaining < 0 {
		remaining = 0
	}
	return fmt.Sprintf("%02d:%02d", int(remaining.Minutes()), int(remaining.Seconds())%60)
}
