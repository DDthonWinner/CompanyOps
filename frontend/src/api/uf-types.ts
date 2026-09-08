// UF (AI-utilization) view types (02 §7, 04 §30).
export interface UtilizationReport {
  reportId: string;
  projectId: string;
  utilizationScore: number | null;
  scoreVersion?: string;
  status: string;
  metrics?: Record<string, number | string>;
  previousReportId?: string | null;
}

export interface UtilizationMetric {
  reportId: string;
  aspect: string;
  metricKey: string;
  value: number | string;
  unit?: string;
  roleCode?: string | null;
  collectionStatus?: string;
}

export interface Feedback {
  feedbackId: string;
  reportId: string;
  aspect: string;
  severity: string;
  observation: string;
  impact: string;
  suggestion: string;
  source?: string; // "USER" | "SYSTEM" (rule-based auto-generated)
}
