# Étape de build : l'application est compilée ici, pas servie par un serveur
# de développement.
FROM node:24-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Étape d'exécution : fichiers statiques servis par nginx, en utilisateur non
# privilégié. Aucune source, aucune source map, aucun outil de build.
FROM nginx:1.29-alpine AS runtime

COPY docker/nginx.conf /etc/nginx/nginx.conf
COPY docker/security-headers.conf /etc/nginx/security-headers.conf
COPY docker/host-guard.conf /etc/nginx/host-guard.conf
COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh
COPY --from=build /app/dist /usr/share/nginx/html

# /tmp/nginx accueille le pid, les fichiers temporaires et la configuration
# rendue au démarrage ; la racine servie reste en lecture seule.
RUN chmod +x /usr/local/bin/entrypoint.sh \
    && mkdir -p /tmp/nginx \
    && chown -R nginx:nginx /tmp/nginx \
    && rm -f /etc/nginx/conf.d/default.conf

USER nginx
EXPOSE 5173

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
