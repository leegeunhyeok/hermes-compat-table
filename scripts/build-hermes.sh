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

# Identifier `hermes-<hex>` (≥7 hex chars) means "check out this commit SHA";
# anything else is treated as an annotated tag name.
if [[ "$TAG" =~ ^hermes-[0-9a-f]{7,40}$ ]]; then
  REF="${TAG#hermes-}"
else
  REF="refs/tags/$TAG"
fi
echo "==> Checking out $REF"
git -C "$SRC_DIR" checkout --detach "$REF"

echo "==> Configuring CMake -> $BUILD_DIR"
# CMake 4.x dropped OLD behavior for legacy policies (e.g. CMP0026) that older
# Hermes tags depend on; this flag puts CMake in 3.5-era compatibility mode.
CMAKE_FLAGS=(-DCMAKE_BUILD_TYPE=Release -DCMAKE_POLICY_VERSION_MINIMUM=3.5)
if command -v ninja >/dev/null 2>&1; then
  echo "    Using Ninja generator"
  cmake -S "$SRC_DIR" -B "$BUILD_DIR" -G Ninja "${CMAKE_FLAGS[@]}"
else
  echo "    Using default (Make) generator"
  cmake -S "$SRC_DIR" -B "$BUILD_DIR" "${CMAKE_FLAGS[@]}"
fi

JOBS="$(sysctl -n hw.ncpu 2>/dev/null || nproc 2>/dev/null || echo 4)"
echo "==> Building hermes, hermesc (-j$JOBS)"
cmake --build "$BUILD_DIR" --target hermes hermesc -j"$JOBS"

for name in hermes hermesc; do
  src="$BUILD_DIR/bin/$name"
  if [[ ! -x "$src" ]]; then
    echo "ERROR: $name binary not found at $src" >&2
    exit 1
  fi
  cp "$src" "$BIN_DIR/$name"
done

echo
echo "==> Build complete"
echo "    Binaries: $BIN_DIR/{hermes,hermesc}"
"$BIN_DIR/hermes" -version || true
