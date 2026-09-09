"""Technical QA gate (Q3, 06 §7). Runs a real test command if configured, else a
deterministic demo PASS explicitly labeled. Gate PASSED only if fully run + all required
PASS + no exec error; results tie to the artifact content hash.
"""
from __future__ import annotations

import shlex
import subprocess
from pathlib import Path

from sqlalchemy.orm import Session

from ..common.models import ArtifactVersion, QARun, TestResult
from ..common.util import utcnow_iso
from ..config import get_settings


def run_qa(session: Session, project_id: str, task_id: str, artifact: ArtifactVersion,
           *, checkout_path: str | None = None) -> QARun:
    settings = get_settings()
    run = QARun(
        project_id=project_id, task_id=task_id,
        target_artifact_version=artifact.version, target_hash=artifact.content_hash,
        scope=f"task:{task_id}", run_status="RUNNING", technical_gate="PENDING",
    )
    session.add(run)
    session.flush()

    if settings.qa_test_cmd:
        passed, failed, evidence, gate = _run_real(settings.qa_test_cmd, checkout_path)
        run.demo = 0
        session.add(TestResult(qa_run_id=run.id, name="configured-command",
                               result="PASS" if gate == "PASSED" else "FAIL", evidence=evidence))
    else:
        # Deterministic demo PASS, explicitly labeled — never presented as real (BR-Q4).
        passed, failed, evidence, gate = 1, 0, "demo QA: seeded PASS (AI 서버 미연결 / 데모 데이터)", "PASSED"
        run.demo = 1
        session.add(TestResult(qa_run_id=run.id, name="demo-check", result="PASS",
                               evidence="demo QA"))

    run.results = {"total": passed + failed, "passed": passed, "failed": failed, "skipped": 0}
    run.evidence = evidence
    run.technical_gate = gate
    run.run_status = "COMPLETED"
    run.ended_at = utcnow_iso()
    return run


def _run_real(cmd: str, checkout_path: str | None) -> tuple[int, int, str, str]:
    # Never run tests against the backend working directory or a guessed checkout.
    if not checkout_path or not Path(checkout_path).is_absolute() or not Path(checkout_path).is_dir():
        return (0, 1, "QA workspace unavailable: a real project checkout is required.", "ERROR")
    try:
        proc = subprocess.run(
            shlex.split(cmd), cwd=checkout_path, capture_output=True, text=True, timeout=300, check=False,
        )
        ok = proc.returncode == 0
        evidence = (proc.stdout or "")[-2000:] + (proc.stderr or "")[-500:]
        # MVP: treat exit code as pass/fail; detailed parsing is a later enhancement.
        return (1, 0, evidence, "PASSED") if ok else (0, 1, evidence, "FAILED")
    except Exception as exc:  # noqa: BLE001
        return (0, 1, f"QA execution error: {exc}", "ERROR")
