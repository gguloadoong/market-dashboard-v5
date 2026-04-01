// 파생 시그널 위젯 — PCR · 펀딩비 · 호가창 불균형 + 해석 텍스트
import { useState, useEffect } from 'react';
import { fetchPCR, fetchFundingRate, fetchOrderFlow } from '../../../api/_gateway';
import { THRESHOLDS } from '../../../constants/signalThresholds';

// PCR 수치 → 해석 텍스트 (모든 구간 커버)
function getPcrInterpretation(pcr) {
  if (pcr == null) return { text: '—', color: '#B0B8C1' };
  const T = THRESHOLDS.PCR;
  if (pcr > T.BULLISH_STRONG) return { text: '극도 공포 — 역발상 매수 구간', color: '#2AC769' };
  if (pcr > T.BULLISH)        return { text: '공포 — 역발상 매수 신호', color: '#2AC769' };
  if (pcr > T.CAUTION_HIGH)   return { text: '공포 징후 — 주목', color: '#FF9500' };
  if (pcr >= T.CAUTION_LOW)   return { text: '균형 — 관망', color: '#8B95A1' };
  if (pcr >= T.BEARISH)       return { text: '탐욕 징후 — 주의', color: '#FF9500' };
  if (pcr >= T.BEARISH_STRONG)return { text: '탐욕 — 역발상 매도 신호', color: '#F04452' };
  return { text: '극도 탐욕 — 역발상 매도 구간', color: '#F04452' };
}

// 펀딩비 → 해석 텍스트
function getFundingInterpretation(ratePercent) {
  if (ratePercent == null) return { text: '—', color: '#B0B8C1' };
  const T = THRESHOLDS.FUNDING;
  if (ratePercent > T.BEARISH_STRONG) return { text: '강한 롱 과열 — 조정 주의', color: '#F04452' };
  if (ratePercent > T.BEARISH)        return { text: '롱 과열 — 조정 가능', color: '#F04452' };
  if (ratePercent > T.CAUTION_BULL)   return { text: '과열 징후 — 모니터링', color: '#FF9500' };
  if (ratePercent < T.BULLISH_STRONG) return { text: '강한 숏 과열 — 반등 가능', color: '#2AC769' };
  if (ratePercent < T.BULLISH)        return { text: '숏 과열 — 반등 주목', color: '#2AC769' };
  if (ratePercent < T.CAUTION_BEAR)   return { text: '숏 과열 징후 — 모니터링', color: '#FF9500' };
  return { text: '균형 — 중립', color: '#8B95A1' };
}

// 호가창 불균형 → 해석 텍스트
function getOrderFlowInterpretation(imbalance) {
  if (imbalance == null) return { text: '—', color: '#B0B8C1' };
  const T = THRESHOLDS.ORDER_FLOW;
  const abs = Math.abs(imbalance);
  const side = imbalance > 0 ? '매수' : '매도';
  if (abs >= T.STRONG)   return { text: `${side}벽 강세 (${(abs * 100).toFixed(0)}%)`, color: imbalance > 0 ? '#2AC769' : '#F04452' };
  if (abs >= T.CAUTION)  return { text: `${side}세 우세 (${(abs * 100).toFixed(0)}%)`, color: imbalance > 0 ? '#1A7A45' : '#C0392B' };
  return { text: '균형', color: '#8B95A1' };
}

function timeAgo(ts) {
  if (!ts) return '';
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return '방금';
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
  return `${Math.floor(diff / 3600)}시간 전`;
}

export default function DerivativesWidget() {
  const [pcr, setPcr]         = useState(null);
  const [btcFunding, setBtcFunding] = useState(null);
  const [ethFunding, setEthFunding] = useState(null);
  const [orderFlow, setOrderFlow]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [fetchedAt, setFetchedAt]   = useState(null);
  const [, setTick] = useState(0); // 시간 표시 1분 갱신

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [pcrData, btcData, ethData, ofData] = await Promise.allSettled([
          fetchPCR(),
          fetchFundingRate('BTCUSDT'),
          fetchFundingRate('ETHUSDT'),
          fetchOrderFlow('BTCUSDT'),
        ]);
        if (cancelled) return;
        if (pcrData.status === 'fulfilled') setPcr(pcrData.value);
        if (btcData.status === 'fulfilled') setBtcFunding(btcData.value);
        if (ethData.status === 'fulfilled') setEthFunding(ethData.value);
        if (ofData.status === 'fulfilled')  setOrderFlow(ofData.value);
        setFetchedAt(Date.now());
      } catch {}
      finally { if (!cancelled) setLoading(false); }
    }
    load();
    const poll   = setInterval(() => { if (!document.hidden) load(); }, 5 * 60 * 1000);
    const ticker = setInterval(() => setTick(t => t + 1), 60 * 1000);
    return () => { cancelled = true; clearInterval(poll); clearInterval(ticker); };
  }, []);

  if (loading) return (
    <div data-testid="derivatives-widget" className="bg-white rounded-2xl border border-[#F2F4F6] shadow-sm p-4">
      <div className="text-[12px] font-bold text-[#191F28] mb-3">파생 시그널</div>
      <div className="text-[11px] text-[#B0B8C1]">로딩 중...</div>
    </div>
  );

  const hasData = pcr?.pcr != null || btcFunding?.ratePercent != null || ethFunding?.ratePercent != null;
  // API 없는 환경(로컬 dev)에서도 data-testid 유지 — 빈 상태로 표시
  if (!hasData) return (
    <div data-testid="derivatives-widget" className="bg-white rounded-2xl border border-[#F2F4F6] shadow-sm p-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[13px] font-bold text-[#191F28]">파생 시그널</span>
      </div>
      <div className="text-[11px] text-[#B0B8C1]">데이터를 가져오는 중입니다</div>
    </div>
  );

  const pcrInterp = getPcrInterpretation(pcr?.pcr);

  return (
    <div data-testid="derivatives-widget" className="bg-white rounded-2xl border border-[#F2F4F6] shadow-sm p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-bold text-[#191F28]">파생 시그널</span>
          <span className="text-[10px] text-[#B0B8C1]">PCR · 펀딩비 · 호가</span>
        </div>
        {fetchedAt && (
          <span className="text-[10px] text-[#B0B8C1]">{timeAgo(fetchedAt)}</span>
        )}
      </div>

      <div className="space-y-3">
        {/* PCR */}
        {pcr?.pcr != null && (
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] text-[#8B95A1]">S&P500 Put/Call Ratio</span>
              <span className="text-[12px] font-bold text-[#191F28]">{pcr.pcr.toFixed(2)}</span>
            </div>
            <p className="text-[11px] font-medium" style={{ color: pcrInterp.color }}>{pcrInterp.text}</p>
          </div>
        )}

        {/* BTC 펀딩비 */}
        {btcFunding?.ratePercent != null && (() => {
          const interp = getFundingInterpretation(btcFunding.ratePercent);
          const sign = btcFunding.ratePercent > 0 ? '+' : '';
          return (
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] text-[#8B95A1]">BTC 펀딩비</span>
                <span className="text-[12px] font-bold" style={{ color: interp.color }}>
                  {sign}{btcFunding.ratePercent.toFixed(3)}%
                </span>
              </div>
              <p className="text-[11px] font-medium" style={{ color: interp.color }}>{interp.text}</p>
            </div>
          );
        })()}

        {/* ETH 펀딩비 */}
        {ethFunding?.ratePercent != null && (() => {
          const interp = getFundingInterpretation(ethFunding.ratePercent);
          const sign = ethFunding.ratePercent > 0 ? '+' : '';
          return (
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] text-[#8B95A1]">ETH 펀딩비</span>
                <span className="text-[12px] font-bold" style={{ color: interp.color }}>
                  {sign}{ethFunding.ratePercent.toFixed(3)}%
                </span>
              </div>
              <p className="text-[11px] font-medium" style={{ color: interp.color }}>{interp.text}</p>
            </div>
          );
        })()}

        {/* BTC 호가창 불균형 */}
        {orderFlow?.imbalance != null && (() => {
          const interp = getOrderFlowInterpretation(orderFlow.imbalance);
          const bidPct = orderFlow.bidVolume / (orderFlow.bidVolume + orderFlow.askVolume) * 100;
          return (
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] text-[#8B95A1]">BTC 호가 불균형</span>
                <span className="text-[11px] text-[#191F28]">매수 {bidPct.toFixed(0)}%</span>
              </div>
              <p className="text-[11px] font-medium" style={{ color: interp.color }}>{interp.text}</p>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
