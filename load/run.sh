#!/usr/bin/env bash
# roda o k6 em Docker contra a API já de pé; relatório HTML em load/results/
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p results
docker run --rm --network host -u "$(id -u):$(id -g)" \
    -v "$PWD:/load" \
    -e K6_API_URL="${K6_API_URL:-http://localhost:8081}" \
    -e K6_PEAK="${K6_PEAK:-1000}" \
    -e K6_WEB_DASHBOARD=true \
    -e K6_WEB_DASHBOARD_EXPORT="/load/results/report-${K6_PEAK:-1000}.html" \
    grafana/k6:2.4.0 run --summary-export="/load/results/summary-${K6_PEAK:-1000}.json" /load/kjfleets.js "$@"
