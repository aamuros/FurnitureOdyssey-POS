#!/usr/bin/env bash
# Run Prisma migrations against the pilot (hosted Supabase) database.
# Requires .env.pilot to be filled in with hosted credentials.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

if [ ! -f "$PROJECT_DIR/.env.pilot" ]; then
  echo "Error: .env.pilot not found in project root."
  echo "Copy .env.pilot and fill in your hosted Supabase credentials first."
  exit 1
fi

echo "Running Prisma migrations against pilot database..."
cd "$PROJECT_DIR"
npx dotenv-cli -e .env.pilot -- npx prisma migrate deploy
npx dotenv-cli -e .env.pilot -- npx prisma generate
echo ""
echo "Migrations applied successfully."
echo "Run 'npm run pilot:seed' to seed the admin user and sample products."
