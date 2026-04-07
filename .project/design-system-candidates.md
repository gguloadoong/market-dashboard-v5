---
작성자: document-specialist (Claude Opus)
작성일: 2026-04-07
상태: 리서치 완료 — 대표 검토 대기
근거: 웹 검색 (각 공식 사이트, GitHub, npm, bundlephobia), design-system.md, ADR-015/016, quality-baseline.md
---

# 마켓레이더 v5 — 디자인 시스템 후보 평가서

## 현재 상태 요약

| 항목 | 값 |
|------|-----|
| React | 19.2.4 |
| TailwindCSS | 3.4.x |
| Vite | 8.x |
| 번들 기준선 (gzip) | **750 KB 이하** (quality-baseline.md) |
| 현재 디자인 토큰 | `design-system.md` 자체 정의 (CDS 구조 참조) |
| CDS 상태 | `@coinbase/cds-web` 설치됨, ThemeProvider 미사용 (React 19 비호환, ADR-015) |
| 색상 원칙 | 빨강=상승 `#F04452`, 파랑=하락 `#1764ED` (협상 불가) |
| 다크모드 | 토큰 미정의 (P2 이슈) |

---

## 1. 후보별 상세 평가

---

### 1-1. shadcn/ui

| 기준 | 평가 | 점수 |
|------|------|:----:|
| **라이선스** | MIT (오픈소스 컴포넌트). Pro Blocks는 유료 구독이나 불필요 | **A** |
| **React 19** | 공식 지원. React 19 + Tailwind v4 문서 별도 제공 | **A** |
| **TailwindCSS** | Tailwind 네이티브. v3/v4 모두 지원. 현재 프로젝트 Tailwind 3.4와 완전 호환 | **A** |
| **다크모드** | CSS 변수 기반 dark/light 테마 내장. `dark:` 클래스로 전환 | **A** |
| **커스터마이징** | 소스 코드를 복사하여 직접 소유. 한국 색상 토큰 적용 자유도 최상 | **A** |
| **번들 크기** | ~35-50 KB gzip (사용 컴포넌트만 포함). 번들 기준선 여유 | **A** |
| **금융 대시보드** | Table, Card, Badge, Tabs, Dialog 등 기본 패턴 제공. 차트는 별도 | **B+** |
| **커뮤니티** | 2026년 가장 인기 있는 React 컴포넌트 컬렉션. GitHub 80k+ stars | **A** |
| **AI 슬롭 방지** | 미니멀 디자인. 단, 너무 많은 프로젝트가 사용해 "shadcn 느낌" 발생 가능 | **B+** |

> **핵심 장점**: Tailwind 네이티브, 코드 소유권, 번들 최소, 커스터마이징 자유도 최고
> **핵심 단점**: 컴포넌트 유지보수 부담(직접 소유), 복잡한 테이블(정렬/필터/페이지네이션) 직접 구현 필요
>
> **출처**: [shadcn/ui 공식](https://ui.shadcn.com/) · [Tailwind v4 가이드](https://ui.shadcn.com/docs/tailwind-v4) · [React 19 문서](https://ui.shadcn.com/docs/react-19) · [라이선스](https://www.shadcn.io/license)

---

### 1-2. Radix UI / Radix Themes

| 기준 | 평가 | 점수 |
|------|------|:----:|
| **라이선스** | MIT (WorkOS 유지보수) | **A** |
| **React 19** | Primitives + Themes 모두 React 19 지원 완료. @radix-ui/themes 3.3.0 (2026-03) | **A** |
| **TailwindCSS** | Primitives는 unstyled → Tailwind 자유롭게 적용. Themes는 자체 CSS 변수 사용 → 혼용 시 충돌 가능 | **B+** |
| **다크모드** | Themes: `appearance="dark"` prop으로 전환. Primitives: 직접 구현 | **A** |
| **커스터마이징** | Primitives는 완전 자유. Themes는 제한적 (사전 정의 색상 스케일) | **B** |
| **번들 크기** | Primitives: 개별 패키지, 매우 가벼움 (~5-15 KB). Themes: ~60-80 KB | **A** |
| **금융 대시보드** | 기본 UI 패턴 제공. 금융 특화 컴포넌트 없음 | **B** |
| **커뮤니티** | shadcn/ui의 기반 라이브러리. WorkOS가 유지보수 → 안정적 | **A** |
| **AI 슬롭 방지** | Primitives는 unstyled이므로 독자 디자인 가능. Themes는 기본 스타일이 존재 | **A** |

> **핵심 장점**: 접근성 최고 수준, shadcn/ui의 기반이므로 함께 사용 가능, 번들 경량
> **핵심 단점**: Themes를 쓰면 Tailwind와 이중 스타일링 문제 발생. 단독으로는 컴포넌트 수 부족
>
> **출처**: [Radix UI 공식](https://www.radix-ui.com/) · [Themes Releases](https://www.radix-ui.com/themes/docs/overview/releases) · [React 19 이슈 #2900](https://github.com/radix-ui/primitives/issues/2900) · [GitHub](https://github.com/radix-ui)

---

### 1-3. Mantine (v9)

| 기준 | 평가 | 점수 |
|------|------|:----:|
| **라이선스** | MIT | **A** |
| **React 19** | v9.0 (2026-03-31) — **React 19.2+ 필수**. useEffectEvent, Activity 등 React 19 API 적극 활용 | **A** |
| **TailwindCSS** | CSS Modules 기반 자체 스타일링. Tailwind와 공존 가능하나 이중 시스템 | **B** |
| **다크모드** | ColorSchemeProvider + useMantineColorScheme. 네이티브 다크모드 지원 | **A** |
| **커스터마이징** | MantineProvider theme 객체로 색상/폰트/간격 오버라이드. 한국 색상 적용 가능 | **A-** |
| **번들 크기** | @mantine/core ~80-120 KB gzip. 전체 패키지 사용 시 더 증가 | **B** |
| **금융 대시보드** | Table, Badge, Card, NumberFormatter, Progress, Stepper 등 풍부. **@mantine/schedule (v9 신규)** | **A** |
| **커뮤니티** | GitHub 27k+ stars. 활발한 릴리스 (v9 방금 출시) | **A** |
| **AI 슬롭 방지** | 엔터프라이즈/어드민 느낌. 기본 스타일이 깔끔하지만 "Mantine 스럽다"는 인식 있음 | **B** |

> **핵심 장점**: 컴포넌트 수 최다급 (120+), 금융 대시보드 패턴 풍부, React 19 최신 기능 활용
> **핵심 단점**: Tailwind와 이중 스타일 시스템, 번들 크기 기준선(750KB) 압박, 기존 Tailwind 코드와 스타일 충돌 위험
>
> **출처**: [Mantine 공식](https://mantine.dev/) · [v9.0.0 변경사항](https://alpha.mantine.dev/changelog/9-0-0/) · [GitHub](https://github.com/mantinedev/mantine) · [React 19 논의 #6316](https://github.com/orgs/mantinedev/discussions/6316)

---

### 1-4. Ant Design (v6)

| 기준 | 평가 | 점수 |
|------|------|:----:|
| **라이선스** | MIT | **A** |
| **React 19** | v6 (2025-11)부터 React 19 기본 지원. React 18+ 필수 | **A** |
| **TailwindCSS** | CSS-in-JS (cssinjs). Tailwind와 공존 가능하나 완전 별도 시스템 | **C+** |
| **다크모드** | ConfigProvider + algorithm.darkAlgorithm. 네이티브 다크모드 | **A** |
| **커스터마이징** | Design Token 시스템으로 색상 오버라이드 가능. 하지만 중국 디자인 언어 탈피 어려움 | **B-** |
| **번들 크기** | 트리 셰이킹 적용 시 ~120 KB core (40 KB gzip). 20+ 컴포넌트 사용 시 **~380 KB gzip** | **C** |
| **금융 대시보드** | Table (정렬/필터/페이지네이션 내장), Statistic, Badge, Tag, Descriptions 등 매우 풍부 | **A+** |
| **커뮤니티** | GitHub 94k+ stars. 알리바바 유지보수. 중국어 문서 우선 | **A** |
| **AI 슬롭 방지** | "Ant Design 느낌"이 매우 강함. 어드민 패널 기본 디자인 = 차별화 어려움 | **C** |

> **핵심 장점**: 금융/데이터 컴포넌트 최강 (Table, Statistic), 한국어 커뮤니티 존재
> **핵심 단점**: 번들 과대 (750KB 기준선 위협), Tailwind와 완전 이질적 스타일 시스템, "어드민 템플릿" 느낌 탈피 불가, 중국어 UX 관습 기반
>
> **출처**: [Ant Design 공식](https://ant.design/) · [v6 마이그레이션](https://ant.design/docs/react/migration-v6/) · [번들 최적화](https://ant.design/docs/blog/tree-shaking/) · [v6 발표](https://dev.to/zombiej/ant-design-60-is-released-bfa)

---

### 1-5. MUI (Material UI v6)

| 기준 | 평가 | 점수 |
|------|------|:----:|
| **라이선스** | Core: MIT. MUI X (DataGrid Pro 등): 상업 라이선스 (연 $180/dev~) | **B+** |
| **React 19** | v6에서 React 19 호환 확인. Pigment CSS 도입으로 RSC 대응 | **A** |
| **TailwindCSS** | Emotion/styled-components 기반. Tailwind와 공존 가능하나 이중 시스템. Pigment CSS(opt-in)로 개선 중 | **C+** |
| **다크모드** | ThemeProvider + mode 전환. CSS 변수 네이티브 지원 (v6) | **A** |
| **커스터마이징** | Theme 객체 깊은 커스터마이징 가능. 하지만 Material Design 탈피에 상당한 노력 필요 | **B** |
| **번들 크기** | ~120-180 KB gzip. v6에서 25% 감소했으나 여전히 대형 | **C+** |
| **금융 대시보드** | DataGrid (MIT 버전 제한적), Table, Card, Chip 등 풍부. Pro DataGrid는 유료 | **A-** |
| **커뮤니티** | GitHub 95k+ stars. 가장 큰 React UI 커뮤니티 | **A** |
| **AI 슬롭 방지** | Material Design = Google 느낌. 가장 흔한 UI → "기본 템플릿" 인상 강함 | **C** |

> **핵심 장점**: 가장 큰 생태계, DataGrid Pro(유료) 강력, 문서 최고 수준
> **핵심 단점**: 번들 대형, Material Design 탈피 어려움, Tailwind와 이질적, DataGrid Pro 유료
>
> **출처**: [MUI 공식](https://mui.com/) · [v6 마이그레이션](https://mui.com/material-ui/migration/upgrade-to-v6/) · [라이선스](https://mui.com/x/introduction/licensing/) · [v6 발표](https://mui.com/blog/material-ui-v6-is-out/)

---

### 1-6. Chakra UI (v3)

| 기준 | 평가 | 점수 |
|------|------|:----:|
| **라이선스** | MIT | **A** |
| **React 19** | v3에서 React 18/19 지원. 일부 immer 관련 이슈 보고 (workaround 존재) | **B+** |
| **TailwindCSS** | Panda CSS 기반 (v3 리라이트). Tailwind와 공존 가능하나 이중 시스템 | **C+** |
| **다크모드** | ColorMode 시스템 내장 | **A** |
| **커스터마이징** | Theme tokens으로 색상 오버라이드 가능 | **B+** |
| **번들 크기** | ~70-100 KB gzip | **B** |
| **금융 대시보드** | 기본 컴포넌트 제공. 금융 특화 없음 | **B** |
| **커뮤니티** | GitHub 38k+ stars. v2→v3 마이그레이션으로 커뮤니티 분산 | **B+** |
| **AI 슬롭 방지** | v3 스타일이 Panda CSS로 변경되어 독자적이나 아직 생태계 미성숙 | **B** |

> **핵심 장점**: DX 좋음, 접근성 우수, Ark UI 기반 안정적 아키텍처
> **핵심 단점**: v3 리라이트로 생태계 재구축 중, Panda CSS가 Tailwind와 충돌, v2→v3 호환 단절
>
> **출처**: [Chakra UI 공식](https://chakra-ui.com/) · [v3 발표](https://chakra-ui.com/blog/announcing-v3) · [v2 vs v3](https://chakra-ui.com/blog/chakra-v2-vs-v3-a-detailed-comparison) · [React 19 이슈 #8519](https://github.com/chakra-ui/chakra-ui/issues/8519)

---

### 1-7. HeroUI (구 NextUI v3)

| 기준 | 평가 | 점수 |
|------|------|:----:|
| **라이선스** | MIT | **A** |
| **React 19** | v3에서 React 19 + Tailwind v4 지원 | **A** |
| **TailwindCSS** | Tailwind 네이티브. tailwind-variants 사용 | **A** |
| **다크모드** | Tailwind dark mode + 자체 테마 시스템 | **A** |
| **커스터마이징** | Tailwind 기반이라 커스터마이징 용이. 한국 색상 토큰 적용 가능 | **A-** |
| **번들 크기** | v3에서 Framer Motion 제거 → CSS 네이티브 애니메이션. 개별 패키지 분리 | **B+** |
| **금융 대시보드** | Table, Card, Badge 등 기본 제공. 금융 특화 없음 | **B** |
| **커뮤니티** | GitHub 23k+ stars. NextUI→HeroUI 리브랜딩으로 인지도 분산 | **B** |
| **AI 슬롭 방지** | 모던하고 예쁜 기본 스타일. "NextUI/HeroUI 느낌" 존재 | **B** |

> **핵심 장점**: Tailwind 네이티브, 예쁜 기본 스타일, 번들 개선
> **핵심 단점**: 리브랜딩 혼란 (NextUI→HeroUI), 금융 특화 부족, 컴포넌트 수 제한적
>
> **출처**: [HeroUI 공식](https://heroui.com/) · [v3 릴리스](https://heroui.com/docs/react/releases/v3-0-0) · [GitHub](https://github.com/heroui-inc)

---

### 1-8. Tremor

| 기준 | 평가 | 점수 |
|------|------|:----:|
| **라이선스** | Apache-2.0 (코어) + MIT (Tremor Blocks, Vercel 인수 후 오픈소스화) | **A** |
| **React 19** | **베타 단계**. 차세대 npm 패키지에서 React 19 + Tailwind v4 지원 발표. 안정판 미출시 | **C+** |
| **TailwindCSS** | Tailwind + Radix UI 기반. Tailwind 네이티브 | **A** |
| **다크모드** | Tailwind dark mode 활용 | **A** |
| **커스터마이징** | Tailwind 클래스 오버라이드 가능 | **B+** |
| **번들 크기** | 안정판(3.18.7)은 Recharts/headlessui 의존 → 무거움. 차세대 미확인 | **C** |
| **금융 대시보드** | **대시보드 전문**. AreaChart, BarChart, KPI Card, Tracker, SparkChart 등 35+ 차트/대시보드 컴포넌트 | **A+** |
| **커뮤니티** | Vercel 인수 → 장기 유지보수 보장. 하지만 안정판 1년+ 미업데이트 | **B-** |
| **AI 슬롭 방지** | 대시보드 전문이라 차별화된 스타일 | **A-** |

> **핵심 장점**: 대시보드/차트 전문, Vercel 유지보수, Tailwind 네이티브
> **핵심 단점**: **React 19 안정판 미출시 (차단 이슈)**, 안정판 1년 방치, Recharts 의존 (이미 사용 중이라 중복)
>
> **출처**: [Tremor 공식](https://www.tremor.so/) · [Tremor npm](https://npm.tremor.so/) · [React 19 이슈 #1072](https://github.com/tremorlabs/tremor-npm/issues/1072) · [Vercel 인수 발표](https://vercel.com/blog/vercel-acquires-tremor) · [베타 발표 (X)](https://x.com/tremorlabs/status/1868722998590759361)

---

### 1-9. Park UI (Ark UI 기반)

| 기준 | 평가 | 점수 |
|------|------|:----:|
| **라이선스** | MIT (Park UI + Ark UI 모두) | **A** |
| **React 19** | 공식 문서에 React 19 호환 명시 없음. Ark UI가 Zag.js 기반이라 큰 문제 없을 가능성 높으나 미검증 | **B-** |
| **TailwindCSS** | Tailwind 플러그인 제공 (@park-ui/tailwind-plugin). Panda CSS도 지원 | **A-** |
| **다크모드** | 테마 시스템 내장 | **B+** |
| **커스터마이징** | Ark UI primitives + Tailwind 조합으로 자유도 높음 | **A-** |
| **번들 크기** | Ark UI 개별 패키지 → 가벼움 | **A-** |
| **금융 대시보드** | 45+ 접근성 컴포넌트. 금융 특화 없음 | **B** |
| **커뮤니티** | GitHub 2.2k stars. Chakra 팀이 유지보수하나 아직 소규모 | **C+** |
| **AI 슬롭 방지** | 차별화된 디자인. 사용 사례 적어 독특함 | **A** |

> **핵심 장점**: Tailwind 호환, 접근성 우수, 독자적 디자인
> **핵심 단점**: 소규모 커뮤니티, React 19 공식 검증 부족, 문서/예제 부족
>
> **출처**: [Park UI 공식](https://park-ui.com/) · [Ark UI 공식](https://ark-ui.com/) · [GitHub](https://github.com/cschroeter/park-ui) · [@park-ui/tailwind-plugin](https://www.npmjs.com/package/@park-ui/tailwind-plugin)

---

### 1-10. 커스텀 디자인 토큰 시스템 (현재 방식 유지)

| 기준 | 평가 | 점수 |
|------|------|:----:|
| **라이선스** | 해당 없음 (자체 코드) | **A** |
| **React 19** | 해당 없음 | **A** |
| **TailwindCSS** | 이미 Tailwind 네이티브 | **A** |
| **다크모드** | 직접 구현 필요 (현재 미구현, P2) | **C** |
| **커스터마이징** | 완전한 자유 | **A** |
| **번들 크기** | 추가 의존성 0 | **A** |
| **금융 대시보드** | 모든 컴포넌트 직접 구현 (이미 상당수 존재) | **B** |
| **커뮤니티** | 없음 (자체 유지보수) | **C** |
| **AI 슬롭 방지** | 완전한 독자 디자인 | **A** |

> **핵심 장점**: 의존성 0, 완전한 제어, 번들 최소, 현재 코드 변경 불필요
> **핵심 단점**: 다크모드 직접 구현 부담, 접근성(a11y) 직접 보장 필요, 새 컴포넌트마다 처음부터 제작
>
> **참조**: `/Users/bong/market-dashboard-v5/.project/design-system.md`

---

## 2. 라이선스 요약표

| 라이브러리 | 라이선스 | 상업적 사용 | 유료 부분 | 비고 |
|-----------|---------|:----------:|----------|------|
| **shadcn/ui** | MIT | **가능** | Pro Blocks (선택) | 핵심 컴포넌트 완전 무료 |
| **Radix UI/Themes** | MIT | **가능** | 없음 | WorkOS 유지보수 |
| **Mantine v9** | MIT | **가능** | 없음 | |
| **Ant Design v6** | MIT | **가능** | 없음 | |
| **MUI Core v6** | MIT | **가능** | MUI X Pro/Premium ($180~$600/dev/yr) | Core는 무료, DataGrid Pro 유료 |
| **Chakra UI v3** | MIT | **가능** | 없음 | |
| **HeroUI v3** | MIT | **가능** | 없음 | 구 NextUI |
| **Tremor** | Apache-2.0 + MIT | **가능** | 없음 (Vercel 인수 후 전면 오픈소스) | |
| **Park UI** | MIT | **가능** | 없음 | |

> **결론: 모든 후보가 상업적 사용 가능.** MUI만 고급 DataGrid에 유료 라이선스 존재.

---

## 3. 핵심 비교 매트릭스

| | React 19 | Tailwind 호환 | 번들 (gzip) | 다크모드 | 금융 적합성 | 커스터마이징 |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| **shadcn/ui** | A | A | ~35-50KB | A | B+ | A |
| **Radix Primitives** | A | A | ~5-15KB | 직접구현 | B | A |
| **Mantine v9** | A | B (이중) | ~80-120KB | A | A | A- |
| **Ant Design v6** | A | C+ (이질) | ~120-380KB | A | A+ | B- |
| **MUI v6** | A | C+ (이질) | ~120-180KB | A | A- | B |
| **Chakra UI v3** | B+ | C+ (Panda) | ~70-100KB | A | B | B+ |
| **HeroUI v3** | A | A | ~50-80KB | A | B | A- |
| **Tremor** | C+ (베타) | A | 미확정 | A | A+ | B+ |
| **Park UI** | B- (미검증) | A- | ~30-60KB | B+ | B | A- |
| **커스텀 (현행)** | A | A | 0KB | C (미구현) | B | A |

---

## 4. 추천 순위

### 1위: shadcn/ui + Radix Primitives (강력 추천)

**이유:**
- 현재 스택(Tailwind 3.4 + React 19)과 **완벽 호환**
- 코드를 직접 소유하므로 `design-system.md`의 한국 색상 토큰을 자유롭게 적용
- 번들 영향 최소 (~35-50 KB). 750KB 기준선 안전
- CDS 토큰 참조 방식(ADR-015)을 shadcn/ui 컴포넌트 + 자체 토큰으로 자연스럽게 전환
- 다크모드 CSS 변수 시스템 내장 → P2 다크모드 이슈 해결 용이
- 접근성(a11y): Radix Primitives 기반이므로 WCAG AA 자동 충족

**적용 전략:**
```
1. shadcn/ui init (Tailwind 3.4 호환 모드)
2. design-system.md 토큰을 shadcn CSS 변수로 매핑
3. 필요한 컴포넌트만 선택 설치 (Table, Card, Badge, Tabs, Dialog 등)
4. 기존 자체 컴포넌트는 점진적 마이그레이션 (한번에 교체 금지)
```

---

### 2위: 커스텀 디자인 토큰 유지 + shadcn/ui 부분 도입

**이유:**
- 현재 `design-system.md`가 이미 잘 정의되어 있음
- CDS 의존성(`@coinbase/cds-web`)만 제거하고 자체 토큰 시스템 유지
- 접근성/복잡한 인터랙션이 필요한 컴포넌트만 shadcn/ui에서 선택 도입 (Dialog, Dropdown, Tabs)
- 번들 영향 최소화

---

### 3위: Mantine v9 (대시보드 올인 시)

**이유:**
- 컴포넌트 수와 금융 대시보드 패턴이 가장 풍부
- React 19.2+ 네이티브 지원 (v9)
- 단, Tailwind와 이중 스타일 시스템 문제 + 번들 크기 주의

**채택 조건:** Tailwind를 포기하고 Mantine 올인으로 전환할 각오가 있을 때만.

---

## 5. 쓰지 말아야 할 것 + 이유

| 라이브러리 | 이유 | 심각도 |
|-----------|------|--------|
| **Ant Design v6** | 번들 380KB+(20개 컴포넌트 기준) → 750KB 기준선 위협. Tailwind와 완전 이질적 스타일 시스템. "중국 어드민" 디자인 탈피 불가. | **강력 비추** |
| **MUI v6** | 번들 120-180KB+. Material Design 탈피에 과도한 커스터마이징 비용. Tailwind와 이중 시스템. DataGrid Pro 유료. | **비추** |
| **Tremor (안정판)** | React 19 안정판 미출시 (차단 이슈). 안정판 3.18.7이 1년+ 방치 상태. 베타에 프로덕션 의존 위험. | **현시점 비추** (베타 안정화 후 차트 컴포넌트만 부분 도입 고려) |
| **Chakra UI v3** | Panda CSS 전환으로 Tailwind와 충돌. v2→v3 단절로 생태계 미성숙. React 19 일부 이슈 보고. | **비추** |
| **@coinbase/cds-web** | 이미 React 19 ThemeProvider 비호환 확인 (ADR-015). 토큰만 참조 중이나 361KB 번들 낭비. **제거 대상**. | **즉시 제거** |

---

## 6. TradingView 위젯 참고

| 항목 | 내용 |
|------|------|
| 공식 위젯 | [TradingView Widgets](https://www.tradingview.com/widget/) — iframe 삽입, 무료 사용 가능 (TradingView 로고 표시 의무) |
| React 래퍼 | `react-ts-tradingview-widgets` (v1.2.8, 1년 전 업데이트) — React 19 미검증 |
| 현재 프로젝트 | `lightweight-charts` (v5.1.0) 이미 사용 중 → TradingView 라이브러리와 동일 출처 |
| 추천 | 현재 `lightweight-charts` 유지. 추가 위젯 필요 시 공식 iframe 삽입 방식 고려 |

---

## 7. 최종 결론

```
추천: shadcn/ui + Radix Primitives
  ├─ Tailwind 네이티브 (기존 스택 100% 호환)
  ├─ React 19 공식 지원
  ├─ 번들 +35~50KB (750KB 기준선 안전)
  ├─ 코드 소유 → 한국 색상 토큰 자유 적용
  ├─ 다크모드 CSS 변수 내장
  └─ CDS 제거 후 자연스러운 대체

즉시 실행:
  1. @coinbase/cds-web 제거 (361KB 절감)
  2. shadcn/ui init + design-system.md 토큰 매핑
  3. 다크모드 토큰 정의 (P2 해소)
```

---

> **이 문서는 2026-04-07 기준 웹 검색 결과를 종합한 것입니다.**
> 각 라이브러리의 버전과 호환성은 빠르게 변하므로, 실제 도입 전 공식 문서에서 최신 상태를 재확인하세요.
