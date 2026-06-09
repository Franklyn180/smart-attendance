#!/bin/bash
set -e

TARGET_HOST=$1
SSH_USER=$2

echo "⚠️ Live health check failed or timed out!"
echo "Initiating target-side rollback protocols on host: $TARGET_HOST"

# Connect via the established tunnel to safely revert container states
ssh -o StrictHostKeyChecking=no "${SSH_USER}@${TARGET_HOST}" << 'EOF'
  cd /home/ubuntu/app
  
  echo "Reverting local repository files to last stable tag..."
  # Fetch tags and check out the previous stable release tag
  git fetch --tags
  LAST_STABLE_TAG=$(git describe --tags --abbrev=0 HEAD^ 2>/dev/null || echo "")
  
  if [ -z "$LAST_STABLE_TAG" ]; then
    echo "⚠️ No previous git tag found. Hard-resetting to last verified commit..."
    git reset --hard HEAD@{1}
  else
    echo "Reverting code to tag: $LAST_STABLE_TAG"
    git checkout $LAST_STABLE_TAG
  fi
  
  echo "⚡ Rebuilding and restarting containers from stable state..."
  docker compose up -d --build --remove-orphans
  
  echo "✅ Target-side container state successfully reverted."
EOF