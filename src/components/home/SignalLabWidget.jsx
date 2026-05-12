// 과거 시그널 흐름 위젯 — 마켓레이더가 감지한 신호들의 결과 요약
import { useState } from 'react';
import { useSignalAccuracy } from '../../hooks/useSignalAccuracy';
import { TYPE_META } from '../../engine/signalTypes';

const MAX_VISIBLE = 8;

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

function sortBots(bots) {
  const warm = bots
    .filter((b) => b.totalFired >= 30)
    .sort((a, b) => (b.accuracy24h ?? -1) - (a.accuracy24h ?? -1));
  const cold = bots
    .filter((b) => b.totalFired >= 1 && b.totalFired < 30)
    .sort((a, b) => b.totalFired - a.totalFired);
  return [...warm, ...cold];
}

export default function SignalLabWidget() {
  const { bots, isLoading } = useSignalAccuracy();
  const [expanded, setExpanded] = useState(false);

  // totalFired === 0 이거나 없으면 제외
  const filtered = (bots || []).filter((b) => b.totalFired >= 1);
  const sorted = sortBots(filtered);
  const visible = expanded ? sorted : sorted.slice(0, MAX_VISIBLE);
  const hasMore = sorted.length > MAX_VISIBLE;

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

      {/* 목록 */}
      {isLoading ? (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-9 bg-gray-100 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-4">
          아직 집계된 시그널이 없어요
        </p>
      ) : (
        <div className="space-y-1.5">
          {visible.map((bot) => {
            const isWarm = bot.totalFired >= 30;
            const label = getLabel(bot);

            return (
              <div
                key={bot.type}
                className="flex items-center justify-between gap-2 py-1.5 px-2 rounded-lg hover:bg-gray-50 transition-colors"
              >
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
                    <span className="text-xs text-gray-400">누적 중</span>
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
          })}
        </div>
      )}

      {/* 더보기 / 접기 */}
      {!isLoading && hasMore && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="mt-3 w-full text-xs text-gray-400 hover:text-gray-600 transition-colors py-1"
        >
          {expanded
            ? '접기 ∧'
            : `${sorted.length - MAX_VISIBLE}개 더보기 ∨`}
        </button>
      )}
    </div>
  );
}
