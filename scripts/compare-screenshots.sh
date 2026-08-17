#!/bin/bash

# Screenshot Comparison Script
# Compares current screenshots with baseline

set -e

BASELINE_DIR="screenshots-baseline"
CURRENT_DIR="screenshots"
DIFF_DIR="screenshots/comparison"

echo "🔍 Screenshot Comparison Tool"
echo "=============================="

# Check if ImageMagick is installed
if ! command -v compare &> /dev/null; then
    echo "❌ ImageMagick not found. Installing..."
    if [[ "$OSTYPE" == "darwin"* ]]; then
        brew install imagemagick
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        sudo apt-get install -y imagemagick
    else
        echo "Please install ImageMagick manually"
        exit 1
    fi
fi

# Check if baseline exists
if [ ! -d "$BASELINE_DIR" ]; then
    echo "❌ No baseline found. Creating baseline from current screenshots..."
    mkdir -p "$BASELINE_DIR"
    cp -r "$CURRENT_DIR"/* "$BASELINE_DIR/"
    echo "✅ Baseline created. Run this script again after making changes."
    exit 0
fi

# Create diff directory
mkdir -p "$DIFF_DIR"

# Compare screenshots
echo ""
echo "📸 Comparing screenshots..."
echo ""

TOTAL=0
DIFFERENCES=0
IDENTICAL=0

for current_file in "$CURRENT_DIR"/*.png; do
    filename=$(basename "$current_file")
    baseline_file="$BASELINE_DIR/$filename"
    diff_file="$DIFF_DIR/diff-$filename"
    
    if [ ! -f "$baseline_file" ]; then
        echo "🆕 NEW: $filename"
        ((TOTAL++))
        continue
    fi
    
    # Compare images
    result=$(compare -metric AE "$baseline_file" "$current_file" "$diff_file" 2>&1 || true)
    diff_pixels=$(echo "$result" | grep -o '[0-9]*' || echo "0")
    
    ((TOTAL++))
    
    if [ "$diff_pixels" -eq 0 ]; then
        echo "✅ IDENTICAL: $filename"
        ((IDENTICAL++))
        rm -f "$diff_file"
    else
        echo "⚠️  DIFFERENT: $filename ($diff_pixels pixels changed)"
        ((DIFFERENCES++))
    fi
done

# Generate comparison report
echo ""
echo "📊 Generating comparison report..."

cat > "$DIFF_DIR/comparison-report.html" << EOF
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Screenshot Comparison Report</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            background: #0a0a0a;
            color: #ffffff;
            padding: 2rem;
        }
        .container { max-width: 1400px; margin: 0 auto; }
        h1 { font-size: 2rem; margin-bottom: 0.5rem; }
        .subtitle { color: #888; margin-bottom: 2rem; }
        .stats {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 1rem;
            margin-bottom: 2rem;
        }
        .stat {
            background: #1a1a1a;
            border: 1px solid #2a2a2a;
            border-radius: 8px;
            padding: 1.5rem;
            text-align: center;
        }
        .stat-value {
            font-size: 2.5rem;
            font-weight: 700;
            margin-bottom: 0.5rem;
        }
        .stat-value.success { color: #10b981; }
        .stat-value.warning { color: #f59e0b; }
        .stat-value.info { color: #3b82f6; }
        .stat-label { color: #888; font-size: 0.875rem; }
        .comparison-grid {
            display: grid;
            gap: 2rem;
        }
        .comparison-item {
            background: #1a1a1a;
            border: 1px solid #2a2a2a;
            border-radius: 8px;
            padding: 1.5rem;
        }
        .comparison-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 1rem;
            padding-bottom: 1rem;
            border-bottom: 1px solid #2a2a2a;
        }
        .comparison-title { font-weight: 600; }
        .badge {
            padding: 0.25rem 0.75rem;
            border-radius: 4px;
            font-size: 0.75rem;
            font-weight: 600;
        }
        .badge.different {
            background: #f59e0b;
            color: #000;
        }
        .badge.identical {
            background: #10b981;
            color: #000;
        }
        .image-row {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 1rem;
        }
        .image-col {
            text-align: center;
        }
        .image-col img {
            width: 100%;
            border-radius: 4px;
            border: 1px solid #2a2a2a;
        }
        .image-label {
            margin-top: 0.5rem;
            font-size: 0.75rem;
            color: #888;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Screenshot Comparison Report</h1>
        <p class="subtitle">Generated on $(date)</p>
        
        <div class="stats">
            <div class="stat">
                <div class="stat-value info">$TOTAL</div>
                <div class="stat-label">Total Screenshots</div>
            </div>
            <div class="stat">
                <div class="stat-value success">$IDENTICAL</div>
                <div class="stat-label">Identical</div>
            </div>
            <div class="stat">
                <div class="stat-value warning">$DIFFERENCES</div>
                <div class="stat-label">Differences Detected</div>
            </div>
        </div>
        
        <div class="comparison-grid">
EOF

# Add comparison items for different files
for diff_file in "$DIFF_DIR"/diff-*.png; do
    if [ -f "$diff_file" ]; then
        filename=$(basename "$diff_file" | sed 's/^diff-//')
        baseline="../baseline/$filename"
        current="../$filename"
        
        cat >> "$DIFF_DIR/comparison-report.html" << EOF
            <div class="comparison-item">
                <div class="comparison-header">
                    <div class="comparison-title">$filename</div>
                    <span class="badge different">DIFFERENT</span>
                </div>
                <div class="image-row">
                    <div class="image-col">
                        <img src="$baseline" alt="Baseline">
                        <div class="image-label">Baseline</div>
                    </div>
                    <div class="image-col">
                        <img src="$current" alt="Current">
                        <div class="image-label">Current</div>
                    </div>
                    <div class="image-col">
                        <img src="$(basename "$diff_file")" alt="Diff">
                        <div class="image-label">Difference</div>
                    </div>
                </div>
            </div>
EOF
    fi
done

cat >> "$DIFF_DIR/comparison-report.html" << EOF
        </div>
    </div>
</body>
</html>
EOF

echo "✅ Comparison report generated"
echo ""
echo "📊 Summary:"
echo "  Total: $TOTAL"
echo "  Identical: $IDENTICAL"
echo "  Different: $DIFFERENCES"
echo ""
echo "📄 View report: file://$(pwd)/$DIFF_DIR/comparison-report.html"

if [ "$DIFFERENCES" -gt 0 ]; then
    echo ""
    echo "⚠️  Visual differences detected!"
    exit 1
else
    echo ""
    echo "✅ All screenshots match the baseline"
    exit 0
fi
