// 뉴스 피드 위젯
import TopNewsSection from '../TopNewsSection';

export default function NewsFeedWidget({ allNews, onNewsClick }) {
  return <TopNewsSection allNews={allNews} onNewsClick={onNewsClick} />;
}
