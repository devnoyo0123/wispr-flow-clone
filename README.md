# 🎙️ Wispr Flow Clone

macOS용 **push-to-talk 음성 받아쓰기** 데스크톱 앱. 단축키를 누른 채 말하면 → 로컬 [whisper.cpp](https://github.com/ggerganov/whisper.cpp) 로 한국어(또는 설정 언어) 변환 → 현재 커서 위치에 텍스트를 붙여넣고, 변환 기록을 Postgres에 저장합니다. 외부 클라우드/SaaS 없이 **전부 로컬**에서 동작합니다.

> [Wispr Flow](https://wisprflow.ai/) 의 기능 일부를 개인 학습/실험용으로 클론한 프로젝트입니다.

---

## ✨ 기능

- 전역 단축키 **홀드=녹음 / 떼면=변환** (CGEventTap 기반)
- 로컬 whisper.cpp 변환 — 오프라인, 데이터 외부 유출 없음
- 변환 결과를 **활성 커서**에 자동 붙여넣기 (어느 앱이든)
- UI에서 단축키 / 모델 경로 변경
- 변환 기록을 **Postgres**에 영구 저장 + 앱 UI 리스트
- 트레이 + 윈도우 앱 (메뉴바 마이크 아이콘)

---

## 🗂 구조

```
.
├── app/                      # Electron 앱
│   ├── src/
│   │   ├── main.js           # 메인: 트레이/윈도우/오케스트레이션
│   │   ├── preload.js        # renderer IPC 노출
│   │   ├── config.js         # 설정(electron-store)
│   │   ├── db.js             # Postgres(pg)
│   │   ├── transcriber.js    # whisper-cli 호출 + 파싱
│   │   └── helper-bridge.js  # 네이티브 헬퍼 spawn + stdio JSON IPC
│   ├── renderer/             # UI(기록 리스트 + 설정)
│   └── native/
│       └── wispr-helper.swift# CGEventTap/녹음/붙여넣기 네이티브 헬퍼
├── spike/                    # 단계별 프로토타입 스파이크(tap/rec/ptt 실험)
├── memory-bank/              # 설계/스펙 문서
├── docker-compose.yml        # Postgres 16
└── schema.sql                # transcriptions 테이블
```

---

## ✅ 사전 요구사항

- **macOS** (Apple Silicon 권장 — 헬퍼가 CGEventTap/AVFoundation 사용)
- **Node.js** 18+
- **Docker** (Postgres용)
- **whisper.cpp** — Homebrew 설치:
  ```bash
  brew install whisper-cpp
  ```
- **Whisper 모델** `ggml-large-v3.bin` — 별도 다운로드 필요 (3GB, 레포에 포함되지 않음):
  ```bash
  mkdir -p spike/models
  # ggml 모델을 아래 경로에 배치 (또는 앱 UI에서 경로 지정)
  ```

---

## 🚀 설치 및 실행

```bash
# 1. 의존성 설치
cd app
npm install

# 2. (필요시) 네이티브 헬퍼 빌드
npm run build:helper        # swiftc 로 wispr-helper 컴파일

# 3. Postgres 기동 (프로젝트 루트에서)
cd ..
docker compose up -d db

# 4. 앱 실행
cd app
npm start
```

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
- `app/dist/Wispr Flow Clone-0.1.0-arm64.dmg` — 배포/설치용 디스크 이미지
- `app/dist/mac-arm64/Wispr Flow Clone.app` — 앱 번들

> 빌드 설정은 `app/package.json` 의 `build` 항목, 앱 아이콘은 `app/build/icon.svg` → `icon.icns` 를 수정하세요. 아이콘 재생성: `rsvg-convert -w 1024 build/icon.svg ...` → `iconutil -c icns` .

### 2. .dmg 로 설치 & 실행

1. `Wispr Flow Clone-0.1.0-arm64.dmg` 를 **더블클릭**합니다.
2. 열리는 창에서 🎙️ 앱 아이콘을 → **응용프로그램** 폴더로 **드래그**합니다.
3. **첫 실행 — Gatekeeper 우회** (코드 서명을 안 했기 때문에 "확인할 수 없는 개발자" 경고가 뜹니다):
   - 응용프로그램에서 **Wispr Flow Clone 을 우클릭 → 열기** → "열기" 클릭
   - 또는 터미널: `xattr -cr "/Applications/Wispr Flow Clone.app"`
4. **macOS 권한 재부여** ⚠️ — 설치한 `.app` 는 개발 모드(`npm start`)와 **다른 앱**으로 인식되므로 아래 권한을 **다시** 부여해야 합니다:
   - 시스템 설정 → 개인정보 보호 및 보안 → **입력 모니터링 · 손쉬운 사용 · 마이크** (Wispr Flow Clone 에 ON)
   - 부여 후 앱 **완전 재시작**

이제 Launchpad / 독에서 🎙️ 아이콘 클릭으로 실행할 수 있습니다.

> 💡 불특정 다수에게 배포하려면 Apple Developer 계정($99/년)으로 **코드 서명 + 공증(notarization)** 이 필요합니다. 개인/팀 내 사용이라면 위 우회 방법으로 충분합니다.

---

## 🎯 사용법

1. 텍스트를 입력할 앱(TextEdit, 브라우저 입력창, 메신저 등)에 **커서**를 둡니다.
2. 설정한 단축키(기본 **오른쪽 Command ⌘**)를 **누르고 있는 동안** 말합니다.
3. **떼면** → 변환된 텍스트가 커서에 붙여넣어지고, 앱 기록 리스트 최상단에 추가됩니다.

### 설정 (앱 UI)

- **단축키**: Right Cmd / Right Option / Left Cmd / Left Option / Right·Left Control
- **Whisper 모델 경로**: 입력 후 저장

---

## 🛠 트러블슈팅

| 증상 | 원인 / 해결 |
|---|---|
| `FATAL: CGEventTap creation failed` | 입력 모니터링 권한 미부여 |
| 녹음 후 빈 결과 / `AVAudioRecorder start failed` | 마이크 권한 미부여 |
| 변환은 되는데 안 붙음 | 손쉬운 사용 권한 미부여 |
| `db: ...` status | Postgres 미기동 → `docker compose up -d db` |
| 창이 안 보임 | 메뉴바 마이크 아이콘 클릭 또는 앱 재실행 |

기록 확인:
```bash
docker compose exec db psql -U wispr -d wispr -c 'SELECT * FROM transcriptions ORDER BY id DESC LIMIT 10;'
```

---

## 📄 라이선스

개인 학습용 프로젝트.
