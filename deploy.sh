#!/bin/bash
# CBB Pitcher Tracker - Deploy to Vercel
# This script safely deploys to Vercel by temporarily moving large files

set -e

cd "$(dirname "$0")"
CBB_DIR="$(pwd)"
BACKUP_DIR="$CBB_DIR/.deploy_temp"

echo "🚀 CBB Pitcher Tracker - Deploy to Vercel"
echo "=========================================="

# Create temp backup directory
mkdir -p "$BACKUP_DIR"

echo ""
echo "📦 Step 1: Moving large files to temp storage..."

# Move large JSON backup files
for file in data/pitchers_played_index\ 3.json \
            data/pitchers_played_index_detailed.json \
            data/pitchers_played_index_full.json \
            data/pitchers_backup.json \
            data/rosters_2026_enhanced.json; do
    if [ -f "$file" ]; then
        mv "$file" "$BACKUP_DIR/" 2>/dev/null && echo "  ✓ Moved: $file"
    fi
done

# Move weekly files
for f in data/schedule_week_*.json; do
    if [ -f "$f" ]; then
        mv "$f" "$BACKUP_DIR/" 2>/dev/null
    fi
done
echo "  ✓ Moved weekly schedule files"

# Move pitcher-index directory if it exists
if [ -d "pitcher-index" ]; then
    mv pitcher-index "$BACKUP_DIR/"
    echo "  ✓ Moved: pitcher-index/"
fi

# Move node_modules (not needed for static deploy)
if [ -d "node_modules" ]; then
    mv node_modules "$BACKUP_DIR/"
    echo "  ✓ Moved: node_modules/"
fi

# Move debug HTML files
for f in debug_*.html; do
    if [ -f "$f" ]; then
        mv "$f" "$BACKUP_DIR/" 2>/dev/null
    fi
done
echo "  ✓ Moved debug HTML files"

# Move backup pitcher files
for f in pitchers-*.bak.json; do
    if [ -f "$f" ]; then
        mv "$f" "$BACKUP_DIR/" 2>/dev/null
    fi
done
echo "  ✓ Moved backup files"

echo ""
echo "📊 Current deployment size:"
du -sh .

echo ""
echo "🌐 Step 2: Deploying to Vercel..."
npx vercel --prod --yes

DEPLOY_EXIT=$?

echo ""
echo "📥 Step 3: Restoring large files..."

# Restore node_modules
if [ -d "$BACKUP_DIR/node_modules" ]; then
    mv "$BACKUP_DIR/node_modules" ./
    echo "  ✓ Restored: node_modules/"
fi

# Restore pitcher-index
if [ -d "$BACKUP_DIR/pitcher-index" ]; then
    mv "$BACKUP_DIR/pitcher-index" ./
    echo "  ✓ Restored: pitcher-index/"
fi

# Restore debug HTML files
for f in "$BACKUP_DIR"/debug_*.html; do
    if [ -f "$f" ]; then
        mv "$f" ./ 2>/dev/null
    fi
done
echo "  ✓ Restored debug files"

# Restore backup files
for f in "$BACKUP_DIR"/pitchers-*.bak.json; do
    if [ -f "$f" ]; then
        mv "$f" ./ 2>/dev/null
    fi
done
echo "  ✓ Restored backup files"

# Restore data files
for f in "$BACKUP_DIR"/*.json; do
    if [ -f "$f" ]; then
        filename=$(basename "$f")
        mv "$f" "data/$filename" 2>/dev/null
    fi
done
echo "  ✓ Restored data files"

# Clean up
rmdir "$BACKUP_DIR" 2>/dev/null || true

echo ""
if [ $DEPLOY_EXIT -eq 0 ]; then
    echo "✅ Deployment complete!"
    echo ""
    echo "🌍 Live site: https://cbb-pitcher-tracker.vercel.app"
    echo "📋 Roster:    https://cbb-pitcher-tracker.vercel.app/roster.html"
else
    echo "❌ Deployment failed with exit code $DEPLOY_EXIT"
    exit $DEPLOY_EXIT
fi
