# 🎙️ KlakTalk v0.1.0

macOS용 push-to-talk 음성 받아쓰기 앱. 단축키를 누른 채 말하면 → 로컬 whisper.cpp로 변환 → 커서에 붙여넣기. "딸깍(Klak) + 톡(Talk)".

## ✨ 주요 기능
- 전역 단축키 **홀드=녹음 / 떼면=변환** (CGEventTap)
- 로컬 whisper.cpp 변환 — 오프라인, 데이터 외부 유출 ❌
- 화면 하단 **floating overlay** (녹음/변환/완료 상태 표시)
- 변환 기록 **SQLite** 저장
- **whisper-cli + 모델 자동 준비** (외부 설치 불필요)

## 💻 요구사항
- **macOS Apple Silicon (arm64)**
- **16GB+ 메모리 권장** (large-v3 모델 3GB)
- 인터넷 (첫 실행 시 모델 다운로드)

## 📥 설치
1. `.dmg` 더블클릭 → 🎙️ 앱을 **응용프로그램**으로 드래그
2. **Gatekeeper 우회** (코드 서명 안 함):
   - 응용프로그램에서 우클릭 → **열기** → "열기"
   - 또는 `xattr -cr "/Applications/KlakTalk.app"`
3. **macOS 권한 부여** — 시스템 설정 → 개인정보 보호 및 보안:
   - **입력 모니터링 · 손쉬운 사용 · 마이크** (모두 ON)
4. 첫 실행 시 **모델 자동 다운로드** (large-v3, ~3GB, overlay 진행률, 약 5~10분)

## ⌨️ 사용법
텍스트 입력창에 커서 → 오른쪽 **Command 홀드**하며 말하기 → 떼면 변환된 텍스트가 입력됩니다.
