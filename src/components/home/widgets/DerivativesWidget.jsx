// 파생 시그널 요약 위젯 — PCR + 펀딩비 수치 표시
import { useState, useEffect } from 'react';
import { fetchPCR, fetchFundingRate } from '../../../api/_gateway';

function FundingBadge({ data, label }) {
  if (!data?.ratePercent) return null;
  const r = data.ratePercent;
  const color = r > 0.05 ? '#F04452' : r < -0.05 ? '#2AC769' : '#8B95A1';
  const sign = r > 0 ? '+' : '';
  return (
    <div className="flex items-center justify-between">
      <span className="text-[11px] text-[#8B95A1]">{label} 펀딩비</span>
      <span className="text-[11px] font-bold" style={{ color }}>{sign}{r.toFixed(3)}%</span>
    </div>
  );
}

export default function DerivativesWidget() {
  const [pcr, setPcr] = useState(null);
  const [btcFunding, setBtcFunding] = useState(null);
  const [ethFunding, setEthFunding] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [pcrData, btcData, ethData] = await Promise.allSettled([
          fetchPCR(),
          fetchFundingRate('BTCUSDT'),
          fetchFundingRate('ETHUSDT'),
        ]);
        if (cancelled) return;
        if (pcrData.status === 'fulfilled') setPcr(pcrData.value);
        if (btcData.status === 'fulfilled') setBtcFunding(btcData.value);
        if (ethData.status === 'fulfilled') setEthFunding(ethData.value);
      } catch {}
      finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    const timer = setInterval(() => { if (!document.hidden) load(); }, 5 * 60 * 1000);
    return () => { cancelled = true; clearInterval(timer); };
  }, []);

  const pcrColor = pcr?.pcr > 1.2 ? '#2AC769' : pcr?.pcr < 0.7 ? '#F04452' : '#8B95A1';
  const pcrLabel = pcr?.pcr > 1.2 ? '공포' : pcr?.pcr < 0.7 ? '탐욕' : '중립';

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-[#F2F4F6] shadow-sm p-4">
        <div className="text-[12px] font-bold text-[#191F28] mb-3">파생 시그널</div>
        <div className="text-[11px] text-[#B0B8C1]">로딩 중...</div>
      </div>
    );
  }

  if (!pcr?.pcr && !btcFunding?.ratePercent && !ethFunding?.ratePercent) return null;

  return (
    <div className="bg-white rounded-2xl border border-[#F2F4F6] shadow-sm p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-[13px] font-bold text-[#191F28]">파생 시그널</span>
        <span className="text-[10px] text-[#B0B8C1]">PCR · 펀딩비</span>
      </div>
      <div className="space-y-2">
        {pcr?.pcr != null && (
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[11px] text-[#8B95A1]">S&P500 PCR </span>
              <span className="text-[10px] text-[#B0B8C1]">(역발상)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold" style={{ color: pcrColor }}>{pcr.pcr.toFixed(2)}</span>
              <span
                className="text-[9px] px-1.5 py-0.5 rounded-full font-medium"
                style={{ color: pcrColor, background: pcrColor + '18' }}
              >{pcrLabel}</span>
            </div>
          </div>
        )}
        <FundingBadge data={btcFunding} label="BTC" />
        <FundingBadge data={ethFunding} label="ETH" />
      </div>
      {pcr?.pcr > 1.2 && (
        <div className="mt-2 pt-2 border-t border-[#F2F4F6] text-[10px] text-[#2AC769]">
          PCR 고점 → 역발상 매수 구간 신호
        </div>
      )}
      {pcr?.pcr < 0.7 && (
        <div className="mt-2 pt-2 border-t border-[#F2F4F6] text-[10px] text-[#F04452]">
          PCR 저점 → 역발상 매도 구간 신호
        </div>
      )}
    </div>
  );
}
