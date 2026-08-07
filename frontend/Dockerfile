FROM node:22.14-alpine AS build

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

LABEL org.opencontainers.image.source="https://github.com/effect707/Team39-Hackathon-Avito"
