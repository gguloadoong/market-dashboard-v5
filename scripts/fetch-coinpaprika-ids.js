#!/usr/bin/env node
// CoinPaprika Top N + Upbit KRW 교집합으로 id 맵 생성 (#184)
// 출력: src/data/coinPaprikaIds.js (Object.freeze 맵)
// 사용: node scripts/fetch-coinpaprika-ids.js [--if-stale]
//   --if-stale : 기존 파일이 30일 이내면 skip

import { writeFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_PATH = join(__dirname, '..', 'src', 'data', 'coinPaprikaIds.js');
const TOP_N = 200;        // Paprika rank 상위 N (업비트 교집합 + 여분)
const STALE_DAYS = 30;

const isIfStale = process.argv.includes('--if-stale');

async function isFresh() {
  try {
    const s = await stat(OUT_PATH);
    const ageMs = Date.now() - s.mtimeMs;
    return ageMs < STALE_DAYS * 24 * 60 * 60 * 1000;
  } catch { return false; }
}

async function fetchPaprika() {
  const res = await fetch('https://api.coinpaprika.com/v1/coins', {
    headers: { 'User-Agent': 'market-radar-v5 (build script)' },
  });
  if (!res.ok) throw new Error(`Paprika HTTP ${res.status}`);
  const arr = await res.json();
  return arr.filter(c =>
    Number.isInteger(c.rank) && c.rank > 0 && c.rank <= TOP_N
    && c.is_active && !c.is_new
    && typeof c.symbol === 'string' && typeof c.id === 'string',
  );
}

async function fetchUpbitKrwSymbols() {
  const res = await fetch('https://api.upbit.com/v1/market/all?isDetails=false');
  if (!res.ok) throw new Error(`Upbit HTTP ${res.status}`);
  const arr = await res.json();
  const set = new Set();
  for (const m of arr) {
    if (typeof m?.market !== 'string') continue;
    if (!m.market.startsWith('KRW-')) continue;
    set.add(m.market.slice(4).toUpperCase());
  }
  return set;
}

function dedupBySymbolRankFirst(coins) {
  const map = new Map();
  for (const c of coins) {
    const sym = c.symbol.toUpperCase();
    if (!map.has(sym) || c.rank < map.get(sym).rank) map.set(sym, c);
  }
  return map;
}

function renderJs(entries) {
  const lines = entries.map(([sym, id]) => `  ${JSON.stringify(sym)}: ${JSON.stringify(id)},`);
  return `// 자동 생성 파일 — scripts/fetch-coinpaprika-ids.js로 갱신 (#184)
// 생성일: ${new Date().toISOString().slice(0, 10)} / 출처: CoinPaprika Top ${TOP_N} ∩ Upbit KRW
// 수정 금지 — 갱신 시 스크립트 재실행

export const COIN_PAPRIKA_IDS = Object.freeze({
${lines.join('\n')}
});
`;
}

async function main() {
  if (isIfStale && await isFresh()) {
    console.log('[coinPaprikaIds] 기존 파일 신선 (30일 이내) — skip');
    return;
  }
  let paprika, upbit;
  try {
    [paprika, upbit] = await Promise.all([fetchPaprika(), fetchUpbitKrwSymbols()]);
  } catch (e) {
    console.warn('[coinPaprikaIds] 외부 fetch 실패 — 기존 파일 보존:', e.message);
    process.exit(0); // 빌드 계속
  }

  const deduped = dedupBySymbolRankFirst(paprika);

  // Paprika ∩ Upbit 만 사용 (업비트 미상장 코인 노출 방지)
  // 2026-04-25: 부족분 채움 로직 제거 — 업비트에서 거래 불가능한 종목이 노출되는 P1 버그 (Phase 8 P1-14)
  const intersect = [];
  for (const [sym, c] of deduped) {
    if (upbit.has(sym)) intersect.push(c);
  }
  intersect.sort((a, b) => a.rank - b.rank);
  const picked = intersect;

  const entries = picked
    .map(c => [c.symbol.toUpperCase(), c.id])
    .sort((a, b) => a[0].localeCompare(b[0]));

  await writeFile(OUT_PATH, renderJs(entries), 'utf8');
  console.log(`[coinPaprikaIds] 생성 완료: ${entries.length}개 (Upbit 교집합만)`);
}

main().catch(e => {
  console.warn('[coinPaprikaIds] 예상치 못한 오류 — 기존 파일 보존:', e.message);
  process.exit(0);
});
