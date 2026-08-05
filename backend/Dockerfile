FROM golang:1.26.4-bookworm AS build

WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -o /out/api ./cmd/api
RUN CGO_ENABLED=0 go build -o /out/worker ./cmd/worker
RUN CGO_ENABLED=0 go build -o /out/migrate ./cmd/migrate

FROM gcr.io/distroless/static-debian12:nonroot

LABEL org.opencontainers.image.source="https://github.com/effect707/Team39-Hackathon-Avito"
COPY --from=build /out/api /api
COPY --from=build /out/worker /worker
COPY --from=build /out/migrate /migrate
USER nonroot:nonroot
ENTRYPOINT ["/api"]
