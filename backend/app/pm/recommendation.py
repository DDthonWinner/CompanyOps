"""Rule-based sizing/recommendation tables (01 §6.3–6.4). MVP: deterministic, no ML."""
from __future__ import annotations

# Budget → (amount, default max agent cap)  (00 §7, 01 §6.3)
BUDGET_TABLE = {
    "HIGH": (250_000, 16),
    "MEDIUM": (180_000, 12),
    "LOW": (120_000, 8),
}

# (project_size, budget_level) → (recommended_count, base_roles in priority order)
RECOMMENDATION_TABLE = {
    ("SMALL", "LOW"): (2, ["PM", "BACKEND"]),
    ("SMALL", "MEDIUM"): (3, ["PM", "FRONTEND", "BACKEND"]),
    ("SMALL", "HIGH"): (4, ["PM", "FRONTEND", "BACKEND", "QA"]),
    ("MEDIUM", "LOW"): (3, ["PM", "FRONTEND", "BACKEND"]),
    ("MEDIUM", "MEDIUM"): (5, ["PM", "FRONTEND", "BACKEND", "DATABASE", "QA"]),
    ("MEDIUM", "HIGH"): (6, ["PM", "FRONTEND", "BACKEND", "DATABASE", "QA", "DEVOPS"]),
    ("LARGE", "LOW"): (5, ["PM", "FRONTEND", "BACKEND", "DATABASE", "QA"]),
    ("LARGE", "MEDIUM"): (7, ["PM", "FRONTEND", "BACKEND", "DATABASE", "QA", "DEVOPS", "DESIGN"]),
    ("LARGE", "HIGH"): (8, ["PM", "FRONTEND", "BACKEND", "DATABASE", "QA", "DEVOPS", "DESIGN"]),
}

# Budget → preferred skill level & model grade (01 §6.4)
PREFERENCE = {
    "LOW": {"skill": ["JUNIOR", "MID"], "grade": ["BASIC", "STANDARD", "ADVANCED"]},
    "MEDIUM": {"skill": ["MID", "SENIOR", "JUNIOR"], "grade": ["STANDARD", "ADVANCED", "BASIC"]},
    "HIGH": {"skill": ["SENIOR", "MID", "JUNIOR"], "grade": ["ADVANCED", "STANDARD", "BASIC"]},
}

# Role → default icon (01 §7.5)
ROLE_ICON = {
    "PM": "clipboard-list", "FRONTEND": "monitor", "BACKEND": "server",
    "DATABASE": "database", "QA": "clipboard-check", "DEVOPS": "cog", "DESIGN": "palette",
}

# Role → fallback color (Design §5.2)
ROLE_COLOR = {
    "PM": "#E11D48", "FRONTEND": "#4F46E5", "BACKEND": "#059669",
    "DATABASE": "#D97706", "QA": "#0284C7", "DEVOPS": "#0284C7", "DESIGN": "#4F46E5",
}


def budget_defaults(budget_level: str) -> tuple[int, int]:
    return BUDGET_TABLE[budget_level]


def recommended_size(project_size: str, budget_level: str) -> tuple[int, list[str]]:
    return RECOMMENDATION_TABLE[(project_size, budget_level)]
