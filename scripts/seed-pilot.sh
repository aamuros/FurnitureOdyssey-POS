#!/usr/bin/env bash
# Seed the pilot (hosted Supabase) database with the admin user and sample products.
# Requires .env.pilot to be filled in with hosted credentials.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

if [ ! -f "$PROJECT_DIR/.env.pilot" ]; then
  echo "Error: .env.pilot not found in project root."
  echo "Copy .env.pilot and fill in your hosted Supabase credentials first."
  exit 1
fi

echo "Seeding pilot database (admin user + sample products)..."
cd "$PROJECT_DIR"
npx dotenv-cli -e .env.pilot -- npx tsx prisma/seed.ts
echo ""
echo "Seed completed."
echo "You can now log in at your Vercel URL with the admin credentials from .env.pilot."
