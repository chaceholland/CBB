#!/bin/bash
# 1-scrape-all-d1-teams.sh
# Scrape rosters and schedules from ALL D1 College Baseball teams

cd /Users/chace/Desktop/CBB

echo "🏈 All D1 College Baseball Team Scraper"
echo "========================================"
echo ""
echo "This will scrape rosters and schedules from athletic websites"
echo "for all ~300 D1 baseball teams. This may take 30-60 minutes."
echo ""
echo "Options:"
echo "  1) Scrape ROSTERS only (recommended to start)"
echo "  2) Scrape SCHEDULES only"
echo "  3) Scrape BOTH rosters and schedules"
echo "  4) Scrape specific conference (e.g., SEC, ACC, Big 12)"
echo "  5) Cancel"
echo ""
read -p "Choose option (1-5): " choice

case $choice in
  1)
    echo ""
    echo "📋 Scraping rosters from all D1 teams..."
    node scrape-all-d1-teams.cjs --rosters
    ;;
  2)
    echo ""
    echo "📅 Scraping schedules from all D1 teams..."
    node scrape-all-d1-teams.cjs --schedules
    ;;
  3)
    echo ""
    echo "📋📅 Scraping rosters AND schedules from all D1 teams..."
    node scrape-all-d1-teams.cjs --rosters --schedules
    ;;
  4)
    echo ""
    read -p "Enter conference name (e.g., SEC, ACC, Big 12): " conf
    echo ""
    echo "📋📅 Scraping $conf teams..."
    node scrape-all-d1-teams.cjs --rosters --schedules --conference="$conf"
    ;;
  5)
    echo "Cancelled."
    exit 0
    ;;
  *)
    echo "Invalid option"
    exit 1
    ;;
esac

echo ""
echo "✅ Done! Check data/ folder for results:"
echo "   - all_d1_rosters_2026.json"
echo "   - all_d1_pitchers_2026.json"
echo "   - all_d1_schedules_2026.json"
