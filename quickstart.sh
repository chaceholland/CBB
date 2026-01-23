#!/bin/bash

##############################################################################
# CBB Pitcher Tracker - Quick Start Script
##############################################################################
# This script runs all initial setup steps in the correct order
#
# Usage: ./quickstart.sh
#
# Steps:
#   1. Fetch D1 baseball teams
#   2. Fetch current week schedule
#   3. Add any missing teams
#   4. Build pitcher participation index
#   5. Start the server
##############################################################################

set -e  # Exit on error

echo ""
echo "⚾ CBB Pitcher Tracker - Quick Start"
echo "===================================="
echo ""

# Check if we're in the right directory
if [ ! -f "schedule.html" ]; then
  echo "❌ Error: Please run this script from the CBB directory"
  echo "   cd ~/Desktop/CBB"
  echo "   ./quickstart.sh"
  exit 1
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
  echo "❌ Error: Node.js is not installed"
  echo "   Download from: https://nodejs.org/"
  exit 1
fi

echo "✓ Prerequisites check passed"
echo ""

# Step 0: Build conference map (optional but recommended)
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 0/5: Building Conference Map (Recommended)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "This maps teams to their 2025 conferences."
echo "Should only be run once during initial setup."
echo ""
read -p "Build conference map? [y/n] " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
  # First fetch teams without conferences
  if node espn-api-fetcher.cjs; then
    echo ""
    echo "✅ Teams fetched"
    
    # Then build conference map
    if node build-static-conference-map.cjs; then
      echo ""
      echo "✅ Conference map built"
    else
      echo ""
      echo "⚠️  Warning: Conference map failed (continuing anyway)"
    fi
  else
    echo ""
    echo "❌ Failed to fetch teams"
    exit 1
  fi
else
  echo "⚠️  Skipping conference map. Teams will show as 'Independent'."
fi

echo ""
read -p "Press Enter to continue to Step 1..."
echo ""

# Step 1: Fetch teams with conferences
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 1/5: Fetching D1 Baseball Teams with Conferences"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if node espn-api-fetcher.cjs; then
  echo ""
  echo "✅ Teams fetched successfully"
else
  echo ""
  echo "❌ Failed to fetch teams"
  exit 1
fi

echo ""
read -p "Press Enter to continue to Step 2..."
echo ""

# Step 2: Fetch schedule
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 2/5: Fetching Full Season Schedule"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

YEAR=$(date +%Y)

if node tools/fetch_schedule.js --year=$YEAR --weeks=all; then
  echo ""
  echo "✅ Schedule fetched successfully"
else
  echo ""
  echo "❌ Failed to fetch schedule"
  exit 1
fi

echo ""
read -p "Press Enter to continue to Step 3..."
echo ""

# Step 3: Fetch pitcher rosters
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 3/5: Fetching Pitcher Rosters"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Note: This fetches all pitcher rosters from team rosters."
echo "      This happens BEFORE games are played."
echo ""

if node fetch-pitcher-rosters.cjs; then
  echo ""
  echo "✅ Pitcher rosters fetched successfully"
else
  echo ""
  echo "⚠️  Warning: Pitcher roster fetch had errors (continuing anyway)"
fi

echo ""
read -p "Press Enter to continue to Step 4..."
echo ""

# Step 4: Add missing teams
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 4/5: Checking for Missing Teams"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if node fetch-missing-teams.cjs; then
  echo ""
  echo "✅ Missing teams check complete"
else
  echo ""
  echo "⚠️  Warning: Missing teams check had errors (continuing anyway)"
fi

echo ""
read -p "Press Enter to continue to Step 5..."
echo ""

# Step 5: Build pitcher index
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 5/5: Building Pitcher Participation Index"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Note: This only works for completed games."
echo "      If no games have been played yet, the index will be empty."
echo ""

if node rebuild_played_index.cjs; then
  echo ""
  echo "✅ Pitcher index built successfully"
else
  echo ""
  echo "⚠️  Warning: Pitcher index had errors (this is normal if no games have been played yet)"
fi

# Final summary
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎉 Setup Complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Your CBB Pitcher Tracker is now ready to use!"
echo ""
echo "Next steps:"
echo "  1. Start the server:"
echo "     node server.mjs"
echo ""
echo "  2. Open in your browser:"
echo "     http://localhost:8071"
echo ""
echo "  3. Daily updates:"
echo "     node tools/fetch_schedule.js --year=$YEAR --weeks=current"
echo "     node rebuild_played_index.cjs"
echo ""
echo "For more information, see SETUP_GUIDE.md"
echo ""

# Ask if user wants to start server now
read -p "Start the server now? [y/n] " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
  echo ""
  echo "🚀 Starting server..."
  echo "   Open http://localhost:8071 in your browser"
  echo "   Press Ctrl+C to stop the server"
  echo ""
  node server.mjs
fi
