package worker

import (
	"context"
	"testing"
	"time"
)

func TestRunStopsWhenContextIsCancelled(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	calls := make(chan struct{}, 1)

	err := Run(ctx, time.Millisecond, func(context.Context) error {
		calls <- struct{}{}
		cancel()
		return nil
	})
	if err != nil {
		t.Fatalf("Run() error = %v", err)
	}
	select {
	case <-calls:
	case <-time.After(time.Second):
		t.Fatal("worker callback was not invoked")
	}
}
