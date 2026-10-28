# Backup job for a Railway cron service (Root Directory: ops/backup).
# The client must be the same major version as the database or newer; change PG_MAJOR to match the Postgres service.
ARG PG_MAJOR=17
FROM postgres:${PG_MAJOR}-alpine
RUN apk add --no-cache aws-cli bash
COPY backup.sh /backup.sh
RUN chmod +x /backup.sh
ENTRYPOINT ["/backup.sh"]
