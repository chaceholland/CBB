#!/bin/bash
# Create simple icon placeholders

# Create a simple SVG baseball icon
cat > baseball.svg << 'EOF'
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <circle cx="64" cy="64" r="60" fill="#ffffff" stroke="#10b981" stroke-width="4"/>
  <path d="M 20,64 Q 30,50 40,64 T 60,64" stroke="#10b981" stroke-width="2" fill="none"/>
  <path d="M 68,64 Q 78,50 88,64 T 108,64" stroke="#10b981" stroke-width="2" fill="none"/>
  <path d="M 40,35 Q 50,45 60,35" stroke="#10b981" stroke-width="2" fill="none"/>
  <path d="M 68,93 Q 78,83 88,93" stroke="#10b981" stroke-width="2" fill="none"/>
  <circle cx="64" cy="64" r="6" fill="#10b981"/>
</svg>
EOF

# Convert SVG to PNG using macOS built-in tools
# For 16x16
qlmanage -t -s 16 -o . baseball.svg 2>/dev/null
mv baseball.svg.png icon16.png 2>/dev/null || echo "⚠️  Could not create icon16.png - manual creation needed"

# For 48x48
qlmanage -t -s 48 -o . baseball.svg 2>/dev/null
mv baseball.svg.png icon48.png 2>/dev/null || echo "⚠️  Could not create icon48.png - manual creation needed"

# For 128x128
qlmanage -t -s 128 -o . baseball.svg 2>/dev/null
mv baseball.svg.png icon128.png 2>/dev/null || echo "⚠️  Could not create icon128.png - manual creation needed"

# If qlmanage didn't work, use a simpler approach with base64 data URLs
if [ ! -f icon16.png ]; then
  echo "Creating simple placeholder icons..."

  # Create minimal 1x1 pixel placeholder (Chrome will scale it)
  echo "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAAdgAAAHYBTnsmCAAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAAA5SURBVDiNY2AYBaNgFIyCYQAY/zMwMDAwMDAwMDL8Z2D4z8DI8J+hgYHh/39GBoaGBgaG//8ZGBhGAQAZlgQBbiDlVQAAAABJRU5ErkJggg==" | base64 -d > icon16.png
  cp icon16.png icon48.png
  cp icon16.png icon128.png
fi

rm baseball.svg 2>/dev/null

echo "✓ Icon files created (or placeholders generated)"
echo ""
echo "Note: The icons are simple placeholders."
echo "For better icons, you can:"
echo "1. Use the extension as-is (icons work but are simple)"
echo "2. Replace icon*.png files with better baseball icons later"
