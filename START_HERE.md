# 🎯 CBB Pitcher Tracker - START HERE

## ☁️ LIVE SITE (Recommended)

**Just visit:** https://cbb-pitcher-tracker.vercel.app

No setup required! Your favorites and watch history sync automatically via Supabase cloud storage.

---

## 🚀 Quick Reference

### Update Data & Deploy
```bash
cd ~/Desktop/CBB

# Update participation data
node fetch_all_pitcher_participation.cjs
node strip_unused_stats.cjs

# Deploy to cloud
./deploy.sh
```

### Single Week Update + Deploy
```bash
cd ~/Desktop/CBB
node fetch_all_pitcher_participation.cjs --week=1
node strip_unused_stats.cjs
./deploy.sh
```

### Create Backup
```bash
cd ~/Desktop/CBB
mkdir -p backups
tar -czf "backups/cbb_backup_$(date +%Y%m%d_%H%M%S).tar.gz" data/
```

---

## ☁️ Cloud Architecture

| Component | Location | Purpose |
|-----------|----------|---------|
| **Frontend** | Vercel | schedule.html, static assets |
| **User Data** | Supabase | Favorites, priorities, watch history |
| **Static Data** | Vercel | Schedule, pitchers, participation |

### URLs
- **Live Site:** https://cbb-pitcher-tracker.vercel.app
- **Dashboard:** https://vercel.com (deployment management)
- **Database:** https://supabase.com (data management)

---

## 📊 Data Update Workflow

### During Season (Daily/Weekly)

1. **Fetch new participation data:**
   ```bash
   cd ~/Desktop/CBB
   node fetch_all_pitcher_participation.cjs
   node strip_unused_stats.cjs
   ```

2. **Deploy to cloud:**
   ```bash
   ./deploy.sh
   ```

3. **Verify deployment:**
   - Visit https://cbb-pitcher-tracker.vercel.app
   - Hard refresh: `Cmd+Shift+R`

### Migrate Local Data to Cloud
```bash
cd ~/Desktop/CBB
node migrate_to_supabase.mjs
```

---

## 🔧 Local Development (Optional)

Only needed if you're making code changes:

```bash
cd ~/Desktop/CBB
node server.mjs   # Starts on http://localhost:8071
```

---

## 📁 Project Structure

```
CBB/
├── schedule.html              # Main tracker UI
├── deploy.sh                  # Vercel deployment script ⭐
├── migrate_to_supabase.mjs    # Data migration script
├── fetch_all_pitcher_participation.cjs  # Fetch participation
├── strip_unused_stats.cjs     # Optimize data size
├── vercel.json                # Vercel config
├── data/                      # JSON data files
│   ├── teams.json
│   ├── pitchers.json
│   ├── schedule.json
│   └── pitchers_played_index.json
└── tools/                     # Utility scripts
```

---

## 🐛 Troubleshooting

### Data not updating on live site?
1. Run `./deploy.sh` to push changes
2. Hard refresh browser: `Cmd+Shift+R`
3. Check Vercel deployment: `npx vercel ls`

### Favorites not saving?
- Supabase stores all user data
- Re-migrate if needed: `node migrate_to_supabase.mjs`

### Deployment failing?
- Check file sizes (Vercel has 100MB limit)
- deploy.sh automatically excludes large files

---

## 🔗 Related Projects

- [MLB Pitcher Tracker](https://mlb-pitcher-tracker.vercel.app)
- [CFB QB Tracker](https://cfb-qb-tracker.vercel.app)

---

**Status:** ✅ Cloud Deployed
**Last Updated:** December 2025
