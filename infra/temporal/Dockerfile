# Temporal para Pronex en un solo contenedor (servidor de desarrollo de Temporal con
# estado persistente en SQLite). Adecuado para volúmenes pequeños y medianos; para
# escalar, reemplazar por Temporal Cloud cambiando TEMPORAL_ADDRESS en la API y el worker.
FROM debian:bookworm-slim

RUN apt-get update \
 && apt-get install -y --no-install-recommends curl ca-certificates \
 && curl -fsSL "https://temporal.download/cli/archive/latest?platform=linux&arch=amd64" -o /tmp/temporal.tar.gz \
 && tar -xzf /tmp/temporal.tar.gz -C /usr/local/bin temporal \
 && rm -rf /tmp/temporal.tar.gz /var/lib/apt/lists/* \
 && temporal --version

# /data debe ser un volumen persistente (en Railway: montar un volumen en /data).
ENV TEMPORAL_BIND_IP="::" \
    TEMPORAL_PORT="7233" \
    TEMPORAL_DB="/data/temporal.db"
EXPOSE 7233

CMD ["/bin/sh", "-c", "mkdir -p \"$(dirname \"$TEMPORAL_DB\")\" && exec temporal server start-dev --headless --ip \"$TEMPORAL_BIND_IP\" --port \"$TEMPORAL_PORT\" --db-filename \"$TEMPORAL_DB\" --log-level warn"]
