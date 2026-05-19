// 과거 시그널 흐름 위젯 — 마켓레이더가 감지한 신호들의 결과 요약
// (#325) 활성/검증중 시그널 시각적 분리 — "왜 적중률이 안 나오는지" 사용자가 즉시 이해
import { useState } from 'react';
import { useSignalAccuracy } from '../../hooks/useSignalAccuracy';
import { TYPE_META } from '../../engine/signalTypes';

const WARMUP_THRESHOLD = 30; // 적중률 공개를 위한 최소 발화 횟수

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

// 단일 봇 행 — 활성/검증중에 따라 우측 표시 분기
function BotRow({ bot, isWarm }) {
  const label = getLabel(bot);
  const remaining = Math.max(0, WARMUP_THRESHOLD - bot.totalFired);

  return (
    <div className="flex items-center justify-between gap-2 py-1.5 px-2 rounded-lg hover:bg-gray-50 transition-colors">
      {/* 신호 이름 */}
      <span
        className="text-sm font-medium text-gray-800 truncate"
        style={{ maxWidth: '42%' }}
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
          <span className="text-xs text-gray-400 whitespace-nowrap">
            {remaining > 0 ? `${remaining}회 더 누적` : '검증 중'}
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

  // 발화 1회 이상만 표시 (isMissing/0회 봇은 제외)
  const filtered = (bots || []).filter((b) => b.totalFired >= 1);
  const warm = filtered
    .filter((b) => b.totalFired >= WARMUP_THRESHOLD)
    .sort((a, b) => (b.accuracy24h ?? -1) - (a.accuracy24h ?? -1));
  const cold = filtered
    .filter((b) => b.totalFired < WARMUP_THRESHOLD)
    .sort((a, b) => b.totalFired - a.totalFired);

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
                {warm.map((bot) => (
                  <BotRow key={bot.type} bot={bot} isWarm />
                ))}
              </div>
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
                    <BotRow key={bot.type} bot={bot} isWarm={false} />
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
