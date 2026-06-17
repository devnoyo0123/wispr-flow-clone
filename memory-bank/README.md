# Wispr Flow Clone — Memory Bank

Wispr Flow(맥/윈도우/iOS용 AI 음성 받아쓰기 앱)를 따라 만드는 클론 프로젝트.
마이크로 음성을 녹음 → 텍스트로 변환 → 커서 위치에 입력하는 데스크톱 앱.

## 원본(Wispr Flow) 핵심 동작
- 단축키를 누르면 녹음 시작, 자연스럽게 말하면 실시간으로 받아쓰기
- 클라우드 AI 모델로 전사(transcription) + 후처리("음/어" 등 필러 제거, 문장부호/포맷 정리)
- 모든 앱(Slack, Gmail, Docs, 코드 에디터 등) 위에서 범용으로 동작 — 현재 커서에 텍스트 삽입
- 100개 이상 언어 지원(한국어 포함), 타이핑보다 4배 빠름

참고: https://wisprflow.ai/features

## 문서 구조
- `README.md` — 본 가이드(최상위)
- `mvp-spec.md` — MVP 요구사항 (이번 작업 범위의 단일 소스 오브 트루스)
- `project-architecture.md` — 기술 스택 선택과 아키텍처 결정

## 현재 상태
- 2026-06-14: 프로젝트 시작, MVP 명세 작성
- 2026-06-16: 스택 확정 — **Electron + 네이티브 Swift 헬퍼 + 로컬 whisper.cpp + PostgreSQL**
- 2026-06-16: 스파이크 검증 완료 — 전역 키/PTT/붙여넣기/녹음/한국어 STT 전부 작동 확인
- 2026-06-16: BUILD 요구 — (1) 단축키 사용자 설정 (2) Postgres 영구 저장(docker-compose)
- 2026-06-16: **Electron 앱 1차 빌드 완료** — 헬퍼(Electron 자식) + db(pg) + whisper 연동 + UI(리스트/설정) 모두 구현. 비-GUI 검증 전부 통과(helper IPC·node-postgres·스키마·문법). 사용자 인터랙티브 PTT/권한 테스트 대기. 실행법: `app/README.md`
