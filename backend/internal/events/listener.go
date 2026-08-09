package events

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"time"

	"github.com/jackc/pgx/v5"
)

type Listener struct {
	dsn     string
	hub     *Hub
	channel string
}

func NewListener(dsn string, hub *Hub) *Listener {
	return &Listener{dsn: dsn, hub: hub, channel: Channel}
}

func (l *Listener) Run(ctx context.Context) {
	for {
		if err := l.runOnce(ctx); err != nil {
			slog.Error("events listener interrupted", "error", err)
		}
		select {
		case <-ctx.Done():
			return
		case <-time.After(time.Second):
		}
	}
}

func (l *Listener) runOnce(ctx context.Context) error {
	conn, err := pgx.Connect(context.Background(), l.dsn)
	if err != nil {
		return fmt.Errorf("connect events listener: %w", err)
	}
	defer func() { _ = conn.Close(context.Background()) }()
	if _, err := conn.Exec(ctx, "LISTEN "+l.channel); err != nil {
		return fmt.Errorf("listen %s: %w", l.channel, err)
	}
	for {
		notification, err := conn.WaitForNotification(ctx)
		if err != nil {
			if ctx.Err() != nil {
				return nil
			}
			return fmt.Errorf("wait for notification: %w", err)
		}
		var event Event
		if err := json.Unmarshal([]byte(notification.Payload), &event); err != nil {
			slog.Error("events listener dropped malformed payload", "payload", notification.Payload)
			continue
		}
		l.hub.Publish(event)
	}
}
