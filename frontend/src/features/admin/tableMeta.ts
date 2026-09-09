// Human-friendly labels/descriptions + grouping for the Dev Admin table browser.
// Purely presentational: the backend exposes raw table names; this maps each one
// to a Korean label, a one-line "what it is / where it's used" note, and a category.

export interface TableMeta {
  label: string; // Korean display name
  desc: string; // one-line: what it holds / where it's used
}

export interface Category {
  key: string;
  label: string;
  icon: string;
  tables: string[]; // ordered
}

// Ordered categories → tables. Any table not listed here falls into "기타".
export const CATEGORIES: Category[] = [
  {
    key: "reference",
    label: "참조 · 설정",
    icon: "⚙️",
    tables: ["roles", "llm_models", "agent_profiles", "role_document_templates"],
  },
  {
    key: "project",
    label: "프로젝트",
    icon: "📁",
    tables: [
      "projects",
      "git_repositories",
      "project_agents",
      "project_agent_documents",
      "sprint_milestones",
      "project_agent_milestones",
      "project_tasks",
    ],
  },
  {
    key: "orchestration",
    label: "실행 · 오케스트레이션",
    icon: "🔁",
    tables: [
      "plan_versions",
      "plan_feedback",
      "decisions",
      "approvals",
      "task_attempts",
      "artifact_versions",
      "task_publishes",
      "command_receipts",
    ],
  },
  {
    key: "qa",
    label: "품질 (QA)",
    icon: "✅",
    tables: ["qa_runs", "test_results", "milestone_results"],
  },
  {
    key: "uf",
    label: "AI 활용 평가 (UF)",
    icon: "📊",
    tables: ["utilization_reports", "utilization_metrics", "feedbacks"],
  },
  {
    key: "platform",
    label: "플랫폼 · 로그",
    icon: "🛠️",
    tables: ["activity_events", "token_usage"],
  },
];

export const TABLE_META: Record<string, TableMeta> = {
  // 참조 · 설정
  roles: { label: "역할", desc: "PM/Frontend/Backend 등 에이전트 직무 정의" },
  llm_models: { label: "AI 모델", desc: "사용 가능한 LLM 목록 (provider·등급·활성 여부)" },
  agent_profiles: { label: "에이전트 프로필", desc: "채용 가능한 AI 직원 카탈로그 (역할·기본 모델·숙련도)" },
  role_document_templates: { label: "문서 템플릿", desc: "역할별 산출 문서 템플릿 (requirements.md 등)" },

  // 프로젝트
  projects: { label: "프로젝트", desc: "프로젝트 본체 (이름·예산·규모·상태)" },
  git_repositories: { label: "Git 저장소", desc: "프로젝트별 저장소 연동 정보" },
  project_agents: { label: "배정된 에이전트", desc: "특정 프로젝트에 실제 투입된 AI 직원" },
  project_agent_documents: { label: "에이전트 문서", desc: "에이전트가 생성한 산출 문서" },
  sprint_milestones: { label: "마일스톤", desc: "프로젝트의 스프린트 마일스톤" },
  project_agent_milestones: { label: "에이전트-마일스톤", desc: "에이전트별 마일스톤 진행 매핑" },
  project_tasks: { label: "태스크", desc: "프로젝트의 개별 작업 (실행 모드·상태) — UF 점수의 핵심 데이터" },

  // 실행 · 오케스트레이션
  plan_versions: { label: "계획 버전", desc: "생성된 실행 계획의 버전별 스냅샷" },
  plan_feedback: { label: "계획 피드백", desc: "계획에 대한 사용자 변경 요청" },
  decisions: { label: "의사결정", desc: "실행 중 사용자에게 물은 결정 항목" },
  approvals: { label: "승인", desc: "계획/결과 승인 기록" },
  task_attempts: { label: "태스크 시도", desc: "태스크 실행 시도 이력" },
  artifact_versions: { label: "산출물 버전", desc: "태스크가 생성한 코드/문서 버전" },
  task_publishes: { label: "태스크 발행", desc: "결과물 git 커밋/발행 기록" },
  command_receipts: { label: "명령 접수", desc: "커맨드 바 입력의 멱등 접수 기록" },

  // 품질
  qa_runs: { label: "QA 실행", desc: "기술 QA 실행 기록" },
  test_results: { label: "테스트 결과", desc: "QA 실행의 개별 테스트 결과" },
  milestone_results: { label: "마일스톤 결과", desc: "마일스톤 결과 승인/재작업 심사" },

  // AI 활용 평가 (UF)
  utilization_reports: { label: "활용 리포트", desc: "프로젝트 완료 시 생성되는 AI 활용 종합 리포트" },
  utilization_metrics: { label: "활용 지표", desc: "리포트의 관점별 점수·원천 지표" },
  feedbacks: { label: "피드백", desc: "규칙 기반 자동(SYSTEM) + 사용자(USER) 피드백" },

  // 플랫폼 · 로그
  activity_events: { label: "활동 이벤트", desc: "SSE로 방송되는 활동 로그 (토큰 사용량 포함)" },
  token_usage: { label: "토큰 사용량", desc: "AI 토큰 사용 기록" },
};

export function metaFor(name: string): TableMeta {
  return TABLE_META[name] ?? { label: name, desc: "" };
}
