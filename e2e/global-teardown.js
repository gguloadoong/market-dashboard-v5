// Playwright 테스트 후 브라우저 프로세스 자동 정리
import { execSync } from 'child_process';

export default async function globalTeardown() {
  try {
    // Playwright가 남긴 Chromium 프로세스 정리
    execSync('pkill -f "chromium.*--remote-debugging" || true', { stdio: 'ignore' });
    execSync('pkill -f "chrome.*--headless" || true', { stdio: 'ignore' });
  } catch {
    // 프로세스 없으면 무시
  }
}
