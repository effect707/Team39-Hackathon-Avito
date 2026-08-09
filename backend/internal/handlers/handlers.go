package handlers

import (
	"time"

	"github.com/team39/avito-fair-queue/backend/internal/allocation"
	"github.com/team39/avito-fair-queue/backend/internal/checkout"
	"github.com/team39/avito-fair-queue/backend/internal/events"
	"github.com/team39/avito-fair-queue/backend/internal/platform/database"
	"github.com/team39/avito-fair-queue/backend/internal/platform/httpapi"
	"github.com/team39/avito-fair-queue/backend/internal/products"
	"github.com/team39/avito-fair-queue/backend/internal/queue"
	"gorm.io/gorm"
)

type Deps struct {
	DB       *gorm.DB
	GrantTTL time.Duration
}

type Result struct {
	Router *httpapi.Router
	Hub    *events.Hub
}

func New(deps Deps) *Result {
	notifier := events.NewNotifier()
	hub := events.NewHub()

	productRepo := products.NewRepository(deps.DB)
	productService := products.NewService(productRepo)
	productHandler := products.NewHandler(productService)

	queueRepo := queue.NewRepository(deps.DB)
	allocationRepo := allocation.NewRepository(deps.DB)
	allocationService := allocation.NewService(deps.DB, allocationRepo, productRepo, queueRepo, notifier, deps.GrantTTL)
	queueService := queue.NewService(deps.DB, queueRepo, productRepo, allocationService, notifier)
	queueHandler := queue.NewHandler(queueService)

	checkoutRepo := checkout.NewRepository(deps.DB)
	checkoutService := checkout.NewService(deps.DB, checkoutRepo, queueRepo, productRepo, allocationService, notifier)
	checkoutHandler := checkout.NewHandler(checkoutService)

	eventsHandler := events.NewHandler(hub)

	router := httpapi.NewRouter(database.Checker{DB: deps.DB})
	router.Handle("GET /api/v1/products", productHandler.List)
	router.Handle("GET /api/v1/products/{product_id}", productHandler.Get)
	router.Handle("GET /api/v1/products/{product_id}/alternatives", productHandler.Alternatives)
	router.HandleAuth("POST /api/v1/products/{product_id}/queue/join", queueHandler.Join)
	router.HandleAuth("GET /api/v1/products/{product_id}/queue/me", queueHandler.GetMe)
	router.HandleAuth("DELETE /api/v1/products/{product_id}/queue/me", queueHandler.Leave)
	router.HandleAuth("GET /api/v1/products/{product_id}/queue/events", eventsHandler.Stream)
	router.HandleAuth("POST /api/v1/grants/{grant_id}/checkout", checkoutHandler.StartCheckout)
	router.HandleAuth("POST /api/v1/grants/{grant_id}/payment-result", checkoutHandler.SubmitPaymentResult)

	return &Result{Router: router, Hub: hub}
}
