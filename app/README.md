# KlakTalk (Electron app)

Push-to-talk 음성 받아쓰기 데스크톱 앱. 단축키를 홀드해 말하면 → 로컬 whisper.cpp로 한국어 변환 → 현재 커서에 붙여넣기 + Postgres에 저장. 외부 앱(LLM 클라이언트 등)이 KlakTalk의 로컬 HTTP TTS 엔드포인트로 텍스트를 보내면 Supertonic TTS로 재생.

## 구조
```
app/
├── src/
│   ├── main.js           # Electron 메인: 트레이/윈도우/오케스트레이션
│   ├── preload.js        # renderer IPC 노출
│   ├── config.js         # 설정(electron-store): hotkey, modelPath, db, tts
│   ├── db.js             # Postgres(pg): insert/listRecent
│   ├── transcriber.js    # whisper-cli 호출 + 파싱
│   ├── tts.js            # TTS 클라이언트 (say + Supertonic remote dispatch)
│   ├── server.js         # 로컬 HTTP 서버 (port 4783) — 외부 앱에서 POST /tts
│   └── helper-bridge.js  # 네이티브 헬퍼 spawn + stdio JSON IPC
├── renderer/             # UI: 기록 리스트 + 설정
└── native/
    ├── wispr-helper.swift
    └── wispr-helper      # 컴파일된 네이티브 헬퍼 (CGEventTap/녹음/붙여넣기)
```

## 사전 요구
- Docker(Postgres 16) — `docker compose up -d db` (프로젝트 루트에서)
- `whisper-cli` (Homebrew `whisper-cpp`) at `/opt/homebrew/bin/whisper-cli`
- 모델 `ggml-large-v3.bin` at `spike/models/` (UI에서 경로 변경 가능)
- (TTS용, 옵션) `espeak-ng` — `brew install espeak-ng`

## 실행
```bash
# 1. DB 기동 (프로젝트 루트)
docker compose up -d db

# 2. 앱 디렉토리
cd app
npm install
npm run build:helper   # 헬퍼 재컴파일 시에만
npm start
```

## TTS (외부 응답 음성 재생)

KlakTalk은 두 가지 TTS 엔진을 지원합니다. 설정에서 `ttsEngine`으로 선택:

### 1. `say` (기본, macOS 내장)
- 추가 설치 불필요. `say -v Yuna`(한국어 여성) 등 시스템 보이스 사용.
- 단점: 기계음, 남자 한국어 보이스 없음.

### 2. `supertonic` (고품질 신경망 TTS, 별도 서버 필요)
- [Supertone Supertonic v3](https://github.com/supertone-inc/supertonic-py) — 한국어 포함 31개 언어, 99M params, ONNX Runtime 기반.
- Mac M-series CPU에서 RTF 0.012 (실시간 83배 빠름).
- 10개 내장 보이스 (M1-M5 남성, F1-F5 여성).

**Supertonic 서버 세팅** (최초 1회):
```bash
cd app/tts-server
/opt/homebrew/bin/python3.10 -m venv .venv-supertonic
source .venv-supertonic/bin/activate
pip install "supertonic[serve]"
supertonic serve --model supertonic-3 --port 9880   # 첫 실행 시 모델 404MB 다운로드
```

**KlakTalk 설정에서 활성화**:
- UI: "외부 응답 TTS — Supertonic v3" 토글 ON, 서버 포트 9880
- 또는 `~/Library/Application Support/klaktalk/wispr-config.json`에서:
  ```json
  { "ttsEnabled": true, "ttsEngine": "supertonic", "ttsVoice": "M1", "ttsServerUrl": "http://127.0.0.1:9880" }
  ```

**외부 앱에서 TTS 호출**:
```bash
curl -X POST http://127.0.0.1:4783/tts \
  -H "Content-Type: application/json" \
  -d '{"text":"안녕하세요. 반갑습니다."}'
```
ChatGPT 클라이언트, Raycast 확장, 자동화 스크립트 등이 이 엔드포인트로 POST하면 KlakTalk 스피커로 재생됨.

## macOS 권한 (첫 실행 시 앱에 부여)
앱 창 하단 status 바에 `FATAL: ...` 또는 녹음/붙여넣기 안 됨이 뜨면 시스템 설정 → 개인정보 보호 및 보안에서 **이 Electron 앱**에 세 권한 모두 ON:
- **입력 모니터링** — 헬퍼의 CGEventTap(전역 키)
- **손쉬운 사용** — 붙여넣기(CGEvent Cmd+V)
- **마이크** — 녹음(AVAudioRecorder)

> 권한 변경 후 앱 완전 재시작(Cmd+Q → 재실행).

## 사용법
1. 다른 앱(TextEdit, 브라우저 입력창 등)에 커서를 둔다.
2. 설정한 단축키(기본 **오른쪽 Command**)를 **누르고 있는 동안** 말한다.
3. 떼면 → 변환된 텍스트가 커서에 붙여넣어지고, 기록 리스트 최상단에 추가된다.

## 설정 (앱 UI)
- **단축키**: 드롭다운에서 변경 (Right Cmd / Right Option / Left Cmd / Left Option / Right·Left Control)
- **Whisper 모델 경로**: 입력 후 저장
- **외부 응답 TTS**: 토글 ON/OFF, 서버 포트(기본 9880), 테스트 버튼

## 빌드 (DMG 배포)
```bash
npm run dist    # bundle:whisper + electron-builder --mac (arm64 dmg)
# 결과물: dist/KlakTalk-<version>-arm64.dmg
```

> 주의: DMG에는 KlakTalk 앱만 포함됨. Supertonic 서버는 별도 세팅 필요 (위 "Supertonic 서버 세팅" 참조).

## 트러블슈팅
- `FATAL: CGEventTap creation failed` → 입력 모니터링 권한 미부여.
- 녹음 후 빈 결과 / `AVAudioRecorder start failed` → 마이크 권한.
- 변환은 되는데 안 붙음 → 손쉬운 사용 권한.
- `db: ...` → Postgres 미기동. `docker compose up -d db`.
- TTS 안 됨 → `curl http://127.0.0.1:9880/v1/health`로 Supertonic 서버 확인. 서버 죽었으면 `supertonic serve` 재실행.
- "내 말이 TTS로 재생됨" → 외부 앱(LLM 클라이언트 등)이 prompt 자체를 POST /tts로 보내는 버그. `tail -f /tmp/klaktalk.log | grep tts-req`로 호출 출처(origin/user-agent) 확인.
