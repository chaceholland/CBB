#!/bin/bash
# Data Version Manager for CBB Tracker
# Swap between 2025 (testing) and 2026 (production) data

YEAR=$1
DATA_DIR="./data"

if [ "$YEAR" != "2025" ] && [ "$YEAR" != "2026" ]; then
  echo "❌ Usage: ./swap-data-year.sh [2025|2026]"
  echo ""
  echo "Examples:"
  echo "  ./swap-data-year.sh 2025  # Use 2025 data for testing"
  echo "  ./swap-data-year.sh 2026  # Use 2026 data when rosters are ready"
  exit 1
fi

echo "🔄 Switching to $YEAR data..."
echo ""

# Backup current active files
if [ -f "$DATA_DIR/pitchers.json" ]; then
  TIMESTAMP=$(date +%Y%m%d_%H%M%S)
  cp "$DATA_DIR/pitchers.json" "$DATA_DIR/pitchers_backup_$TIMESTAMP.json"
  echo "📦 Backed up current data to pitchers_backup_$TIMESTAMP.json"
fi

# Swap to requested year
if [ "$YEAR" = "2025" ]; then
  if [ -f "$DATA_DIR/pitchers_2025_testing.json" ]; then
    cp "$DATA_DIR/pitchers_2025_testing.json" "$DATA_DIR/pitchers.json"
    echo "✅ Activated 2025 testing data"
    echo "   (347 SEC pitchers for system testing)"
  else
    echo "❌ 2025 testing data not found"
    exit 1
  fi
else
  if [ -f "$DATA_DIR/pitchers_2026_production.json" ]; then
    cp "$DATA_DIR/pitchers_2026_production.json" "$DATA_DIR/pitchers.json"
    echo "✅ Activated 2026 production data"
  else
    echo "⚠️  2026 data not yet collected"
    echo "   Run: node scrape-2026-rosters.cjs"
    exit 1
  fi
fi

echo ""
echo "📊 Current active data:"
node -e "
const d = require('$DATA_DIR/pitchers.json');
const teams = Object.keys(d).length;
const pitchers = Object.values(d).reduce((s, t) => s + t.pitchers.length, 0);
console.log('   Teams: ' + teams);
console.log('   Pitchers: ' + pitchers);
"

echo ""
echo "🔄 Restart your server to see changes:"
echo "   npm start (or node server.mjs)"
