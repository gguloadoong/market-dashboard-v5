# Code Review: feature/#33-ai-debate-json-fix
- date: 2026-04-04T03:10:51Z
- commit: 050fe0cddddc1cc4a59a22c61554d6f8e100363e
- diff_lines:       43

## Code Review: `api/ai-debate.js` — Inner JSON 재파싱 로직

---

**[HIGH] Regex fallback이 greedy하여 잘못된 JSON을 매칭할 수 있음** (L116-118)

```js
const m = innerText.match(/\{[\s\S]*\}/);
```

`[\s\S]*`는 greedy라서 텍스트에 여러 `{...}` 블록이 있을 때 첫 `{`부터 마지막 `}`까지 전부 매칭한다. 예: `{"a":1} some text {"b":2}` → `{"a":1} some text {"b":2}` 전체를 매칭하여 `JSON.parse` 실패. lazy `[\s\S]*?`로 바꾸면 반대로 너무 짧게 잘림. 현실적으로 LLM 출력에서 이 케이스가 드물고, `JSON.parse` 실패 시 catch로 빠지므로 치명적이진 않지만, 의도와 다르게 동작할 여지가 있다.

**[STYLE] 중첩 try-catch가 3단계로 읽기 어려움** (L112-125)

외부 `try { ... } catch` 안에 `try { JSON.parse } catch { regex → JSON.parse }` 패턴. 헬퍼 함수로 추출하면 가독성이 올라간다:

```js
function tryParseJSON(text) {
  try { return JSON.parse(text); } catch {}
  const m = text.match(/\{[\s\S]*\}/);
  if (m) try { return JSON.parse(m[0]); } catch {}
  return null;
}
```

**[STYLE] `!= null` vs `!== undefined`** (L131-132)

```js
...(innerResult.verdict  != null && { verdict:    innerResult.verdict }),
...(innerResult.confidence != null && { confidence: innerResult.confidence }),
```

`!= null`은 `undefined`와 `null` 모두 걸러내므로 의도에 맞다. 다만 프로젝트 내 다른 곳에서 `!==` strict 비교를 쓰고 있다면 일관성 확인 필요.

**[PERF] `for...of` 루프에서 `break` 후 `innerResult` 재사용 — 문제 없음**

첫 번째 유효한 inner JSON을 찾으면 즉시 break하므로 불필요한 반복 없음. 적절하다.

**긍정적 포인트:**
- 화이트리스트 방식 병합(`messages`, `verdict`, `confidence`만)으로 prototype pollution 방지 — 좋은 판단
- `innerResult`가 `messages.length >= 2` 검증을 거쳐야 채택되므로 잘못된 JSON을 무분별하게 수용하지 않음
- 기존 `parsed`의 나머지 필드를 spread로 보존하면서 inner 값으로 덮어쓰는 구조가 깔끔함

---

**VERDICT: PASS**

regex greedy 매칭은 개선 여지가 있으나 catch로 안전하게 처리되고, 전체적으로 defensive하게 작성되었다. 블로킹 이슈 없음.
