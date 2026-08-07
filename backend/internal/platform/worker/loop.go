package worker

import (
	"context"
	"time"
)

func Run(ctx context.Context, interval time.Duration, work func(context.Context) error) error {
	ticker := time.NewTicker(interval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return nil
		case <-ticker.C:
			if err := work(ctx); err != nil {
				return err
			}
		}
	}
}
