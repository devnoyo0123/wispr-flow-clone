# 🎙️ KlakTalk

macOS용 **push-to-talk 음성 받아쓰기** 데스크톱 앱. 단축키를 누른 채 말하면 → 로컬 [whisper.cpp](https://github.com/ggerganov/whisper.cpp) 로 한국어(또는 설정 언어) 변환 → 현재 커서 위치에 텍스트를 붙여넣고, 변환 기록을 **로컬 SQLite**에 저장합니다. 외부 클라우드/SaaS 없이 **전부 로컬**에서 동작합니다.

> [Wispr Flow](https://wisprflow.ai/) 의 기능 일부를 개인 학습/실험용으로 클론한 프로젝트입니다.

---

## ✨ 기능

- 전역 단축키 **홀드=녹음 / 떼면=변환** (CGEventTap 기반)
- 로컬 whisper.cpp 변환 — 오프라인, 데이터 외부 유출 없음
- 변환 결과를 **활성 커서**에 자동 붙여넣기 (어느 앱이든)
- **화면 하단 floating overlay** 로 녹음/변환/완료 상태 표시
- UI에서 단축키 / 모델 경로 변경
- 변환 기록을 **로컬 SQLite**에 저장 + 앱 UI 리스트 (외부 DB 불필요)
- 트레이 + 윈도우 앱 (메뉴바 마이크 아이콘)

---

## 🗂 구조

```
.
├── app/                      # Electron 앱
│   ├── src/
│   │   ├── main.js           # 메인: 트레이/윈도우/overlay/오케스트레이션
│   │   ├── preload.js        # renderer IPC 노출
│   │   ├── overlay-preload.js# overlay(HUD) IPC
│   │   ├── config.js         # 설정(electron-store)
│   │   ├── db.js             # SQLite(better-sqlite3) — userData/wispr.db
│   │   ├── transcriber.js    # whisper-cli 호출 + 파싱
│   │   └── helper-bridge.js  # 네이티브 헬퍼 spawn + stdio JSON IPC
│   ├── renderer/             # UI(기록 리스트 + 설정) + overlay
│   ├── native/
│   │   └── wispr-helper.swift# CGEventTap/녹음/붙여넣기 네이티브 헬퍼
│   └── build/                # 앱 아이콘(icon.svg → icon.icns)
├── spike/                    # 단계별 프로토타입 스파이크(tap/rec/ptt 실험)
└── memory-bank/              # 설계/스펙 문서
```

---

## ✅ 사전 요구사항

- **macOS** (Apple Silicon 권장 — 헬퍼가 CGEventTap/AVFoundation 사용)
- **Node.js** 18+
- **whisper.cpp**(빌드용) — 번들 생성을 위해서만 Homebrew 설치:
  ```bash
  brew install whisper-cpp
  ```
  > `npm run bundle:whisper` 가 이 whisper-cli 바이너리(+dylib)를 앱 안으로 복사합니다. **최종 사용자는 whisper-cpp 설치 불필요.**
- **Whisper 모델** — **첫 실행 시 자동 다운로드** (large-v3, ~3GB). 별도 준비 불필요.
  > 모델을 미리 받아두거나 경로를 바꾸려면 앱 UI(Whisper 모델 경로)에서 설정.

---

## 🚀 설치 및 실행

```bash
cd app
npm install
npm run rebuild           # better-sqlite3 네이티브를 electron 용으로 빌드
npm run bundle:whisper    # whisper-cli(+dylib)를 앱 안으로 번들 (Homebrew whisper-cpp 필요)
npm run build:helper      # (필요시) 네이티브 헬퍼 컴파일
npm start
```

> - 외부 DB(Postgres/Docker)는 **불필요** — 기록은 `wispr.db`(SQLite)에 자동 저장.
> - 모델은 **첫 실행 시 자동 다운로드** (large-v3, ~3GB). overlay에 진행률 표시.
> - whisper-cli는 앱 안에 **번들 포함** — Homebrew 없이 동작.

실행하면 480×680 창이 뜨고 메뉴바에 마이크 아이콘이 나타납니다.

---

## 🔐 macOS 권한 (첫 실행)

앱 창 하단 status 바에 `FATAL: ...` 가 뜨거나 녹음/붙여넣기가 안 되면, **시스템 설정 → 개인정보 보호 및 보안**에서 **이 Electron 앱**에 아래 세 권한을 모두 부여하세요:

| 권한 | 용도 |
|---|---|
| **입력 모니터링** | 헬퍼의 CGEventTap(전역 키 감지) |
| **손쉬운 사용** | 붙여넣기(CGEvent로 Cmd+V 전송) |
| **마이크** | AVAudioRecorder 녹음 |

> ⚠️ 권한 변경 후에는 앱을 **완전히 종료(Cmd+Q)** 하고 재실행해야 적용됩니다.

---

## 📦 정식 앱으로 빌드 (.app / .dmg)

개발 모드(`npm start`) 대신 일반 macOS 앱처럼 **아이콘 클릭으로 실행**하려면 [electron-builder](https://www.electron.build/) 로 `.app` + `.dmg` 를 만듭니다.

### 1. 빌드하기 (app 디렉토리에서)

```bash
cd app
npm run dist          # → app/dist/ 에 .app + .dmg 생성
# 또는 dmg 없이 .app만 빠르게: npm run dist:fast
```

결과:
- `app/dist/KlakTalk-0.1.0-arm64.dmg` — 배포/설치용 디스크 이미지
- `app/dist/mac-arm64/KlakTalk.app` — 앱 번들

> 빌드 설정은 `app/package.json` 의 `build` 항목, 앱 아이콘은 `app/build/icon.svg` → `icon.icns` 를 수정하세요. 아이콘 재생성: `rsvg-convert -w 1024 build/icon.svg ...` → `iconutil -c icns` .

### 2. .dmg 로 설치 & 실행

1. `KlakTalk-0.1.0-arm64.dmg` 를 **더블클릭**합니다.
2. 열리는 창에서 🎙️ 앱 아이콘을 → **응용프로그램** 폴더로 **드래그**합니다.
3. **첫 실행 — Gatekeeper 우회** (코드 서명을 안 했기 때문에 "확인할 수 없는 개발자" 경고가 뜹니다):
   - 응용프로그램에서 **KlakTalk 을 우클릭 → 열기** → "열기" 클릭
   - 또는 터미널: `xattr -cr "/Applications/KlakTalk.app"`
4. **macOS 권한 재부여** ⚠️ — 설치한 `.app` 는 개발 모드(`npm start`)와 **다른 앱**으로 인식되므로 아래 권한을 **다시** 부여해야 합니다:
   - 시스템 설정 → 개인정보 보호 및 보안 → **입력 모니터링 · 손쉬운 사용 · 마이크** (KlakTalk 에 ON)
   - 부여 후 앱 **완전 재시작**

이제 Launchpad / 독에서 🎙️ 아이콘 클릭으로 실행할 수 있습니다.

> 💡 불특정 다수에게 배포하려면 Apple Developer 계정($99/년)으로 **코드 서명 + 공증(notarization)** 이 필요합니다. 개인/팀 내 사용이라면 위 우회 방법으로 충분합니다.

---

## 🎯 사용법

1. 텍스트를 입력할 앱(TextEdit, 브라우저 입력창, 메신저 등)에 **커서**를 둡니다.
2. 설정한 단축키(기본 **오른쪽 Command ⌘**)를 **누르고 있는 동안** 말합니다.
3. **떼면** → 변환된 텍스트가 커서에 붙여넣어지고, 앱 기록 리스트 최상단에 추가됩니다.
   - 녹음 중에는 화면 하단에 `🔴 녹음 중` overlay가, 변환 후에는 `✓ 완료` 가 잠깐 표시됩니다.

### 설정 (앱 UI)

- **단축키**: Right Cmd / Right Option / Left Cmd / Left Option / Right·Left Control
- **Whisper 모델 경로**: 입력 후 저장

---

## 🗑 Uninstall (제거)

macOS 앱은 별도의 uninstaller가 없습니다. 아래 절차로 수동 제거하세요.

**1. 앱 삭제** — 응용프로그램 폴더에서 `KlakTalk.app`을 **휴지통**으로 드래그(또는 우클릭 → 휴지통).

**2. 완전 제거** (설정·기록 DB까지 지울 때):
```bash
rm -rf "/Applications/KlakTalk.app"
rm -rf ~/Library/Application\ Support/Wispr\ Flow\ Clone/   # 설정 + wispr.db (기록)
```

> 💡 개발 모드(`npm start`)의 설정/DB는 별도 경로에 있습니다:
> `~/Library/Application Support/klaktalk/`

> ℹ️ whisper.cpp 모델 파일은 사용자가 직접 다운로드한 것이므로, 필요하면 `spike/models/*.bin`을 따로 지우세요.

---

## 🛠 트러블슈팅

| 증상 | 원인 / 해결 |
|---|---|
| `FATAL: CGEventTap creation failed` | 입력 모니터링 권한 미부여 |
| 녹음 후 빈 결과 / `AVAudioRecorder start failed` | 마이크 권한 미부여 |
| 변환은 되는데 안 붙음 | 손쉬운 사용 권한 미부여 |
| 변환 자체가 안 됨 | `whisper-cli` 미설치 → `brew install whisper-cpp` 또는 모델 경로 확인 |
| `better-sqlite3` 로드 에러 | `npm run rebuild` 로 electron 용 재빌드 |
| 창이 안 보임 | 메뉴바 마이크 아이콘 클릭 또는 앱 재실행 |

기록 확인 (SQLite):
```bash
sqlite3 ~/Library/Application\ Support/klaktalk/wispr.db \
  'SELECT id, created_at, substr(text,1,40) FROM transcriptions ORDER BY id DESC LIMIT 10;'
```

---

## 📄 라이선스

- 코드: **MIT**
- [whisper.cpp](https://github.com/ggerganov/whisper.cpp): MIT (ggerganov)
- Whisper 모델: OpenAI
- "Wispr Flow" 상표는 본 프로젝트와 무관함
