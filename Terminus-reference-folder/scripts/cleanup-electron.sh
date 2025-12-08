#!/bin/bash

# Cleanup script for Terminus Electron instances
# This script kills all running Electron and Node processes related to Terminus

echo "🧹 Cleaning up Terminus processes..."

# Kill Electron processes
if pgrep -f "Electron.*Terminus" > /dev/null; then
  echo "Found Electron processes, terminating..."
  pkill -TERM -f "Electron.*Terminus"
  sleep 2
  # Force kill if still running
  if pgrep -f "Electron.*Terminus" > /dev/null; then
    echo "Force killing remaining Electron processes..."
    pkill -KILL -f "Electron.*Terminus"
  fi
  echo "✅ Electron processes terminated"
else
  echo "ℹ️  No Electron processes found"
fi

# Kill Node processes running Terminus backend
if pgrep -f "node.*terminus.*starter" > /dev/null; then
  echo "Found backend processes, terminating..."
  pkill -TERM -f "node.*terminus.*starter"
  sleep 2
  # Force kill if still running
  if pgrep -f "node.*terminus.*starter" > /dev/null; then
    echo "Force killing remaining backend processes..."
    pkill -KILL -f "node.*terminus.*starter"
  fi
  echo "✅ Backend processes terminated"
else
  echo "ℹ️  No backend processes found"
fi

# Check if port 30003 is still in use
if lsof -ti:30003 > /dev/null 2>&1; then
  echo "⚠️  Port 30003 still in use, killing process..."
  lsof -ti:30003 | xargs kill -TERM
  sleep 1
  if lsof -ti:30003 > /dev/null 2>&1; then
    lsof -ti:30003 | xargs kill -KILL
  fi
  echo "✅ Port 30003 freed"
else
  echo "ℹ️  Port 30003 is free"
fi

echo "✨ Cleanup complete!"
