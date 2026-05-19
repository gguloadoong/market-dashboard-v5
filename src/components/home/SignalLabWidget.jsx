// 과거 시그널 흐름 위젯 — 마켓레이더가 감지한 신호들의 결과 요약
// (#325) 활성/검증중 시그널 시각적 분리 — "왜 적중률이 안 나오는지" 사용자가 즉시 이해
import { useState } from 'react';
import { useSignalAccuracy } from '../../hooks/useSignalAccuracy';
import { TYPE_META } from '../../engine/signalTypes';

// 적중률 공개를 위한 최소 발화 횟수
// TODO(후속): SignalBoardWidget(`totalFired >= 30`), SignalInlinePanel과 함께
// constants로 승격하여 단일 출처화 (#325 후속 별도 PR — Copilot 채택 메모)
const WARMUP_THRESHOLD = 30;
const WARM_VISIBLE_LIMIT = 8; // 활성 시그널 기본 노출 상한 (Gemini 채택 — UX 회귀 방지)

function accColor(pct) {
  if (pct == null) return '#B0B8C1';
  if (pct >= 70) return '#2AC769';
  if (pct >= 50) return '#FF9500';
  return '#F04452';
}

function getLabel(bot) {
  const meta = TYPE_META[bot.type];
  const easyLabel =
    typeof meta?.easyLabel === 'function'
      ? meta.easyLabel({})
      : meta?.easyLabel;
  return easyLabel || bot.label || bot.type;
}

// 단일 봇 행 — isWarm은 bot.totalFired에서 내부 파생 (Copilot 채택 — 단일 출처)
function BotRow({ bot }) {
  const label = getLabel(bot);
  const isWarm = bot.totalFired >= WARMUP_THRESHOLD;
  const remaining = WARMUP_THRESHOLD - bot.totalFired;

  return (
    <div className="flex items-center justify-between gap-2 py-1.5 px-2 rounded-lg hover:bg-gray-50 transition-colors">
      {/* 신호 이름 — flex-1 + min-w-0로 유연 truncate (Gemini 채택) */}
      <span
        className="flex-1 min-w-0 text-sm font-medium text-gray-800 truncate"
        title={label}
      >
        {label}
      </span>

      {/* 발화 횟수 */}
      <span className="text-xs text-gray-400 whitespace-nowrap shrink-0">
        {bot.totalFired}회 발화
      </span>

      {/* 결과 */}
      <div className="shrink-0 text-right">
        {!isWarm ? (
          // remaining ≥ 1 (warm 분기에서 걸러지므로 보장) — '검증 중' fallback 불필요 (Gemini 채택)
          <span className="text-xs text-gray-400 whitespace-nowrap">
            {remaining}회 더 누적
          </span>
        ) : (
          <span className="text-xs font-medium space-x-1">
            {bot.accuracy1h != null && (
              <span style={{ color: accColor(bot.accuracy1h) }}>
                1시간 {bot.accuracy1h}%
              </span>
            )}
            {bot.accuracy1h != null && bot.accuracy24h != null && (
              <span className="text-gray-300">·</span>
            )}
            {bot.accuracy24h != null && (
              <span style={{ color: accColor(bot.accuracy24h) }}>
                24시간 {bot.accuracy24h}%
              </span>
            )}
            {bot.accuracy1h == null && bot.accuracy24h == null && (
              <span className="text-gray-400">누적 중</span>
            )}
          </span>
        )}
      </div>
    </div>
  );
}

export default function SignalLabWidget() {
  const { bots, isLoading } = useSignalAccuracy();
  const [coldExpanded, setColdExpanded] = useState(false);
  const [warmExpanded, setWarmExpanded] = useState(false);

  // 발화 1회 이상만 표시 (isMissing/0회 봇은 제외)
  const filtered = (bots || []).filter((b) => b.totalFired >= 1);
  const warm = filtered
    .filter((b) => b.totalFired >= WARMUP_THRESHOLD)
    .sort((a, b) => (b.accuracy24h ?? -1) - (a.accuracy24h ?? -1));
  const cold = filtered
    .filter((b) => b.totalFired < WARMUP_THRESHOLD)
    .sort((a, b) => b.totalFired - a.totalFired);

  const warmVisible = warmExpanded ? warm : warm.slice(0, WARM_VISIBLE_LIMIT);
  const warmHasMore = warm.length > WARM_VISIBLE_LIMIT;
  const isEmpty = !isLoading && warm.length === 0 && cold.length === 0;

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
      {/* 헤더 */}
      <div className="mb-3">
        <div className="flex items-center gap-1.5">
          <span className="text-base font-semibold text-gray-900">📊 과거 시그널 흐름</span>
        </div>
        <p className="mt-0.5 text-xs text-gray-400">
          마켓레이더가 감지한 신호들의 결과예요
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-9 bg-gray-100 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : isEmpty ? (
        <p className="text-sm text-gray-400 text-center py-4">
          아직 집계된 시그널이 없어요
        </p>
      ) : (
        <>
          {/* ── 활성 시그널 — 적중률 공개 ── */}
          {warm.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 px-2 mb-1.5">
                <span className="text-[11px] font-semibold text-emerald-600">
                  ✓ 적중률 공개
                </span>
                <span className="text-[11px] text-gray-400">
                  {warm.length}종 · {WARMUP_THRESHOLD}회+ 발화 검증
                </span>
              </div>
              <div className="space-y-1">
                {warmVisible.map((bot) => (
                  <BotRow key={bot.type} bot={bot} />
                ))}
              </div>
              {warmHasMore && (
                <button
                  type="button"
                  onClick={() => setWarmExpanded((v) => !v)}
                  className="mt-2 w-full text-xs text-gray-400 hover:text-gray-600 transition-colors py-1"
                >
                  {warmExpanded ? '접기 ∧' : `${warm.length - WARM_VISIBLE_LIMIT}개 더보기 ∨`}
                </button>
              )}
            </div>
          )}

          {/* ── 검증 중 시그널 — 30회 누적 대기 ── */}
          {cold.length > 0 && (
            <div className={warm.length > 0 ? 'mt-3 pt-3 border-t border-gray-100' : ''}>
              <button
                type="button"
                onClick={() => setColdExpanded((v) => !v)}
                className="flex items-center justify-between w-full text-left mb-1 px-2 py-0.5 rounded hover:bg-gray-50 transition-colors"
                aria-expanded={coldExpanded}
              >
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-semibold text-gray-500">
                    ⏳ 검증 중
                  </span>
                  <span className="text-[11px] text-gray-400">
                    {cold.length}종 · {WARMUP_THRESHOLD}회 발화 후 적중률 공개
                  </span>
                </div>
                <span className="text-[10px] text-gray-400">
                  {coldExpanded ? '∧' : '∨'}
                </span>
              </button>
              {coldExpanded && (
                <div className="space-y-1 mt-1">
                  {cold.map((bot) => (
                    <BotRow key={bot.type} bot={bot} />
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
