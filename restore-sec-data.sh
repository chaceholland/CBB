#!/bin/bash
# Restore SEC Data - Safe scraper that preserves existing data

cd "$(dirname "$0")"

echo "🏈 College Baseball Pitcher Tracker - SEC Data Restore"
echo "====================================================="
echo ""
echo "This will re-scrape SEC pitchers and restore your data."
echo "The scraper is safe and will:"
echo "  ✅ Create a backup before making changes"
echo "  ✅ Merge with any existing data (won't overwrite)"
echo "  ✅ Save progress every 5 teams"
echo ""
echo "Estimated time: 20-30 minutes for 14-16 SEC teams"
echo ""
read -p "Press ENTER to start or Ctrl+C to cancel..."
echo ""

node scrape-conferences-safe.cjs SEC

echo ""
echo "✅ SEC data restore complete!"
echo ""
echo "Next steps:"
echo "  1. Check your server at http://localhost:8073"
echo "  2. Once verified, add other conferences:"
echo "     node scrape-conferences-safe.cjs ACC"
echo "     node scrape-conferences-safe.cjs \"Big 12\""
echo "     node scrape-conferences-safe.cjs \"Big Ten\""
echo ""
