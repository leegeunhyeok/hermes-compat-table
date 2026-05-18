#!/usr/bin/env bash
set -euo pipefail

TAG="${1:-}"
if [[ -z "$TAG" ]]; then
  echo "Usage: $0 <tag>" >&2
  echo "Example: $0 hermes-v250829098.0.2" >&2
  exit 1
fi

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CACHE_DIR="$ROOT/.cache/hermes"
SRC_DIR="$CACHE_DIR/src"
BUILD_DIR="$CACHE_DIR/build/$TAG"
BIN_DIR="$ROOT/bin/$TAG"
HERMES_REPO="${HERMES_REPO:-https://github.com/facebook/hermes.git}"

mkdir -p "$CACHE_DIR" "$BIN_DIR"

if [[ ! -d "$SRC_DIR/.git" ]]; then
  echo "==> Cloning hermes -> $SRC_DIR"
  git clone --filter=blob:none "$HERMES_REPO" "$SRC_DIR"
fi

echo "==> Fetching tags"
git -C "$SRC_DIR" fetch --tags --force origin

echo "==> Checking out $TAG"
git -C "$SRC_DIR" checkout --detach "refs/tags/$TAG"

echo "==> Configuring CMake -> $BUILD_DIR"
if command -v ninja >/dev/null 2>&1; then
  echo "    Using Ninja generator"
  cmake -S "$SRC_DIR" -B "$BUILD_DIR" -G Ninja -DCMAKE_BUILD_TYPE=Release
else
  echo "    Using default (Make) generator"
  cmake -S "$SRC_DIR" -B "$BUILD_DIR" -DCMAKE_BUILD_TYPE=Release
fi

JOBS="$(sysctl -n hw.ncpu 2>/dev/null || nproc 2>/dev/null || echo 4)"
echo "==> Building hermesc (-j$JOBS)"
cmake --build "$BUILD_DIR" --target hermesc -j"$JOBS"

HERMESC_BIN="$BUILD_DIR/bin/hermesc"
if [[ ! -x "$HERMESC_BIN" ]]; then
  echo "ERROR: hermesc binary not found at $HERMESC_BIN" >&2
  exit 1
fi

cp "$HERMESC_BIN" "$BIN_DIR/hermesc"

echo
echo "==> Build complete"
echo "    Binary: $BIN_DIR/hermesc"
"$BIN_DIR/hermesc" -version || true
