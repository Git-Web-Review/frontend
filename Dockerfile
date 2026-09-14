# Build stage: the app is compiled here, not served by a development server.
FROM node:24-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Runtime stage: static files served by nginx as an unprivileged user. No
# sources, no source maps, no build tooling.
FROM nginx:1.29-alpine AS runtime

COPY docker/nginx.conf /etc/nginx/nginx.conf
COPY docker/security-headers.conf /etc/nginx/security-headers.conf
COPY docker/host-guard.conf /etc/nginx/host-guard.conf
COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh
COPY --from=build /app/dist /usr/share/nginx/html

# /tmp/nginx holds the pid, temporary files and the configuration rendered at
# start-up; the served root stays read-only.
RUN chmod +x /usr/local/bin/entrypoint.sh \
    && mkdir -p /tmp/nginx \
    && chown -R nginx:nginx /tmp/nginx \
    && rm -f /etc/nginx/conf.d/default.conf

USER nginx
EXPOSE 5173

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
