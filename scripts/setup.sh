#!/bin/bash
#
# SVG Preview Setup Script
# Validates and packages the extension, then installs it to supported editors.
#
# USAGE:
#   ./scripts/setup.sh
#

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

if ! command -v node &> /dev/null; then
    echo "Error: node is required but not installed."
    exit 1
fi

if ! command -v npm &> /dev/null; then
    echo "Error: npm is required but not installed."
    exit 1
fi

if ! command -v vsce &> /dev/null; then
    echo "Error: vsce is required but not installed."
    echo "Install via: npm install --global @vscode/vsce"
    exit 1
fi

echo "=== SVG Preview Setup ==="
echo ""

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo "Checking extension..."
npm test
echo -e "${GREEN}✓ Checks passed${NC}"
echo ""

NAME=$(node -p "require('./package.json').name")
VERSION=$(node -p "require('./package.json').version")
VSIX_FILE="${NAME}-${VERSION}.vsix"

echo "Packaging extension..."
rm -f "${NAME}-"*.vsix
npm run package
if [ ! -f "$VSIX_FILE" ]; then
    echo -e "${RED}Error: No VSIX file found: $VSIX_FILE${NC}"
    exit 1
fi
echo -e "${GREEN}✓ VSIX package built${NC}"
echo ""

echo "Installing extension to editors..."
EDITORS=("code" "code-insiders" "codium" "kiro" "antigravity" "cursor" "windsurf")
INSTALLED=0

for editor in "${EDITORS[@]}"; do
    if command -v "$editor" &> /dev/null; then
        echo -n "  $editor: "
        if output=$("$editor" --install-extension "$VSIX_FILE" --force 2>&1); then
            echo -e "${GREEN}✓${NC}"
            INSTALLED=$((INSTALLED + 1))
        else
            echo -e "${YELLOW}failed${NC}"
            echo "    $output"
        fi
    else
        echo -e "  $editor: ${YELLOW}not found${NC}"
    fi
done

if [ $INSTALLED -eq 0 ]; then
    echo -e "${RED}Error: Extension was not installed to any editor${NC}"
    exit 1
fi

echo ""
echo "=== Setup Complete ==="
echo "Extension: $VSIX_FILE ($INSTALLED editor(s))"
