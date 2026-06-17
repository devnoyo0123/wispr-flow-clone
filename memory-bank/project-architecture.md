# 아키텍처 & 기술 스택 결정

작성일: 2026-06-14
최종 수정: 2026-06-16 (스파이크 검증 결과 반영)
**확정: Electron(UI/오케스트레이션) + 네이티브 Swift 헬퍼(CGEventTap/녹음) + 로컬 whisper.cpp**

---

## 🔬 스파이크 검증 결과 (2026-06-15 ~ 16) ★가장 중요★

위험 축 3개를 실제 머신(macOS 26.4.1 / arm64 / Node 25)에서 검증 완료:

| 축 | 검증 결과 | 비고 |
|---|---|---|
| 전역 키 캡처 | ✅ **네이티브 CGEventTap 작동** | keydown/keyup 42/42 정확 매칭 |
| 수식키 push-to-talk | ✅ `flagsChanged`로 잡음 | Right Cmd 홀드 1948ms 정상 감지 |
| 커서 삽입(붙여넣기) | ✅ 작동 | NSPasteboard + CGEvent Cmd+V, 글자 실제 붙음 확인 |

### 핵심 발견 (피를 흘려 얻은 교훈)
1. **`uiohook-napi`는 macOS 26 + Node 25에서 깨짐 → 폐기.** 사전빌드 바이너리가 쓰레기 keycode(57416)만 내보내고 실제 키 이벤트는 거의 캡처 못 함. 환경(Warp/Terminal.app) 바꿔도 동일 → 라이브러리 문제 확정.
2. **네이티브 CGEventTap(Swift)이 정답.** `CGEvent.tapCreate(.cgSessionEventTap, .headInsertEventTap, .listenOnly, ...)` 정상 작동.
3. **수식키(Option/Cmd/Caps)는 `.keyDown`/`.keyUp`이 아닌 `.flagsChanged`로 옴.** 일반 키만 keyDown. push-to-talk용 수식키 감지 시 반드시 flagsChanged + 디바이스 비트로 처리.
4. **PTT 키 = 오른쪽 Command(`NX_DEVICERCMDKEYMASK` = 0x10).** Right Option은 Apple Silicon에서 Globe(🌐)로 매핑된 경우가 많아 불안정. Right Cmd가 가장 확실.
5. **붙여넣기 = `NSPasteboard`에 쓰고 `CGEvent`로 Cmd+V(virtualKey 9) post.** Accessibility 권한 필요.
6. **Warp 터미널은 전역 키 이벤트를 삼킴 → 테스트/개발 시 Apple Terminal.app 사용.**

### 필요 macOS 권한 (3종)
- **입력 모니터링(Input Monitoring)** — CGEventTap 생성
- **손쉬운 사용(Accessibility)** — CGEvent post(Cmd+V 붙여넣기)
- **마이크(Microphone)** — 녹음

---

## 핵심 제약
난이도 대부분은 "UI"가 아니라 OS 레벨: 전역 키 감지 / 커서 삽입 / 마이크 녹음+STT. 이 세 가지를 네이티브로 깔끔히 처리하는 게 핵심.

## 확정 스택

### 1. 앱 프레임워크: Electron (JS/TS)
- UI(React 또는 순 HTML/JS)로 기록 리스트 + 설정 + 메뉴바(Tray)
- main 프로세스가 오케스트레이션: 네이티브 헬퍼 spawn, whisper 바이너리 호출, history 저장, IPC

### 2. 네이티브 Swift 헬퍼 (★ 핵심, 신규 추가)
Electron main이 자식 프로세스로 spawn. stdio(JSON lines)로 통신.
- **Hotkey**: CGEventTap + flagsChanged → Right Cmd down/up 이벤트 emit
- **Recording**: `AVAudioEngine` → 16kHz mono WAV (★이번 검증 대상)
- **Paste**: NSPasteboard + CGEvent Cmd+V
- 이유: uiohook이 깨져서 네이티브로 직접. 어차피 권한·이벤트·오디오가 네이티브 API에서 가장 깔끔함.

### 3. STT: 로컬 whisper.cpp
- Homebrew `whisper-cpp` (`whisper-cli`) + 모델 `ggml-large-v3.bin` (한국어 품질 최상, Apple Silicon Metal 가속)
- 입력: 16kHz mono WAV → 텍스트
- Electron main이 헬퍼가 만든 WAV를 whisper-cli에 전달, stdout 텍스트 회수
- `Transcriber` 인터페이스로 추상화 → 추후 Whisper API로 교체 가능

### 4. 저장소: PostgreSQL (docker-compose 로컬)
- 사용자 결정(2026-06-16): electron-store 대신 **Postgres**로 영구 저장
- docker-compose로 로컬 구동 (db 서비스)
- 스키마(초안): `transcriptions(id BIGSERIAL PK, created_at TIMESTAMPTZ DEFAULT now(), text TEXT NOT NULL)`
- 최신순(내림차순) 조회: `SELECT id, created_at, text FROM transcriptions ORDER BY created_at DESC LIMIT 100`
- 앱 ↔ DB: Electron main에서 `pg`(node-postgres) 사용

## 모듈 구조
- **Electron main (Node/TS)**
  - `NativeHelper` — Swift 헬퍼 spawn/통신, PTT start/stop 수신
  - `Transcriber` — whisper-cli 호출 (인터페이스 추상화)
  - `HistoryStore` — electron-store CRUD
  - `Tray` / IPC — renderer와 통신
- **Native helper (Swift)**: Hotkey(CGEventTap) · Record(AVAudioEngine) · Paste(NSPasteboard+CGEvent)
- **Renderer (웹)**: 기록 리스트(최신순) · 단축키 설정 화면

## 데이터 흐름
1. Right Cmd 누름 → 헬퍼 flagsChanged → "start" emit → AVAudioEngine 녹음 시작
2. Right Cmd 뗌 → "stop" emit → 녹음 종료, WAV 저장 → main으로 경로 전달
3. main이 whisper-cli로 WAV → 텍스트 변환
4. 헬퍼에 텍스트 전달 → NSPasteboard + Cmd+V로 커서 삽입 + HistoryStore 저장
5. renderer 리스트 갱신(최상단)

## ✅ 검증 완료 (2026-06-16) — 4개 위험 축 전부 통과
- ✅ 전역 키 캡처 (CGEventTap)
- ✅ 수식키 PTT (flagsChanged + Right Cmd, 1948ms 홀드 정확)
- ✅ 커서 삽입 (NSPasteboard + CGEvent Cmd+V, 글자 실제 붙음)
- ✅ 마이크 녹음 (AVAudioRecorder → 16kHz mono WAV, 165KB/5s)
- ✅ 한국어 STT (whisper-cli + large-v3, Apple M5 Metal, 5s 오디오 → ~3s 변환)
- ⏳ 헬퍼 ↔ Electron stdio JSON 통신 (본 빌드에서 구현)

## 🏗️ BUILD (사용자 요구 2026-06-16)
1. **단축키 사용자 설정** — 설정 UI에서 키 캡처 → 헬퍼에 전달 (현재 Right Cmd 하드코딩)
2. **PostgreSQL 영구 저장** — docker-compose 로컬 구동, 변환 텍스트 적재·최신순 조회
   - electron-store(JSON) → **Postgres**로 변경 (사용자 결정)
