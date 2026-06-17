#!/bin/bash
# Record 5s then transcribe with whisper-cli (Korean, large-v3).
# Run: ./go.sh
set -e
MODEL=models/ggml-large-v3.bin
OUT=rec.wav

if [ ! -f "$MODEL" ]; then echo "model not found: $MODEL"; exit 1; fi

./record "$OUT" 5
echo ""
echo "=== whisper-cli transcription (lang=ko, model=large-v3) ==="
/opt/homebrew/bin/whisper-cli -m "$MODEL" -f "$OUT" -l ko 2>&1
