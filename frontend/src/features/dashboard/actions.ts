// Wrap a write action with envelope/409 handling → toast (FR-DASH-3).
import { ApiError } from "../../api/client";
import { pushToast } from "../../components/ui/toast";

export async function runWrite<T>(fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof ApiError) {
      pushToast(e.status === 409 ? "최신 상태로 갱신되었습니다." : e.message, "error");
    } else {
      pushToast("요청을 처리하지 못했습니다.", "error");
    }
    return null;
  }
}
