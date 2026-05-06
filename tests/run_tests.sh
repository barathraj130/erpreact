#!/bin/bash
# =============================================================
# ERP Selenium Test Runner
# Usage:
#   ./tests/run_tests.sh             → run ALL tests
#   ./tests/run_tests.sh --api       → API smoke tests only
#   ./tests/run_tests.sh --ui        → UI/browser tests only
#   ./tests/run_tests.sh --smoke     → quick sanity tests
#   ./tests/run_tests.sh --module auth   → specific module
# =============================================================

set -e

VENV="tests/venv"
PYTHON="$VENV/bin/python"
PYTEST="$VENV/bin/pytest"

echo ""
echo "══════════════════════════════════════════════════════"
echo "  ERP System — Selenium Test Suite"
echo "══════════════════════════════════════════════════════"

# ── Ensure venv is ready ──────────────────────────────────
if [ ! -f "$PYTEST" ]; then
    echo "⚙️  Installing test dependencies..."
    python3 -m venv "$VENV"
    "$VENV/bin/pip" install selenium webdriver-manager pytest pytest-html requests --quiet
    echo "✅ Dependencies installed."
fi

# ── Create output dirs ────────────────────────────────────
mkdir -p tests/reports tests/screenshots

# ── Parse arguments ───────────────────────────────────────
PYTEST_ARGS=("-v" "--tb=short" "--html=tests/reports/report.html" "--self-contained-html" "-p" "no:warnings")

case "$1" in
    --api)
        PYTEST_ARGS+=("-m" "api")
        echo "🔌 Running: API Smoke Tests"
        ;;
    --ui)
        PYTEST_ARGS+=("-m" "not api")
        echo "🌐 Running: UI / Browser Tests"
        ;;
    --smoke)
        PYTEST_ARGS+=("-m" "smoke")
        echo "💨 Running: Smoke Tests"
        ;;
    --module)
        PYTEST_ARGS+=("-m" "$2")
        echo "🎯 Running: Module [$2] Tests"
        ;;
    *)
        echo "🚀 Running: ALL Tests"
        ;;
esac

echo "──────────────────────────────────────────────────────"
echo "📋 Prerequisites:"
echo "   • Backend running:  cd backend && node server.js"
echo "   • Frontend running: cd frontend && npm run dev"
echo "   • Chrome browser installed"
echo "──────────────────────────────────────────────────────"
echo ""

# ── Run tests ─────────────────────────────────────────────
"$PYTEST" "${PYTEST_ARGS[@]}" 2>&1 | tee tests/reports/test_run.log

EXIT_CODE=${PIPESTATUS[0]}

echo ""
echo "══════════════════════════════════════════════════════"
if [ $EXIT_CODE -eq 0 ]; then
    echo "  ✅ ALL TESTS PASSED"
else
    echo "  ❌ SOME TESTS FAILED (exit code: $EXIT_CODE)"
fi
echo "  📄 HTML Report: tests/reports/report.html"
echo "  📸 Screenshots: tests/screenshots/"
echo "  📝 Log file:    tests/reports/test_run.log"
echo "══════════════════════════════════════════════════════"
echo ""

exit $EXIT_CODE
