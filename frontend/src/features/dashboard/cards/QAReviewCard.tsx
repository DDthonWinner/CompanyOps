import { Card } from "./DecisionCard";

export function QAReviewCard({ title, detail }: { title: string; detail?: string }) {
  return (
    <Card kind="QA 검토" color="#0284c7">
      <p className="text-xs">{title}</p>
      {detail && <p className="text-[11px] text-on-background/60">{detail}</p>}
      <p className="mt-1 text-[11px] text-on-background/50">
        실패 검사는 수정·재검증 계획을 거쳐 처리합니다. 결과 열람은 실패 상태를 바꾸지 않습니다.
      </p>
    </Card>
  );
}
