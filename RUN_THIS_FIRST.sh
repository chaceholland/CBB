#!/bin/bash
# RUN_THIS_FIRST.sh - Quick setup and instructions

clear
cat << 'EOF'
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║      CBB PITCHER TRACKER - SETUP COMPLETE! 🎉               ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝

📋 WHAT'S NEW:

1. ✅ ALL D1 TEAMS SCRAPER
   → Scrapes ~300 D1 teams (not just SEC)
   → Run: ./1-scrape-all-d1-teams.sh
   
2. ✅ ESPN API CHECKER  
   → Test if ESPN has 2026 data yet
   → Run: ./2-check-espn-2026-data.sh
   
3. ✅ MLB IMPROVEMENTS SYNCED
   → CBB has all MLB Tracker features
   → Verified: ./6-verify-mlb-cbb-sync.sh

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🚀 QUICK START:

Option A: Just start CBB tracker
  $ ./3-start-cbb-server.sh
  → http://localhost:8073/schedule.html

Option B: Start ALL trackers (NFL, MLB, CBB)
  $ ./4-start-all-trackers.sh
  → NFL: http://localhost:8071/schedule.html
  → MLB: http://localhost:8072/schedule.html  
  → CBB: http://localhost:8073/schedule.html

Option C: Scrape fresh 2026 data
  $ ./1-scrape-all-d1-teams.sh
  → Choose: Rosters, Schedules, or Both
  → Filter by conference if needed (SEC, ACC, etc.)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📁 ALL SCRIPTS:

  1-scrape-all-d1-teams.sh     Fetch data from ALL D1 teams
  2-check-espn-2026-data.sh    Test ESPN API for 2026
  3-start-cbb-server.sh        Start CBB tracker only
  4-start-all-trackers.sh      Start NFL, MLB, CBB
  5-stop-all-trackers.sh       Stop all running trackers
  6-verify-mlb-cbb-sync.sh     Verify MLB/CBB sync

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📖 DETAILED GUIDE: TERMINAL_SCRIPTS_GUIDE.md

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎯 RECOMMENDED WORKFLOW FOR 2026 SEASON:

Step 1: Check ESPN API
  $ ./2-check-espn-2026-data.sh
  
Step 2a: If ESPN has data → Use existing scraper
  $ node scrape-2026-team-sites.cjs
  
Step 2b: If ESPN empty → Use ALL D1 scraper
  $ ./1-scrape-all-d1-teams.sh
  → Option 3 (Both rosters and schedules)
  → Or Option 4 (Filter to SEC only)

Step 3: Start tracker
  $ ./3-start-cbb-server.sh
  → Visit: http://localhost:8073/schedule.html

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

💡 KEY FACTS:

• CBB runs on port 8073 (separate from MLB 8072, NFL 8071)
• Team websites have 2026 data NOW (ESPN probably doesn't yet)
• All D1 scraper takes 30-60 mins for all ~300 teams
• You can filter by conference to speed things up
• CBB already has all MLB Tracker improvements ✅

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🛠️ TROUBLESHOOTING:

Port in use?
  $ ./5-stop-all-trackers.sh
  
Scripts won't run?
  $ chmod +x *.sh
  
No data showing?
  → Check data/ folder for JSON files
  → Re-run appropriate scraper

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Ready to go! 🚀

EOF

read -p "Press Enter to continue..."
