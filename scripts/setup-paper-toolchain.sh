#!/bin/sh
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
TOOLCHAIN_DIR="$ROOT_DIR/.cache/paper-toolchain"
DOWNLOAD_DIR="$TOOLCHAIN_DIR/downloads"
BIN_DIR="$TOOLCHAIN_DIR/bin"
TEXLIVE_DIR="$TOOLCHAIN_DIR/texlive/2026"
PANDOC_ARCHIVE="$DOWNLOAD_DIR/pandoc-3.10.2-arm64-macOS.zip"
TECTONIC_ARCHIVE="$DOWNLOAD_DIR/tectonic-0.17.0-aarch64-apple-darwin.tar.gz"
INSTALL_TL_ARCHIVE="$DOWNLOAD_DIR/install-tl-unx.tar.gz"

if [ "$(uname -s)" != "Darwin" ] || [ "$(uname -m)" != "arm64" ]; then
  echo "This local installer is locked to native Apple Silicon macOS." >&2
  exit 1
fi

mkdir -p "$DOWNLOAD_DIR" "$BIN_DIR" "$TEXLIVE_DIR"

download() {
  url=$1
  destination=$2
  if [ -s "$destination" ]; then
    return
  fi
  partial="$destination.part"
  curl --http1.1 --fail --location --retry 12 --retry-all-errors --connect-timeout 30 --continue-at - \
    --speed-limit 1024 --speed-time 60 \
    --header "Accept: application/octet-stream" \
    --header "X-GitHub-Api-Version: 2022-11-28" \
    --header "User-Agent: Pyuyi-paper-toolchain" \
    --output "$partial" "$url"
  mv "$partial" "$destination"
}

download_verified() {
  url=$1
  destination=$2
  expected=$3
  if [ -s "$destination" ]; then
    actual=$(shasum -a 256 "$destination" | awk '{print $1}')
    if [ "$actual" = "$expected" ]; then
      return
    fi
    echo "Replacing incomplete or invalid download: $destination"
  fi
  partial="$destination.part"
  curl --http1.1 --fail --location --retry 8 --retry-all-errors --connect-timeout 30 --output "$partial" "$url"
  actual=$(shasum -a 256 "$partial" | awk '{print $1}')
  if [ "$actual" != "$expected" ]; then
    echo "Checksum mismatch for $partial" >&2
    exit 1
  fi
  mv "$partial" "$destination"
}

verify_sha256() {
  file=$1
  expected=$2
  actual=$(shasum -a 256 "$file" | awk '{print $1}')
  if [ "$actual" != "$expected" ]; then
    echo "Checksum mismatch for $file" >&2
    exit 1
  fi
}

download_verified \
  "https://api.github.com/repos/jgm/pandoc/releases/assets/511955145" \
  "$PANDOC_ARCHIVE" \
  "a30bd546062f0b29c25f45a71f951b7a1cf4f998d5b43974ea2c2416133f2e99"
verify_sha256 "$PANDOC_ARCHIVE" "a30bd546062f0b29c25f45a71f951b7a1cf4f998d5b43974ea2c2416133f2e99"

download_verified \
  "https://api.github.com/repos/tectonic-typesetting/tectonic/releases/assets/490851834" \
  "$TECTONIC_ARCHIVE" \
  "a3f1cac7c5678f01661a92212f58480ae3b0634115d880dbc59e2953ded45667"
verify_sha256 "$TECTONIC_ARCHIVE" "a3f1cac7c5678f01661a92212f58480ae3b0634115d880dbc59e2953ded45667"

TEMP_DIR=$(mktemp -d "$TOOLCHAIN_DIR/setup.XXXXXX")
trap 'rm -rf "$TEMP_DIR"' EXIT INT TERM

unzip -q -o "$PANDOC_ARCHIVE" -d "$TEMP_DIR/pandoc"
cp "$(find "$TEMP_DIR/pandoc" -type f -name pandoc -perm -111 | head -n 1)" "$BIN_DIR/pandoc"
tar -xzf "$TECTONIC_ARCHIVE" -C "$TEMP_DIR"
cp "$(find "$TEMP_DIR" -type f -name tectonic -perm -111 | head -n 1)" "$BIN_DIR/tectonic"
chmod 755 "$BIN_DIR/pandoc" "$BIN_DIR/tectonic"

TLMGR=$(find -L "$TEXLIVE_DIR/bin" -type f -name tlmgr -perm -111 2>/dev/null | head -n 1 || true)
TLMGR_VERSION=''
if [ -n "$TLMGR" ]; then
  TLMGR_VERSION=$("$TLMGR" --version 2>&1 || true)
fi
case "$TLMGR_VERSION" in
  *'TeX Live (https://tug.org/texlive) version 2026'*) ;;
  *)
  download "https://mirror.ctan.org/systems/texlive/tlnet/install-tl-unx.tar.gz" "$INSTALL_TL_ARCHIVE"
  mkdir -p "$TEMP_DIR/install-tl"
  tar -xzf "$INSTALL_TL_ARCHIVE" -C "$TEMP_DIR/install-tl" --strip-components=1
  "$TEMP_DIR/install-tl/install-tl" \
    --no-interaction \
    --scheme=scheme-small \
    --texdir="$TEXLIVE_DIR" \
    --repository="https://mirror.ctan.org/systems/texlive/tlnet"
  TLMGR=$(find -L "$TEXLIVE_DIR/bin" -type f -name tlmgr -perm -111 | head -n 1)
  ;;
esac

TEXLIVE_BIN=$(dirname "$TLMGR")
set --
while IFS= read -r package; do
  [ -n "$package" ] || continue
  set -- "$@" "$package"
done < "$ROOT_DIR/texlive-packages.txt"
attempt=1
while ! "$TLMGR" install "$@"; do
  if [ "$attempt" -ge 4 ]; then
    echo "Unable to install the locked TeX Live package set after $attempt attempts" >&2
    exit 1
  fi
  attempt=$((attempt + 1))
  echo "Retrying the locked TeX Live package set ($attempt/4)"
  sleep 5
done
for command in kpsewhich tlmgr xelatex; do
  ln -sf "$TEXLIVE_BIN/$command" "$BIN_DIR/$command"
done
sh "$ROOT_DIR/scripts/setup-dvisvgm-3.6.1.sh"

PATH="$BIN_DIR:$TEXLIVE_BIN:$PATH" node "$ROOT_DIR/scripts/check-paper-toolchain.mjs"
echo "Toolchain ready. Add $BIN_DIR to PATH before local paper builds."
