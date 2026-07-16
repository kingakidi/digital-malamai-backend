#!/bin/sh
set -e

echo "=========================================="
echo "Starting Digital Malamai API Container"
echo "=========================================="

PORT=${PORT:-3001}
export PORT
API_PREFIX=${API_PREFIX:-api/v1}

echo "Port configured: $PORT"
echo "API prefix: $API_PREFIX"
echo ""
echo "Database configuration:"
echo "  Host: ${DB_HOST:-not set}"
echo "  Port: ${DB_PORT:-3306}"
echo "  Database: ${DB_DATABASE:-not set}"
echo "  User: ${DB_USERNAME:-not set}"
echo "  Password: ${DB_PASSWORD:+set (hidden)}"
echo ""

echo "Waiting for database connection..."
MAX_RETRIES=30
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
  if node -e "
    const mysql = require('mysql2/promise');

    const host = process.env.DB_HOST;
    const port = Number(process.env.DB_PORT || 3306);
    const user = process.env.DB_USERNAME;
    const password = process.env.DB_PASSWORD ?? '';
    const database = process.env.DB_DATABASE;

    if (!host || !user || !database) {
      console.error('Missing database configuration');
      process.exit(1);
    }

    mysql
      .createConnection({ host, port, user, password, database })
      .then((connection) => connection.end().then(() => {
        console.log('Database connection established');
        process.exit(0);
      }))
      .catch((err) => {
        console.error('Database connection error:', err.message);
        process.exit(1);
      });
  "; then
    break
  fi

  RETRY_COUNT=$((RETRY_COUNT + 1))
  if [ $RETRY_COUNT -lt $MAX_RETRIES ]; then
    echo "Waiting for database... (Attempt $RETRY_COUNT/$MAX_RETRIES)"
    sleep 2
  else
    echo "Failed to connect to database after $MAX_RETRIES attempts"
    exit 1
  fi
done

echo "Database is ready!"

# Default: run migrations in production. Set DB_MIGRATIONS_RUN=false to skip.
RUN_MIGRATIONS="${DB_MIGRATIONS_RUN:-}"
if [ -z "$RUN_MIGRATIONS" ]; then
  if [ "${NODE_ENV}" = "production" ]; then
    RUN_MIGRATIONS=true
  else
    RUN_MIGRATIONS=false
  fi
fi

if [ "$RUN_MIGRATIONS" = "true" ]; then
  echo "Running database migrations..."
  npm run migration:run:prod || {
    echo "Migration failed!"
    exit 1
  }
  echo "Migrations completed successfully!"
else
  echo "Skipping migrations (DB_MIGRATIONS_RUN=$RUN_MIGRATIONS)"
fi

echo "=========================================="
echo "Docker container built successfully!"
echo "Server starting on port $PORT"
echo "Health check: http://localhost:$PORT/$API_PREFIX/health"
echo "=========================================="
echo ""

exec node dist/main.js
