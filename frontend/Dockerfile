# Multi-stage build: compile the static bundle, then serve it with nginx.
# For local dev, keep using `npm run dev` directly (or docker-compose's old
# dev-server setup) — this image is for a real deployment.

FROM node:20-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf.template /etc/nginx/templates/default.conf.template

# nginx's official image auto-runs envsubst on everything in /etc/nginx/templates/
# at startup, writing the result into conf.d — this is how BACKEND_ORIGIN below
# gets baked in without a custom entrypoint script.
ENV BACKEND_ORIGIN=http://localhost:8000

EXPOSE 8080
