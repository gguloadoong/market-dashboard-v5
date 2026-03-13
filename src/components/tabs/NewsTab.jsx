import NewsSection from '../NewsSection';

export default function NewsTab() {
  return (
    <div className="pb-8 space-y-3">
      <div className="sc">
        <div className="sc-header">
          <span className="sc-title">📰 뉴스 & 속보</span>
          <span className="text-[12px] text-text3">자동 갱신</span>
        </div>
        <NewsSection limit={0} showFilter={true} />
      </div>
    </div>
  );
}
