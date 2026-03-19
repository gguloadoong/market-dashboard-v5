// 시그널 위젯 — SignalSection + EarlySignalSection 통합
import SignalSection from '../SignalSection';
import EarlySignalSection from '../EarlySignalSection';

export default function SignalWidget({ allItems, recentNews, krwRate, onItemClick }) {
  return (
    <div className="space-y-3">
      <SignalSection allItems={allItems} recentNews={recentNews} krwRate={krwRate} onItemClick={onItemClick} />
      <EarlySignalSection allItems={allItems} recentNews={recentNews} krwRate={krwRate} onItemClick={onItemClick} />
    </div>
  );
}
