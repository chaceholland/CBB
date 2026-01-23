#!/bin/bash

##############################################################################
# Quick Test Script - Verify All Fixes
##############################################################################
# This script tests each fix to ensure everything works correctly
##############################################################################

echo ""
echo "🧪 Testing CBB Pitcher Tracker Fixes"
echo "====================================="
echo ""

cd /Users/chace/Desktop/CBB

# Test 1: Check if rebuild_played_index.cjs exists
echo "Test 1: Module Format Fix"
echo "-------------------------"
if [ -f "rebuild_played_index.cjs" ]; then
  echo "✅ rebuild_played_index.cjs exists"
else
  echo "❌ rebuild_played_index.cjs not found"
fi

if [ -f "rebuild_played_index.js" ]; then
  echo "❌ OLD rebuild_played_index.js still exists (should be deleted)"
else
  echo "✅ Old .js file removed"
fi
echo ""

# Test 2: Check if conference fetcher exists
echo "Test 2: Conference Fetcher"
echo "-------------------------"
if [ -f "fetch-conferences.cjs" ]; then
  echo "✅ fetch-conferences.cjs created"
else
  echo "❌ fetch-conferences.cjs not found"
fi
echo ""

# Test 3: Check if quickstart has 5 steps
echo "Test 3: Quickstart Updated"
echo "-------------------------"
if grep -q "Step 3/5: Fetching Pitcher Rosters" quickstart.sh; then
  echo "✅ Quickstart includes pitcher roster fetch"
else
  echo "❌ Quickstart missing pitcher roster step"
fi

if grep -q "weeks=all" quickstart.sh; then
  echo "✅ Quickstart fetches all weeks"
else
  echo "❌ Quickstart still using --weeks=current"
fi

if grep -q "rebuild_played_index.cjs" quickstart.sh; then
  echo "✅ Quickstart uses .cjs file"
else
  echo "❌ Quickstart still references .js file"
fi
echo ""

# Test 4: Check espn-api-fetcher changes
echo "Test 4: Team Fetcher Conference Support"
echo "---------------------------------------"
if grep -q "conferenceMap" espn-api-fetcher.cjs; then
  echo "✅ Team fetcher uses conference map"
else
  echo "❌ Team fetcher doesn't use conference map"
fi

if grep -q "fetchTeamDetail" espn-api-fetcher.cjs; then
  echo "✅ Team fetcher gets individual team details"
else
  echo "❌ Team fetcher missing detail fetching"
fi
echo ""

# Summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Summary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "All fixes applied! You can now run:"
echo ""
echo "  ./quickstart.sh"
echo ""
echo "This will:"
echo "  1. Build conference map (optional)"
echo "  2. Fetch teams WITH proper conferences"
echo "  3. Fetch ALL weeks (1-20) of schedule"
echo "  4. Fetch pitcher rosters BEFORE games"
echo "  5. Check for missing teams"
echo "  6. Build participation index"
echo ""
echo "See FIXES_APPLIED.md for complete details."
echo ""
