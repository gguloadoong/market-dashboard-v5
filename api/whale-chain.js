// api/whale-chain.js — 온체인 고래 트랜잭션 감지 (Blockchair 무료 API, 키 불필요)
// GET /api/whale-chain?chain=bitcoin|ethereum
// Blockchair: 30 req/min 무료, USD 기준 직접 필터 가능
export const config = { runtime: 'edge' };

// ─── 공개된 주요 기관/거래소 지갑 주소 라벨 ─────────────────────
// 출처: Arkham, Etherscan Labels, 공개 온체인 분석
const KNOWN_WALLETS = {
  // ── 바이낸스 BTC ──
  '34xp4vRoCGJym3xR7yCVPFHoCNxv4Twseo': { label: 'Binance', type: 'exchange', flag: '🟡' },
  'bc1qgdjqv0av3q56jvd82tkdjpy7gdp9ut8tlqmgrpmv24sq90ecnvqqjwvw97': { label: 'Binance', type: 'exchange', flag: '🟡' },
  // ── 코인베이스 BTC ──
  '3FHNBLobJnbCPujupTM2QJAM29NSP5PQNP': { label: 'Coinbase', type: 'exchange', flag: '🔵' },
  'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh': { label: 'Coinbase', type: 'exchange', flag: '🔵' },
  // ── 블랙록 IBIT ETF ──
  '12ib7dApVFvg82TXKycWBNpN8kFyiAN1dr': { label: 'BlackRock IBIT', type: 'etf', flag: '⚫' },
  // ── 피델리티 FBTC ──
  'bc1qthkf8mlfyh4gkxfjupvpz0uvq8qzh6y0f2zqek': { label: 'Fidelity FBTC', type: 'etf', flag: '🟢' },
  // ── 마이크로스트래티지 ──
  '1P5ZEDWTKTFGxQjZphgWPQUpe554WKDfHQ': { label: 'MicroStrategy', type: 'institution', flag: '🟠' },
  // ── 바이낸스 ETH ──
  '0x28c6c06298d514db089934071355e5743bf21d60': { label: 'Binance', type: 'exchange', flag: '🟡' },
  '0x21a31ee1afc51d94c2efccaa2092ad1028285549': { label: 'Binance', type: 'exchange', flag: '🟡' },
  // ── 코인베이스 ETH ──
  '0xa9d1e08c7793af67e9d92fe308d5697fb81d3e43': { label: 'Coinbase', type: 'exchange', flag: '🔵' },
  '0x71660c4005ba85c37ccec55d0c4493e66fe775d3': { label: 'Coinbase', type: 'exchange', flag: '🔵' },
  // ── 크라켄 ETH ──
  '0x2910543af39aba0cd09dbb2d50200b3e800a63d2': { label: 'Kraken', type: 'exchange', flag: '🟣' },
  // ── OKX ETH ──
  '0x6cc5f688a315f3dc28a7781717a9a798a59fda7b': { label: 'OKX', type: 'exchange', flag: '🔴' },
  // ── 저스틴선 (Tron 창업자) ──
  '0x3ddfa8ec3052539b6c9549f12cea2c295cff5296': { label: 'Justin Sun', type: 'whale', flag: '🐳' },
  // ── Grayscale GBTC ──
  'bc1qfnklqr7cl30k4c43zxpfhgphlu5c7rx2f6lwre': { label: 'Grayscale GBTC', type: 'etf', flag: '🔷' },
  // ── 미국 정부 (DOJ 압수) ──
  'bc1qazcm763858nkj2dz7g0s2lu7n0ywjzwkg2tzz': { label: 'US Gov (DOJ)', type: 'government', flag: '🏛️' },
  // ── Tether Treasury ──
  '0x5754284f345afc66a98fbb0a0afe71e0f007b949': { label: 'Tether Treasury', type: 'issuer', flag: '💵' },
  // ── Wrapped Bitcoin ──
  '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599': { label: 'WBTC', type: 'bridge', flag: '🌉' },
  // ── Ethereum Foundation ──
  '0xde0b295669a9fd93d5f28d9ec85e40f4cb697bae': { label: 'Ethereum Foundation', type: 'foundation', flag: '💎' },
};

function labelAddress(addr) {
  if (!addr) return null;
  const lower = addr.toLowerCase();
  return KNOWN_WALLETS[addr] || KNOWN_WALLETS[lower] || null;
}

// ─── Blockchair BTC 대형 트랜잭션 ────────────────────────────
async function fetchBtcWhales(minUsd = 1_000_000, limit = 15) {
  const url = `https://api.blockchair.com/bitcoin/transactions`
    + `?q=output_total_usd(${minUsd}..)&limit=${limit}&s=time(desc)&fields=hash,time,output_total,output_total_usd,inputs,outputs`;
  const res = await fetch(url, {
    headers: { 'Accept': 'application/json' },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`Blockchair BTC ${res.status}`);
  const data = await res.json();
  return (data.data || []).map(tx => {
    const allAddrs = [
      ...(tx.inputs  || []).map(i => i.recipient),
      ...(tx.outputs || []).map(o => o.recipient),
    ];
    const knownLabels = allAddrs.map(labelAddress).filter(Boolean);
    const fromLabel = knownLabels[0];
    return {
      id:       `btc-${tx.hash?.slice(0, 12)}`,
      chain:    'bitcoin',
      symbol:   'BTC',
      hash:     tx.hash,
      time:     tx.time,
      amountUsd: tx.output_total_usd,
      fromLabel: fromLabel?.label || null,
      fromType:  fromLabel?.type  || null,
      fromFlag:  fromLabel?.flag  || null,
      knownParty: knownLabels.length > 0,
    };
  });
}

// ─── Blockchair ETH 대형 트랜잭션 ────────────────────────────
async function fetchEthWhales(minUsd = 1_000_000, limit = 15) {
  const url = `https://api.blockchair.com/ethereum/transactions`
    + `?q=value_usd(${minUsd}..)&limit=${limit}&s=time(desc)&fields=hash,time,value,value_usd,sender,recipient`;
  const res = await fetch(url, {
    headers: { 'Accept': 'application/json' },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`Blockchair ETH ${res.status}`);
  const data = await res.json();
  return (data.data || []).map(tx => {
    const fromLabel = labelAddress(tx.sender);
    const toLabel   = labelAddress(tx.recipient);
    return {
      id:        `eth-${tx.hash?.slice(0, 12)}`,
      chain:     'ethereum',
      symbol:    'ETH',
      hash:      tx.hash,
      time:      tx.time,
      amountUsd: tx.value_usd,
      from:      tx.sender,
      to:        tx.recipient,
      fromLabel: fromLabel?.label || null,
      fromType:  fromLabel?.type  || null,
      fromFlag:  fromLabel?.flag  || null,
      toLabel:   toLabel?.label   || null,
      toType:    toLabel?.type    || null,
      toFlag:    toLabel?.flag    || null,
      knownParty: !!(fromLabel || toLabel),
    };
  });
}

export default async function handler(req) {
  const { searchParams } = new URL(req.url);
  const rawMinUsd = parseInt(searchParams.get('min_usd') || '1000000', 10);
  const minUsd = (isNaN(rawMinUsd) || rawMinUsd < 0) ? 1_000_000 : Math.min(rawMinUsd, 100_000_000);
  const ALLOWED_CHAINS = ['bitcoin', 'ethereum', 'all'];
  const rawChain = searchParams.get('chain') || 'all';
  const chain = ALLOWED_CHAINS.includes(rawChain) ? rawChain : 'all';

  try {
    let txs = [];

    if (chain === 'bitcoin' || chain === 'all') {
      const btc = await fetchBtcWhales(minUsd).catch(() => []);
      txs.push(...btc);
    }
    if (chain === 'ethereum' || chain === 'all') {
      const eth = await fetchEthWhales(minUsd).catch(() => []);
      txs.push(...eth);
    }

    // 시간순 정렬
    txs.sort((a, b) => new Date(b.time) - new Date(a.time));

    return new Response(JSON.stringify({ transactions: txs.slice(0, 20) }), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=60',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (e) {
    return new Response(JSON.stringify({ transactions: [], error: e.message }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
