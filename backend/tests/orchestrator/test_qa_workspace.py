from app.orchestrator.qa import _run_real


def test_real_qa_refuses_missing_or_relative_workspace(tmp_path):
    for path in (None, "relative", str(tmp_path / "missing")):
        assert _run_real("must-not-be-executed", path)[3] == "ERROR"


def test_real_qa_reports_missing_executable(tmp_path):
    assert _run_real("companyops-nonexistent-command", str(tmp_path))[3] == "ERROR"
