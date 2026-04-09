// 공통 종목 로고 컴포넌트 — getLogoUrls fallback 체인 + 이니셜 아바타
import { useState } from 'react';
import { getLogoUrls, getAvatarBg } from './utils';

/**
 * @param {{ item: { symbol?: string, name?: string, _market?: string, market?: string, id?: string, image?: string }, size?: number }} props
 * size: px 단위 (기본 24)
 */
export default function TickerLogo({ item, size = 24 }) {
  const logoUrls = getLogoUrls(item);
  const [logoIdx, setLogoIdx] = useState(0);
  const bg = getAvatarBg(item.symbol);

  const sizeStyle = { width: size, height: size, minWidth: size, minHeight: size };
  const fontSize = Math.max(8, Math.round(size * 0.375));

  if (logoIdx < logoUrls.length) {
    return (
      <img
        src={logoUrls[logoIdx]}
        alt={item.symbol}
        onError={() => setLogoIdx(i => i + 1)}
        className="rounded-full object-contain bg-white border border-[#F2F4F6] p-0.5 flex-shrink-0"
        style={sizeStyle}
      />
    );
  }

  return (
    <div
      className="rounded-full flex items-center justify-center text-white font-bold flex-shrink-0"
      style={{ ...sizeStyle, background: bg, fontSize }}
    >
      {(item.symbol || '?').slice(0, 3).toUpperCase()}
    </div>
  );
}
