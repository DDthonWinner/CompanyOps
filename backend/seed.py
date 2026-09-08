"""Seed master data + starter agent profiles (idempotent). Run: `python seed.py`."""
from __future__ import annotations

from sqlalchemy import select

from app.db import init_db, unit_of_work
from app.common.models import AgentProfile, LlmModel, Role, RoleDocumentTemplate

ROLES = [
    ("PM", "PM Agent", 1),
    ("FRONTEND", "Frontend Agent", 0),
    ("BACKEND", "Backend Agent", 0),
    ("DATABASE", "Database Agent", 0),
    ("QA", "QA Agent", 0),
    ("DEVOPS", "DevOps Agent", 0),
    ("DESIGN", "Design Agent", 0),
]

MODELS = [
    ("Anthropic", "claude-haiku", "Claude Haiku", "BASIC"),
    ("OpenAI", "gpt-standard", "GPT Standard", "STANDARD"),
    ("OpenAI", "chatgpt-astras", "ChatGPT Astras", "ADVANCED"),
    # Real model used when EXECUTION_MODE=openai
    ("OpenAI", "gpt-4o-mini", "GPT-4o mini", "STANDARD"),
]

TEMPLATES = [
    ("PM", "requirements.md", 1),
    ("PM", "project-plan.md", 0),
    ("FRONTEND", "frontend.md", 1),
    ("BACKEND", "backend.md", 1),
    ("DATABASE", "database.md", 1),
    ("QA", "test-plan.md", 1),
]

# name, roleCode, modelName, skill, color, icon
PROFILES = [
    ("PM Lead", "PM", "chatgpt-astras", "SENIOR", "#E11D48", "clipboard-list"),
    ("Senior Frontend Builder", "FRONTEND", "gpt-standard", "SENIOR", "#4F46E5", "monitor"),
    ("Backend Engineer", "BACKEND", "gpt-standard", "MID", "#059669", "server"),
    ("Database Specialist", "DATABASE", "gpt-standard", "MID", "#D97706", "database"),
    ("QA Analyst", "QA", "gpt-standard", "MID", "#0284C7", "clipboard-check"),
    ("DevOps Engineer", "DEVOPS", "gpt-standard", "MID", "#0284C7", "cog"),
]


def seed() -> None:
    init_db()
    with unit_of_work() as db:
        role_by_code: dict[str, Role] = {}
        for code, name, required in ROLES:
            role = db.execute(select(Role).where(Role.code == code)).scalars().first()
            if role is None:
                role = Role(code=code, name=name, is_required_for_project=required)
                db.add(role)
                db.flush()
            role_by_code[code] = role

        model_by_name: dict[str, LlmModel] = {}
        for provider, model_name, display, grade in MODELS:
            m = db.execute(
                select(LlmModel).where(LlmModel.provider == provider, LlmModel.model_name == model_name)
            ).scalars().first()
            if m is None:
                m = LlmModel(provider=provider, model_name=model_name, display_name=display,
                             grade=grade, is_active=1)
                db.add(m)
                db.flush()
            model_by_name[model_name] = m

        for code, file_name, required in TEMPLATES:
            role = role_by_code[code]
            exists = db.execute(
                select(RoleDocumentTemplate).where(
                    RoleDocumentTemplate.role_id == role.id,
                    RoleDocumentTemplate.file_name == file_name,
                )
            ).scalars().first()
            if exists is None:
                db.add(RoleDocumentTemplate(role_id=role.id, file_name=file_name, is_required=required))

        for name, role_code, model_name, skill, color, icon in PROFILES:
            exists = db.execute(select(AgentProfile).where(AgentProfile.name == name)).scalars().first()
            if exists is None:
                db.add(AgentProfile(
                    name=name, role_id=role_by_code[role_code].id,
                    default_llm_model_id=model_by_name[model_name].id, skill_level=skill,
                    default_color=color, default_icon_key=icon, is_active=1,
                ))
    print("Seed complete: roles, llm_models, role_document_templates, starter profiles.")


if __name__ == "__main__":
    seed()
