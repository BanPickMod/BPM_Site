#!/bin/bash
# Daily Postgres backup: pg_dump -> gzip -> a private R2 bucket. Meant for a Railway cron service (see Dockerfile).
# Old backups are removed by the bucket's lifecycle rule (30 days), not by this script.
#
# Variables:
#   DATABASE_URL           the database to save (use the private address: ${{Postgres.DATABASE_URL}})
#   S3_ENDPOINT            https://<account id>.r2.cloudflarestorage.com   (no bucket name)
#   S3_BUCKET              the backup bucket, not the one that holds replays
#   AWS_ACCESS_KEY_ID      R2 API token limited to that bucket (Object Read & Write)
#   AWS_SECRET_ACCESS_KEY
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL is required}"
: "${S3_ENDPOINT:?S3_ENDPOINT is required}"
: "${S3_BUCKET:?S3_BUCKET is required}"
: "${AWS_ACCESS_KEY_ID:?AWS_ACCESS_KEY_ID is required}"
: "${AWS_SECRET_ACCESS_KEY:?AWS_SECRET_ACCESS_KEY is required}"

export AWS_DEFAULT_REGION=auto
export AWS_EC2_METADATA_DISABLED=true
# R2 does not accept the newer default checksum headers of the AWS CLI.
export AWS_REQUEST_CHECKSUM_CALCULATION=when_required
export AWS_RESPONSE_CHECKSUM_VALIDATION=when_required

stamp=$(date -u +%Y%m%dT%H%M%SZ)
file="/tmp/bpm-${stamp}.sql.gz"
key="postgres/bpm-${stamp}.sql.gz"

echo "server: $(psql "$DATABASE_URL" -Atc 'show server_version' 2>/dev/null || echo unknown); client: $(pg_dump --version)"
pg_dump --no-owner --no-privileges "$DATABASE_URL" | gzip -9 > "$file"

size=$(wc -c < "$file")
if [ "$size" -lt 2048 ]; then
  echo "backup is only ${size} bytes: something is wrong, not uploading" >&2
  exit 1
fi
gzip -t "$file"

aws s3 cp "$file" "s3://${S3_BUCKET}/${key}" --endpoint-url "$S3_ENDPOINT" --only-show-errors
remote=$(aws s3api head-object --bucket "$S3_BUCKET" --key "$key" --endpoint-url "$S3_ENDPOINT" --query ContentLength --output text)
if [ "$remote" != "$size" ]; then
  echo "uploaded size ${remote} differs from ${size}" >&2
  exit 1
fi
rm -f "$file"
echo "ok: ${key} (${size} bytes)"
