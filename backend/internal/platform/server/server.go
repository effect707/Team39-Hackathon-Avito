package server

import (
	"context"
	"errors"
	"net/http"
	"time"
)

type Endpoint struct {
	Address string
	Handler http.Handler
}

func RunAll(ctx context.Context, endpoints ...Endpoint) error {
	if len(endpoints) == 0 {
		return nil
	}

	groupContext, cancel := context.WithCancel(ctx)
	defer cancel()
	errorsChannel := make(chan error, len(endpoints))
	for _, endpoint := range endpoints {
		go func() {
			errorsChannel <- Run(groupContext, endpoint.Address, endpoint.Handler)
		}()
	}

	var runErrors []error
	for range endpoints {
		if err := <-errorsChannel; err != nil {
			runErrors = append(runErrors, err)
		}
		cancel()
	}
	return errors.Join(runErrors...)
}

func Run(ctx context.Context, address string, handler http.Handler) error {
	server := &http.Server{Addr: address, Handler: handler, ReadHeaderTimeout: 5 * time.Second}
	errorsChannel := make(chan error, 1)
	go func() { errorsChannel <- server.ListenAndServe() }()
	select {
	case err := <-errorsChannel:
		if errors.Is(err, http.ErrServerClosed) {
			return nil
		}
		return err
	case <-ctx.Done():
		shutdownContext, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		return server.Shutdown(shutdownContext)
	}
}
