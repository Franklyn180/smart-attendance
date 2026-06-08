#!/bin/bash
set -e
echo "=== Linting Frontend ==="
cd frontend && npm run lint
echo "Frontend lint passed"

echo "=== Linting Backend ==="
cd ../backend && pip install ruff --break-system-packages -q
ruff check .
echo "Backend lint passed"

echo "=== Validating docker-compose.yml ==="
docker compose config --quiet
echo "docker-compose.yml is valid"

echo "All checks passed!"
