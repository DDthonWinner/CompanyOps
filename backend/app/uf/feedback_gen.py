"""Rule-based UF feedback generation (02 §6 "지표에서 관찰된 사실·영향·개선 제안").

Deterministic: derives observation/impact/suggestion purely from the report's
aspect scores and aggregated metrics. No LLM/network — works in demo mode and is
fully testable. This is the MVP-extension counterpart to "활용 지표 기반 개선 제안
자동 생성" (00 §4.2 후속 확장), scoped to grounded, non-actionable comments only.
"""
from __future__ import annotations


def _severity(score: int | None) -> str:
    if score is None:
        return "LOW"
    if score < 50:
        return "HIGH"
    if score < 80:
        return "MEDIUM"
    return "LOW"


def _int(metrics: dict, key: str, default: int = 0) -> int:
    try:
        return int(float(metrics.get(key, default)))
    except (TypeError, ValueError):
        return default


def generate(aspect_scores: dict, metrics: dict) -> list[dict]:
    """Return a list of feedback dicts grounded in the report's metrics.

    aspect_scores: {"AUTONOMY": int|None, "AREA_DISTRIBUTION": int|None,
                    "RESOURCE_EFFICIENCY": int|None}
    metrics: {metric_key: value_str} as stored on the report.
    """
    out: list[dict] = []

    # --- Autonomy -----------------------------------------------------------
    a = aspect_scores.get("AUTONOMY")
    ai = _int(metrics, "aiCompletedTaskCount")
    eligible = _int(metrics, "eligibleTaskCount")
    mixed = _int(metrics, "mixedTaskCount")
    ratio_pct = round(ai / eligible * 100) if eligible else 0
    rd = _int(metrics, "resolvedDecisions")
    pf = _int(metrics, "planFeedbacks")
    rr = _int(metrics, "revisionRequests")
    obs = (f"AI 자동 수행 Task {ai}/{eligible}건(비율 {ratio_pct}%, MIXED {mixed}건). "
           f"사용자 개입: 결정 {rd}건·계획 피드백 {pf}건·재작업 요청 {rr}건.")
    penalty = _int(metrics, "interventionPenaltyPct")
    base = _int(metrics, "autonomyBaseScore")
    if penalty > 0:
        obs += f" 개입으로 실행 점수 {base} → 자율성 {a}점 (−{penalty}%)."
    if a is None:
        out.append(_fb("AUTONOMY", "LOW", obs,
                       "완료된 대상 Task가 없어 자동화 수준을 평가할 수 없습니다.",
                       "Task를 완료한 뒤 다시 집계하세요."))
    elif a >= 80:
        out.append(_fb("AUTONOMY", "LOW", obs,
                       "AI가 대부분의 작업을 자동 수행해 활용도가 높습니다.",
                       "현재 수준의 자동화 비율을 유지하세요."))
    elif a >= 50:
        out.append(_fb("AUTONOMY", "MEDIUM", obs,
                       "사용자 개입이 일부 있어 자동화 여지가 남아 있습니다.",
                       "재작업 요청·결정 대기가 잦은 역할은 계획 단계에서 요구사항을 더 구체화하세요."))
    else:
        out.append(_fb("AUTONOMY", "HIGH", obs,
                       "AI 자동 수행 비율이 낮아 활용 효율이 떨어집니다.",
                       "수동 개입을 줄이도록 계획을 명확히 하고 AI Agent에 더 많은 Task를 위임하세요."))

    # --- Area distribution --------------------------------------------------
    d = aspect_scores.get("AREA_DISTRIBUTION")
    cc = _int(metrics, "coreAreasCompleted")
    ca = _int(metrics, "coreAreasWithAi")
    if cc == 0:
        out.append(_fb("AREA_DISTRIBUTION", "LOW",
                       "완료된 핵심 영역 Task가 없습니다.",
                       "핵심 영역 커버리지를 평가할 수 없습니다.",
                       "핵심 영역(Frontend/Backend 등) Task를 완료한 뒤 다시 집계하세요."))
    else:
        obs = f"핵심 영역 {cc}개 중 {ca}개에서 AI를 활용했습니다."
        if d is not None and d >= 100:
            out.append(_fb("AREA_DISTRIBUTION", "LOW", obs,
                           "모든 핵심 영역에 AI 활용이 고르게 분포했습니다.",
                           "현재의 영역 분포를 유지하세요."))
        else:
            out.append(_fb("AREA_DISTRIBUTION", _severity(d), obs,
                           "AI를 활용하지 않은 핵심 영역이 있어 활용이 편중되어 있습니다.",
                           "AI 미활용 핵심 영역에도 Agent 배정을 검토하세요."))

    # --- Resource efficiency ------------------------------------------------
    r = aspect_scores.get("RESOURCE_EFFICIENCY")
    tokens = metrics.get("totalTokens", "미수집")
    equiv = metrics.get("aiEquivalentTasks", "0")
    if tokens == "미수집":
        out.append(_fb("RESOURCE_EFFICIENCY", "LOW",
                       "토큰 사용량이 미수집이라 자원 효율을 평가할 수 없습니다.",
                       "상대 효율 비교가 불가능합니다.",
                       "real 실행 모드로 토큰을 수집하면 이전 프로젝트 대비 효율을 비교할 수 있습니다."))
    elif r is None:
        out.append(_fb("RESOURCE_EFFICIENCY", "LOW",
                       f"총 토큰 {tokens}, AI 등가 Task {equiv}건.",
                       "비교할 이전 프로젝트가 없어 상대 효율을 평가할 수 없습니다.",
                       "이후 프로젝트가 완료되면 토큰당 효율 추이를 비교하세요."))
    else:
        obs = f"총 토큰 {tokens}, AI 등가 Task {equiv}건 (이전 프로젝트 대비 효율 점수 {r})."
        if r >= 80:
            out.append(_fb("RESOURCE_EFFICIENCY", "LOW", obs,
                           "이전 프로젝트 대비 토큰 사용 효율이 양호합니다.",
                           "현재의 프롬프트·Task 분할 방식을 유지하세요."))
        else:
            out.append(_fb("RESOURCE_EFFICIENCY", _severity(r), obs,
                           "AI 등가 Task당 토큰이 이전 프로젝트보다 높아 자원 효율이 낮습니다.",
                           "Task를 더 작게 분할하거나 프롬프트를 간결히 하여 토큰 사용을 줄이세요."))

    return out


def _fb(aspect: str, severity: str, observation: str, impact: str, suggestion: str) -> dict:
    return {"aspect": aspect, "severity": severity, "observation": observation,
            "impact": impact, "suggestion": suggestion}
