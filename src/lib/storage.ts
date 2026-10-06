/**
 * localStorage 래퍼. 시크릿 창·저장소 차단 등에서 throw 할 수 있어 전부 try/catch.
 * 실패하면 읽기는 null, 쓰기는 조용히 무시한다.
 */
export function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeStorage(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {}
}

export function removeStorage(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {}
}
