package httpapi

import (
	"net/http"

	"github.com/prometheus/client_golang/prometheus/promhttp"
)

func NewMetricsHandler() http.Handler {
	mux := http.NewServeMux()
	mux.Handle("GET /metrics", promhttp.Handler())
	return mux
}
