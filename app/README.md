# Wispr Flow Clone (Electron app)

Push-to-talk 음성 받아쓰기 데스크톱 앱. 단축키를 홀드해 말하면 → 로컬 whisper.cpp로 한국어 변환 → 현재 커서에 붙여넣기 + Postgres에 저장.

## 구조
```
app/
├── src/
│   ├── main.js           # Electron 메인: 트레이/윈도우/오케스트레이션
│   ├── preload.js        # renderer IPC 노출
│   ├── config.js         # 설정(electron-store): hotkey, modelPath, db
│   ├── db.js             # Postgres(pg): insert/listRecent
│   ├── transcriber.js    # whisper-cli 호출 + 파싱
│   └── helper-bridge.js  # 네이티브 헬퍼 spawn + stdio JSON IPC
├── renderer/             # UI: 기록 리스트 + 설정
└── native/
    ├── wispr-helper.swift
    └── wispr-helper      # 컴파일된 네이티브 헬퍼 (CGEventTap/녹음/붙여넣기)
```

## 사전 요구(이미 구축됨)
- Docker(Postgres 16) — `docker compose up -d db` (프로젝트 루트에서)
- `whisper-cli` (Homebrew `whisper-cpp`) at `/opt/homebrew/bin/whisper-cli`
- 모델 `ggml-large-v3.bin` at `spike/models/` (UI에서 경로 변경 가능)

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

## 트러블슈팅
- `FATAL: CGEventTap creation failed` → 입력 모니터링 권한 미부여.
- 녹음 후 빈 결과 / `AVAudioRecorder start failed` → 마이크 권한.
- 변환은 되는데 안 붙음 → 손쉬운 사용 권한.
- `db: ...` → Postgres 미기동. `docker compose up -d db`.
