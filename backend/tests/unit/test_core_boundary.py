"""macrolens.core doit rester du code métier pur (CLAUDE.md — contraintes d'architecture)."""

import ast
from pathlib import Path

FORBIDDEN_MODULES = {"sqlalchemy", "fastapi", "psycopg", "alembic", "httpx"}


def _imported_top_level_modules(path: Path) -> set[str]:
    tree = ast.parse(path.read_text(), filename=str(path))
    modules: set[str] = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            modules.update(alias.name.split(".")[0] for alias in node.names)
        elif isinstance(node, ast.ImportFrom) and node.module:
            modules.add(node.module.split(".")[0])
    return modules


def test_core_has_no_io_dependencies() -> None:
    core_dir = Path(__file__).resolve().parents[2] / "macrolens" / "core"
    violations = []
    for path in sorted(core_dir.rglob("*.py")):
        found = _imported_top_level_modules(path) & FORBIDDEN_MODULES
        if found:
            violations.append(f"{path.relative_to(core_dir.parents[1])}: imports {sorted(found)}")
    assert not violations, "core/ must stay free of I/O dependencies:\n" + "\n".join(violations)
