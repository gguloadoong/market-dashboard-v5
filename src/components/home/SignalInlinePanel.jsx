// 시그널 인라인 확장 패널 (P3-4)
// 시그널 카드 클릭 시 카드 아래에 펼쳐지는 결정 패널
// 트리거 요약 / 컨텍스트 / 연관 뉴스 / Sparkline / 액션 버튼
import { getEasyLabel } from '../../utils/signalLabel';
import Sparkline from '../../components/Sparkline';

export default function SignalInlinePanel({
  signal,
  narrative,
  relatedNews,
  matchedItem,
  isOpen,
  isWatched,
  onToggleWatch,
  onOpenChart,
  botMap,
}) {
  const accuracy = (botMap?.get(signal?.type)?.accuracy) ?? null;
  const totalFired = botMap.get(signal?.type)?.totalFired ?? 0;
  const showAccuracy = totalFired >= 30 && accuracy !== null;

  const news = Array.isArray(relatedNews) && relatedNews.length > 0 ? relatedNews[0] : null;
  const hasSparkline = matchedItem?.sparkline?.length >= 3;
  const positive = signal?.direction === 'bullish' ? true : signal?.direction === 'bearish' ? false : undefined;

  return (
    <div className={`grid transition-[grid-template-rows] duration-200 ${isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
      <div inert={!isOpen || undefined} className="overflow-hidden">
        <div className="bg-[#F7F8FA] dark:bg-[#1A2332] rounded-[10px] px-3 py-2.5 mt-1 mb-1">
          {/* 1. 트리거 요약 + 적중률 배지 */}
          <div className="flex items-center justify-between gap-2">
            <span className="text-[13px] font-semibold text-[#191F28] dark:text-[#F9FAFB] truncate">
              {getEasyLabel(signal)}
            </span>
            {showAccuracy && (
              <span
                className="flex-shrink-0 text-[11px] font-bold px-1.5 py-[2px] rounded-full"
                style={{
                  color: '#fff',
                  background: accuracy >= 70 ? '#2AC769' : accuracy >= 50 ? '#FF9500' : '#F04452',
                }}
              >
                {accuracy}%
              </span>
            )}
          </div>

          {/* 2. 컨텍스트 1줄 */}
          {narrative && (
            <div className="mt-1 text-[11px] text-[#8B95A1] leading-snug">
              {narrative}
            </div>
          )}

          {/* 3. 연관 뉴스 1건 */}
          {news && (
            <a
              href={news.link}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1.5 block text-[12px] text-[#1764ED] hover:underline truncate"
            title={news.title}
            >
              📰 {news.title}
            </a>
          )}

          {/* 4. Sparkline */}
          {hasSparkline && (
            <div className="mt-2">
              <Sparkline
                data={matchedItem.sparkline}
                width={120}
                height={36}
                positive={positive}
              />
            </div>
          )}

          {/* 5. 액션 row — 2버튼 가로 정렬 */}
          <div className="mt-2.5 flex items-center gap-2">
            <button
              onClick={onToggleWatch}
              className={`text-[12px] font-semibold px-3 py-1.5 rounded-full flex-1 ${
                isWatched
                  ? 'bg-[#2AC769] text-white'
                  : 'border border-[#D1D5DB] text-[#4E5968]'
              }`}
            >
              {isWatched ? '✓ 관심종목' : '+ 관심종목'}
            </button>
            <button
              onClick={onOpenChart}
              className="text-[12px] font-semibold px-3 py-1.5 rounded-full flex-1 bg-[#191F28] text-white"
            >
              차트 보기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
