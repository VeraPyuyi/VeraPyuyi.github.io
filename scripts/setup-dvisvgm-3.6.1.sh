#!/bin/sh
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
TOOLCHAIN_DIR="$ROOT_DIR/.cache/paper-toolchain"
DOWNLOAD_DIR="$TOOLCHAIN_DIR/downloads"
BIN_DIR="$TOOLCHAIN_DIR/bin"
VENDOR_DIR="$TOOLCHAIN_DIR/vendor"
DVISVGM_PREFIX="$VENDOR_DIR/dvisvgm-3.6.1"
FREETYPE_PREFIX="$VENDOR_DIR/freetype-2.14.3"
KPATHSEA_PREFIX="$VENDOR_DIR/kpathsea-6.4.2"
DVISVGM_ARCHIVE="$DOWNLOAD_DIR/dvisvgm-3.6.1.tar.gz"
FREETYPE_ARCHIVE="$DOWNLOAD_DIR/freetype-2.14.3.tar.xz"
MACPORTS_ARCHIVE="$DOWNLOAD_DIR/texlive-bin-2026.78235_5-x11.darwin_25.arm64.tbz2"
DVISVGM_SOURCE_DIR=${DVISVGM_SOURCE_DIR:-}
DVISVGM_COMMIT=2ad0587be8ec8c4e7371bd83349ccad3e9f2b4d0

DVISVGM_SHA256=d6aab13136de758e91530a009ace194c84d909dbdb8efa8fa5721de71ff298d8
FREETYPE_SHA256=36bc4f1cc413335368ee656c42afca65c5a3987e8768cc28cf11ba775e785a5f
MACPORTS_SHA256=bfe3f4384741a7eeb1f51ea2d36af85f6ab14749751cf331e8274eabf36a4c96

mkdir -p "$DOWNLOAD_DIR" "$BIN_DIR" "$VENDOR_DIR"

sha256() {
  if command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "$1" | awk '{print $1}'
  else
    sha256sum "$1" | awk '{print $1}'
  fi
}

download_verified() {
  url=$1
  destination=$2
  expected=$3
  if [ -s "$destination" ] && [ "$(sha256 "$destination")" = "$expected" ]; then
    return
  fi
  partial="$destination.part"
  rm -f "$partial"
  curl --fail --location --retry 8 --retry-all-errors --connect-timeout 30 \
    --header "Accept: application/octet-stream" \
    --header "X-GitHub-Api-Version: 2022-11-28" \
    --header "User-Agent: Pyuyi-paper-toolchain" \
    --output "$partial" "$url"
  actual=$(sha256 "$partial")
  if [ "$actual" != "$expected" ]; then
    echo "Checksum mismatch for $destination: expected $expected, received $actual" >&2
    rm -f "$partial"
    exit 1
  fi
  mv "$partial" "$destination"
}

if [ -x "$DVISVGM_PREFIX/bin/dvisvgm" ] && \
  "$DVISVGM_PREFIX/bin/dvisvgm" --version 2>&1 | grep -q '^dvisvgm 3\.6\.1$'; then
  ln -sf "$DVISVGM_PREFIX/bin/dvisvgm" "$BIN_DIR/dvisvgm"
  echo "dvisvgm 3.6.1 is ready at $BIN_DIR/dvisvgm"
  exit 0
fi

download_verified \
  "https://download.savannah.gnu.org/releases/freetype/freetype-2.14.3.tar.xz" \
  "$FREETYPE_ARCHIVE" \
  "$FREETYPE_SHA256"

TEMP_DIR=$(mktemp -d "$TOOLCHAIN_DIR/dvisvgm.XXXXXX")
trap 'rm -rf "$TEMP_DIR"' EXIT INT TERM

if [ -n "$DVISVGM_SOURCE_DIR" ]; then
  if [ ! -d "$DVISVGM_SOURCE_DIR/.git" ]; then
    echo "The checked-out dvisvgm source directory is missing: $DVISVGM_SOURCE_DIR" >&2
    exit 1
  fi
  actual_commit=$(git -C "$DVISVGM_SOURCE_DIR" rev-parse HEAD)
  if [ "$actual_commit" != "$DVISVGM_COMMIT" ]; then
    echo "dvisvgm source mismatch: expected $DVISVGM_COMMIT, received $actual_commit" >&2
    exit 1
  fi
  mkdir -p "$TEMP_DIR/dvisvgm-3.6.1"
  cp -R "$DVISVGM_SOURCE_DIR/." "$TEMP_DIR/dvisvgm-3.6.1/"
  (
    cd "$TEMP_DIR/dvisvgm-3.6.1"
    autoreconf -fi
  )
else
  download_verified \
    "https://api.github.com/repos/mgieseki/dvisvgm/releases/assets/501052592" \
    "$DVISVGM_ARCHIVE" \
    "$DVISVGM_SHA256"
  tar -xzf "$DVISVGM_ARCHIVE" -C "$TEMP_DIR"
fi
tar -xJf "$FREETYPE_ARCHIVE" -C "$TEMP_DIR"

JOBS=2
if [ "$(uname -s)" = "Darwin" ]; then
  JOBS=$(sysctl -n hw.ncpu 2>/dev/null || echo 2)
else
  JOBS=$(getconf _NPROCESSORS_ONLN 2>/dev/null || echo 2)
fi

rm -rf "$FREETYPE_PREFIX"
(
  cd "$TEMP_DIR/freetype-2.14.3"
  ./configure \
    --prefix="$FREETYPE_PREFIX" \
    --disable-shared \
    --enable-static \
    --without-zlib \
    --without-bzip2 \
    --without-png \
    --without-harfbuzz \
    --without-brotli
  make -j "$JOBS"
  make install
)

KPATHSEA_OPTION=
case "$(uname -s):$(uname -m)" in
  Darwin:arm64)
    download_verified \
      "https://kmq.jp.packages.macports.org/texlive-bin/texlive-bin-2026.78235_5%2Bx11.darwin_25.arm64.tbz2" \
      "$MACPORTS_ARCHIVE" \
      "$MACPORTS_SHA256"
    mkdir -p "$TEMP_DIR/macports"
    tar -xjf "$MACPORTS_ARCHIVE" -C "$TEMP_DIR/macports"
    rm -rf "$KPATHSEA_PREFIX"
    mkdir -p "$KPATHSEA_PREFIX/include" "$KPATHSEA_PREFIX/lib"
    cp -R "$TEMP_DIR/macports/opt/local/include/kpathsea" "$KPATHSEA_PREFIX/include/"
    cp "$TEMP_DIR/macports/opt/local/lib/libkpathsea.a" "$KPATHSEA_PREFIX/lib/"
    KPATHSEA_OPTION="--with-kpathsea=$KPATHSEA_PREFIX"
    ;;
  Linux:*)
    if [ ! -f /usr/include/kpathsea/kpathsea.h ]; then
      echo "libkpathsea development headers are required (install libkpathsea-dev)." >&2
      exit 1
    fi
    ;;
  *)
    echo "Unsupported platform for the locked dvisvgm build: $(uname -s) $(uname -m)" >&2
    exit 1
    ;;
esac

PKG_CONFIG_STUB="$TEMP_DIR/pkg-config"
printf '%s\n' \
  '#!/bin/sh' \
  'if [ "${1:-}" = "--atleast-pkgconfig-version" ]; then exit 0; fi' \
  'exit 1' > "$PKG_CONFIG_STUB"
chmod 755 "$PKG_CONFIG_STUB"

rm -rf "$DVISVGM_PREFIX"
(
  cd "$TEMP_DIR/dvisvgm-3.6.1"
  PKG_CONFIG="$PKG_CONFIG_STUB" \
  FREETYPE_CFLAGS="-I$FREETYPE_PREFIX/include/freetype2" \
  FREETYPE_LIBS="$FREETYPE_PREFIX/lib/libfreetype.a" \
    ./configure \
      --prefix="$DVISVGM_PREFIX" \
      --disable-shared \
      --enable-static \
      --enable-bundled-libs \
      --disable-manpage \
      $KPATHSEA_OPTION
  make -j "$JOBS"
  make install
)

if ! "$DVISVGM_PREFIX/bin/dvisvgm" --version 2>&1 | grep -q '^dvisvgm 3\.6\.1$'; then
  echo "The locally built dvisvgm does not match version 3.6.1." >&2
  exit 1
fi
ln -sf "$DVISVGM_PREFIX/bin/dvisvgm" "$BIN_DIR/dvisvgm"
echo "dvisvgm 3.6.1 is ready at $BIN_DIR/dvisvgm"
