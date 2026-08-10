package server

import (
	"context"
	"net/http"
	"testing"
	"time"
)

func TestRunAllStopsGroupWhenListenerFails(t *testing.T) {
	started := time.Now()

	err := RunAll(
		context.Background(),
		Endpoint{Address: "127.0.0.1:0", Handler: http.NewServeMux()},
		Endpoint{Address: "invalid-address", Handler: http.NewServeMux()},
	)

	if err == nil {
		t.Fatal("RunAll() error = nil, want listener error")
	}
	if elapsed := time.Since(started); elapsed > time.Second {
		t.Fatalf("RunAll() returned after %s, want sibling listener stopped promptly", elapsed)
	}
}
