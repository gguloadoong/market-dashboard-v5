// 시그널 위젯 — 뉴스 매칭된 급등/급락 종목만 표시
import SignalSection from '../SignalSection';

export default function SignalWidget({ allItems, recentNews, krwRate, onItemClick }) {
  return (
    <SignalSection allItems={allItems} recentNews={recentNews} krwRate={krwRate} onItemClick={onItemClick} />
  );
}
