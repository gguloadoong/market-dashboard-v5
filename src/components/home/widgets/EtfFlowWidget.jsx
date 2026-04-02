// BTC · ETH ETF 순유입/유출 위젯
import { useState, useEffect } from 'react';
import { fetchBtcEtfFlow } from '../../../api/_gateway';

function formatFlow(n) {
  if (n == null) return '—';
  const abs = Math.abs(n);
  if (abs >= 1000) return `${(n / 1000).toFixed(1)}B`;
  if (abs >= 1) return `${n.toFixed(0)}M`;
  return `${(n * 1000).toFixed(0)}K`;
}

function FlowBar({ value }) {
  if (value == null) return null;
  const isPositive = value >= 0;
  const pct = Math.min(Math.abs(value) / 500 * 100, 100); // 500M 기준 100%
  return (
    <div className="relative h-1.5 bg-[#F2F4F6] rounded-full overflow-hidden">
      <div
        className="absolute top-0 h-full rounded-full transition-all duration-500"
        style={{
          width: `${pct}%`,
          left: isPositive ? '50%' : `${50 - pct}%`,
          background: isPositive ? '#2AC769' : '#F04452',
        }}
      />
      <div className="absolute left-1/2 top-0 w-px h-full bg-[#D0D6DD]" />
    </div>
  );
}

export default function EtfFlowWidget() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBtcEtfFlow().then(d => {
      setData(d);
      setLoading(false);
    });
  }, []);

  if (loading) return (
    <div className="bg-white rounded-2xl border border-[#F2F4F6] shadow-sm p-3">
      <div className="text-[12px] font-bold text-[#191F28] mb-2">ETF 자금 흐름</div>
      <div className="space-y-2 animate-pulse">
        <div className="h-3 bg-[#F2F4F6] rounded w-3/4" />
        <div className="h-3 bg-[#F2F4F6] rounded w-1/2" />
      </div>
    </div>
  );

  const hasData = data?.btc?.length > 0 || data?.eth?.length > 0;
  if (!hasData) return (
    <div className="bg-white rounded-2xl border border-[#F2F4F6] shadow-sm p-3">
      <div className="text-[12px] font-bold text-[#191F28] mb-1">ETF 자금 흐름</div>
      <div className="text-[11px] text-[#B0B8C1]">데이터를 가져오는 중입니다</div>
    </div>
  );

  const latestBtc = data?.btc?.[data.btc.length - 1];
  const latestEth = data?.eth?.[data.eth.length - 1];

  return (
    <div className="bg-white rounded-2xl border border-[#F2F4F6] shadow-sm p-3">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[12px] font-bold text-[#191F28]">ETF 자금 흐름</span>
        <span className="text-[10px] text-[#B0B8C1]">BTC · ETH 현물 ETF</span>
      </div>

      <div className="space-y-3">
        {latestBtc && (
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] text-[#8B95A1]">비트코인 ETF</span>
              <span
                className="text-[12px] font-bold"
                style={{ color: (latestBtc.netFlow ?? 0) >= 0 ? '#2AC769' : '#F04452' }}
              >
                {(latestBtc.netFlow ?? 0) >= 0 ? '+' : ''}{formatFlow(latestBtc.netFlow)}
              </span>
            </div>
            <FlowBar value={latestBtc.netFlow} />
            <p className="text-[10px] text-[#B0B8C1] mt-0.5">
              {(latestBtc.netFlow ?? 0) >= 0 ? '기관 매수 유입 — 강세 신호' : '기관 매도 유출 — 약세 신호'}
            </p>
          </div>
        )}

        {latestEth && (
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] text-[#8B95A1]">이더리움 ETF</span>
              <span
                className="text-[12px] font-bold"
                style={{ color: (latestEth.netFlow ?? 0) >= 0 ? '#2AC769' : '#F04452' }}
              >
                {(latestEth.netFlow ?? 0) >= 0 ? '+' : ''}{formatFlow(latestEth.netFlow)}
              </span>
            </div>
            <FlowBar value={latestEth.netFlow} />
          </div>
        )}

        {/* 최근 5일 트렌드 */}
        {data?.btc?.length >= 2 && (
          <div className="pt-1 border-t border-[#F2F4F6]">
            <div className="text-[10px] text-[#8B95A1] mb-1">BTC ETF 최근 5일</div>
            <div className="flex items-end gap-1 h-8">
              {(data.btc.slice(-5)).map((d, i) => {
                const isPos = (d.netFlow ?? 0) >= 0;
                const h = Math.min(Math.abs(d.netFlow ?? 0) / 300 * 100, 100);
                return (
                  <div key={i} className="flex-1 flex flex-col items-center justify-end h-full">
                    <div
                      className="w-full rounded-sm"
                      style={{
                        height: `${Math.max(h, 4)}%`,
                        background: isPos ? '#2AC769' : '#F04452',
                        opacity: i === 4 ? 1 : 0.4 + i * 0.15,
                      }}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
