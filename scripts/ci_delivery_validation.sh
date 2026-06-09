#!/bin/bash

# Configuration Parameters
TARGET_HOST=$1
TARGET_PORT="8000"
HEALTH_ENDPOINT="http://$TARGET_HOST:$TARGET_PORT/health"
MAX_ATTEMPTS=6
WAIT_INTERVAL_SECONDS=5

echo "Starting Post-Deployment Live Delivery Validation Loop..."
echo "Targeting Endpoint: $HEALTH_ENDPOINT"

for ((attempt=1; attempt<=MAX_ATTEMPTS; attempt++))
do
  echo " Verification Attempt $attempt of $MAX_ATTEMPTS..."
  
  # Execute curl request extracting only the HTTP status response code
  HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 3 "$HEALTH_ENDPOINT" || echo "000")
  
  if [ "$HTTP_STATUS" == "200" ]; then
    echo "Live Health Check Passed! Code: $HTTP_STATUS"
    echo "✅ Core Attendance Management Engine is stable and online."
    exit 0
  else
    echo "⚠️ Warning: Endpoint returned status $HTTP_STATUS. Server may still be initializing..."
    if [ $attempt -lt $MAX_ATTEMPTS ]; then
      echo "Sleeping for $WAIT_INTERVAL_SECONDS seconds before retrying..."
      sleep $WAIT_INTERVAL_SECONDS
    fi
  fi
done

echo "❌ Critical Error: Live health validation failed after $MAX_ATTEMPTS attempts."
echo "💥 Marking pipeline deployment phase as FAILED."
exit 1
