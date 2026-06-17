#!/bin/bash
# Homebrew whisper-cpp 바이너리 + 의존 dylib 를 앱 안으로 복사하고
# install_name_tool 로 @loader_path 기반 경로로 재매핑한다.
# (이후 정식 .app 어디서든 whisper-cli 가 Homebrew 없이 동작)
set -e

SRC="${1:-/opt/homebrew}"
DST="$(cd "$(dirname "$0")/.." && pwd)/native/whisper"
rm -rf "$DST"        # 기존 번들이 읽기전용일 수 있어 먼저 삭제
mkdir -p "$DST"

echo "→ 복사: whisper-cli + libwhisper + libggml + libggml-base"
cp -L "$SRC/bin/whisper-cli"             "$DST/whisper-cli"
cp -L "$SRC/lib/libwhisper.1.dylib"      "$DST/libwhisper.1.dylib"
cp -L "$SRC/lib/libggml.0.dylib"         "$DST/libggml.0.dylib"
cp -L "$SRC/lib/libggml-base.0.dylib"    "$DST/libggml-base.0.dylib"

GGML="$SRC/opt/ggml/lib"

echo "→ install_name_tool: 경로를 @loader_path 로 재매핑"
# whisper-cli → libs
install_name_tool -change "@rpath/libwhisper.1.dylib"      "@loader_path/libwhisper.1.dylib"   "$DST/whisper-cli"
install_name_tool -change "$GGML/libggml.0.dylib"          "@loader_path/libggml.0.dylib"      "$DST/whisper-cli"
install_name_tool -change "$GGML/libggml-base.0.dylib"     "@loader_path/libggml-base.0.dylib" "$DST/whisper-cli"
# dylib id
install_name_tool -id "@loader_path/libwhisper.1.dylib"    "$DST/libwhisper.1.dylib"
install_name_tool -id "@loader_path/libggml.0.dylib"       "$DST/libggml.0.dylib"
install_name_tool -id "@loader_path/libggml-base.0.dylib"  "$DST/libggml-base.0.dylib"
# libwhisper → ggml
install_name_tool -change "$GGML/libggml.0.dylib"          "@loader_path/libggml.0.dylib"      "$DST/libwhisper.1.dylib" 2>/dev/null || true
install_name_tool -change "$GGML/libggml-base.0.dylib"     "@loader_path/libggml-base.0.dylib" "$DST/libwhisper.1.dylib" 2>/dev/null || true
# libggml → libggml-base
install_name_tool -change "$GGML/libggml-base.0.dylib"     "@loader_path/libggml-base.0.dylib" "$DST/libggml.0.dylib"    2>/dev/null || true

chmod +x "$DST/whisper-cli"
echo "→ 완료:"
ls -la "$DST"
