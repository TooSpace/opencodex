# 한국어 요약

## 결론

1차 패치는 PR #1596의 기본동작을 유지합니다.

```text
비-Cursor 외부모델: code_mode_only + deferred discovery
Cursor: direct discovery
```

그 위에 정확한 provider/model 조합에만 적용되는 예외 설정을 추가합니다.

```json
{
  "routedToolDiscovery": "auto | deferred | direct",
  "modelRoutedToolDiscovery": {
    "model-id": "auto | deferred | direct"
  }
}
```

모델별 설정이 provider 설정보다 우선하며, Cursor는 잘못 `deferred`로 설정해도 `direct`로 고정합니다. `direct`는 플러그인 호환성용 탈출구이지 기본 최적화가 아닙니다. 전체 MCP 스키마가 첫 요청에 들어가 컨텍스트가 다시 커질 수 있기 때문입니다.

## 실제로 포함한 것

- 000–009: 현재 `dev`, #1522/#1529/#1596, Codex Code Mode, 비교 프로젝트 조사
- 010–015: 파일·함수 단위 1차 패치 설계
- 020–029: 단위·통합·설정·캐시·combo 테스트
- 030–039: Responses Lite/custom/namespace/tool-search 이력 conformance
- 040–049: Codex CLI/App, DeepSeek+Browser 정확 재현, Cursor, compaction/resume
- 050–059: payload·prompt cache 벤치마크
- 060–069: `search/describe/call` 3개 meta-tool 폴백
- 070–079: 단계적 배포·관측·canary
- 080–089: 롤백·장애 분류·설정 예시
- 090–093: 최종 권고·PR 스택·완료 기준·실행 순서
- `patches/apply-draft.mjs`: 현재 `dev` 코드 조각이 정확히 존재하는지 먼저 검사한 뒤 패치하는 스크립트
- `prototype/`: 의존성 없는 정책 프로토타입과 벤치마크
- `results/`: 실행 결과와 한계

## 이 환경에서 실제 실행한 검증

- 정책 프로토타입: 17개 테스트 전부 통과
- 패치 적용 스크립트: Node 문법 검사 통과
- 현재 코드 seam을 흉내 낸 합성 작업트리에서 `--check`와 적용 모두 통과
- 합성 250-tool payload:
  - 전체 스키마 직접 노출: 179,218 bytes
  - 이름·설명 인덱스: 52,393 bytes
  - 고정 meta-tool 3개: 744 bytes

이 수치는 실제 Codex 요청 토큰값이 아니라 구조 비교용 UTF-8 바이트입니다.

## 아직 실행하지 못한 것

이 실행환경은 외부 DNS가 차단되어 전체 OpenCodex 저장소를 복제하지 못했고 Bun도 없었습니다. 따라서 다음은 완료했다고 주장하지 않습니다.

- 전체 TypeScript typecheck
- OpenCodex 집중 Bun 테스트
- 전체 테스트 스위트
- 실제 Codex CLI/App + Browser 플러그인 E2E

실제 작업트리에서 실행할 명령은 `scripts/run-repo-validation.sh`에 묶었습니다.

## 적용 순서

```bash
node patches/apply-draft.mjs --check /path/to/opencodex
node patches/apply-draft.mjs /path/to/opencodex
cd /path/to/opencodex
/path/to/bundle/scripts/run-repo-validation.sh
```

적용 뒤에는 반드시 `git diff`를 리뷰하고, `042_codex_app_deepseek_browser.md`의 A/B 시나리오로 #1522의 정확한 조합을 확인해야 합니다.
