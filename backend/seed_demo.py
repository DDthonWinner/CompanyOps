"""Populate the DB with a rich, showcase demo project for the Tycoon Office view.

Idempotent: re-running replaces the demo project's agents/tasks/milestones in place.
This is pure data population (no backend logic changes). Run: `python seed_demo.py`.

It creates one ACTIVE project with:
  * varied agent counts per domain (FE 4, BE 3, DB 2, QA 2, PM 1),
  * agents in mixed live statuses (WORKING / IDLE / WAITING / BLOCKED / ASSIGNED)
    so the office shows typing / thinking / blocked animations, and
  * tasks in mixed statuses per domain so documents pile up in the desk
    inbox (TODO/WAITING) and outbox (COMPLETED) trays, with distinct progress.
"""
from __future__ import annotations

from sqlalchemy import delete, select

from app.db import init_db, unit_of_work
from app.common.models import (
    AgentProfile,
    LlmModel,
    Project,
    ProjectAgent,
    ProjectAgentMilestone,
    ProjectTask,
    Role,
    SprintMilestone,
)
from seed import seed as seed_master

DEMO_PROJECT_NAME = "Neobank Super App"
DEMO_MODEL = "gpt-standard"

# Extra agent profiles so a domain can seat multiple distinct agents
# (project_agents is unique per (project, profile)). name, roleCode, color, icon.
EXTRA_PROFILES = [
    ("FE Canvas Specialist", "FRONTEND", "#6366F1", "monitor"),
    ("FE State Architect", "FRONTEND", "#818CF8", "monitor"),
    ("FE Perf Engineer", "FRONTEND", "#4338CA", "monitor"),
    ("BE Auth Engineer", "BACKEND", "#10B981", "server"),
    ("BE Events Engineer", "BACKEND", "#047857", "server"),
    ("DB Vector Specialist", "DATABASE", "#F59E0B", "database"),
    ("QA Automation Analyst", "QA", "#0EA5E9", "clipboard-check"),
]

# roleCode -> list of (displayName, profileName, color, status)
AGENTS = {
    "PM": [("Atlas · PM Prime", "PM Lead", "#E11D48", "WORKING")],
    "FRONTEND": [
        ("Iris · UI Lead", "Senior Frontend Builder", "#4F46E5", "WORKING"),
        ("Nova · Canvas", "FE Canvas Specialist", "#6366F1", "WORKING"),
        ("Echo · State", "FE State Architect", "#818CF8", "IDLE"),
        ("Pixel · Perf", "FE Perf Engineer", "#4338CA", "WAITING"),
    ],
    "BACKEND": [
        ("Kilo · Services", "Backend Engineer", "#059669", "WORKING"),
        ("Vault · Auth", "BE Auth Engineer", "#10B981", "BLOCKED"),
        ("Broker · Events", "BE Events Engineer", "#047857", "IDLE"),
    ],
    "DATABASE": [
        ("Delta · Storage", "Database Specialist", "#D97706", "WORKING"),
        ("Vecta · Vector", "DB Vector Specialist", "#F59E0B", "WAITING"),
    ],
    "QA": [
        ("Sentry · QA", "QA Analyst", "#0284C7", "IDLE"),
        ("Probe · E2E", "QA Automation Analyst", "#0EA5E9", "ASSIGNED"),
    ],
}

# roleCode -> milestone (title, color, sort_order)
MILESTONES = {
    "PM": ("Discovery & Design", "#E11D48", 0),
    "FRONTEND": ("Payments & Wallet UI", "#4F46E5", 1),
    "BACKEND": ("Core Banking Services", "#059669", 2),
    "DATABASE": ("Ledger & Vector Store", "#D97706", 3),
    "QA": ("Security & Release QA", "#0284C7", 4),
}

# roleCode -> status counts. inbox = TODO+WAITING, outbox = COMPLETED.
TASK_PLAN = {
    "FRONTEND": {"COMPLETED": 9, "TODO": 3, "WAITING": 1, "RUNNING": 1},   # 9/14 = 64%
    "BACKEND": {"COMPLETED": 11, "TODO": 4, "WAITING": 2, "BLOCKED": 1},   # 11/18 = 61%
    "DATABASE": {"COMPLETED": 4, "TODO": 1, "RUNNING": 1},                 # 4/6 = 67%
    "QA": {"COMPLETED": 3, "TODO": 3, "WAITING": 2},                       # 3/8 = 38%
    "PM": {"COMPLETED": 3, "TODO": 2},                                     # 3/5 = 60%
}

TASK_TITLES = {
    "FRONTEND": "Wallet UI",
    "BACKEND": "Banking Service",
    "DATABASE": "Ledger Store",
    "QA": "Release Gate",
    "PM": "Product Spec",
}


def _delete_demo(db, project_id: str) -> None:
    """Remove the demo project's dependent rows in FK-safe order, then the project."""
    db.execute(delete(ProjectTask).where(ProjectTask.project_id == project_id))
    db.execute(delete(ProjectAgentMilestone).where(ProjectAgentMilestone.project_id == project_id))
    db.execute(delete(SprintMilestone).where(SprintMilestone.project_id == project_id))
    db.execute(delete(ProjectAgent).where(ProjectAgent.project_id == project_id))
    db.execute(delete(Project).where(Project.id == project_id))


def seed_demo() -> None:
    init_db()
    seed_master()  # ensure roles, models, templates, base profiles

    with unit_of_work() as db:
        role_by_code = {r.code: r for r in db.execute(select(Role)).scalars()}
        model = db.execute(select(LlmModel).where(LlmModel.model_name == DEMO_MODEL)).scalars().first()
        assert model is not None, "run seed.py first (missing base LLM model)"

        # Extra profiles (idempotent by name).
        for name, code, color, icon in EXTRA_PROFILES:
            if db.execute(select(AgentProfile).where(AgentProfile.name == name)).scalars().first() is None:
                db.add(AgentProfile(
                    name=name, role_id=role_by_code[code].id, default_llm_model_id=model.id,
                    skill_level="MID", default_color=color, default_icon_key=icon, is_active=1,
                ))
        db.flush()
        profile_by_name = {p.name: p for p in db.execute(select(AgentProfile)).scalars()}

        # Fresh demo project.
        existing = db.execute(
            select(Project).where(Project.name == DEMO_PROJECT_NAME)
        ).scalars().first()
        if existing is not None:
            _delete_demo(db, existing.id)
            db.flush()

        project = Project(
            name=DEMO_PROJECT_NAME,
            description="Autonomous neobank build — payments, ledger, security.",
            project_type="WEB_APP", budget_level="HIGH", budget_amount=250000,
            project_size="LARGE", desired_agent_count=12, recommended_agent_count=12,
            max_agent_count=14, status="ACTIVE", revision=1, created_by="seed-demo",
        )
        db.add(project)
        db.flush()

        # Milestones per role.
        milestone_by_role: dict[str, SprintMilestone] = {}
        for code, (title, color, order) in MILESTONES.items():
            m = SprintMilestone(
                project_id=project.id, title=title, role_id=role_by_code[code].id,
                display_color=color, sort_order=order,
            )
            db.add(m)
            milestone_by_role[code] = m
        db.flush()

        # Agents per role.
        agents_by_role: dict[str, list[ProjectAgent]] = {}
        for code, roster in AGENTS.items():
            created: list[ProjectAgent] = []
            for display_name, profile_name, color, status in roster:
                prof = profile_by_name[profile_name]
                a = ProjectAgent(
                    project_id=project.id, agent_profile_id=prof.id, role_id=role_by_code[code].id,
                    llm_model_id=model.id, display_name=display_name, display_color=color,
                    icon_key=prof.default_icon_key or "smart_toy", status=status,
                    is_primary_pm=1 if code == "PM" else 0,
                    activity_summary={
                        "WORKING": "Streaming autonomous inference…",
                        "WAITING": "Waiting on upstream dependency.",
                        "BLOCKED": "Blocked: needs operator decision.",
                        "IDLE": "Idle — awaiting next dispatch.",
                        "ASSIGNED": "Assigned, warming context.",
                    }.get(status),
                )
                db.add(a)
                created.append(a)
            agents_by_role[code] = created
        db.flush()

        # Tasks per role: statuses pile up in inbox/outbox; wired to the role milestone.
        for code, plan in TASK_PLAN.items():
            role = role_by_code[code]
            milestone = milestone_by_role.get(code)
            roster = agents_by_role.get(code, [])
            working = next((a for a in roster if a.status == "WORKING"), None)
            order = 0
            first_running: ProjectTask | None = None
            first_todo: ProjectTask | None = None
            for status, count in plan.items():
                for i in range(count):
                    order += 1
                    t = ProjectTask(
                        project_id=project.id, sprint_milestone_id=milestone.id if milestone else None,
                        role_id=role.id, title=f"{TASK_TITLES[code]} #{order:02d}",
                        status=status, execution_mode="AI_AGENT", priority="MEDIUM", sort_order=order,
                    )
                    db.add(t)
                    if status == "RUNNING" and first_running is None:
                        first_running = t
                    if status == "TODO" and first_todo is None:
                        first_todo = t
            db.flush()
            # Give the working agent a current/next task for a richer inspector sheet.
            if working is not None:
                if first_running is not None:
                    working.current_task_id = first_running.id
                    first_running.assigned_project_agent_id = working.id
                if first_todo is not None:
                    working.next_task_id = first_todo.id

    print(f"Demo seed complete: project '{DEMO_PROJECT_NAME}' with varied agents + piled tasks.")


if __name__ == "__main__":
    seed_demo()
