import argparse
import sys
from collections.abc import Sequence

from macrolens.db.seed import run_seed
from macrolens.db.session import session_scope


def _cmd_seed(_args: argparse.Namespace) -> int:
    with session_scope() as session:
        report = run_seed(session)
    print(
        f"countries={report.countries} indicators={report.indicators} "
        f"sources={report.sources} events={report.events}"
    )
    return 0


def _cmd_etl_run_all(_args: argparse.Namespace) -> int:
    print(
        "macrolens etl run-all : pas encore implémenté (Phase 2+, PLAN.md §13).",
        file=sys.stderr,
    )
    return 1


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="macrolens")
    subparsers = parser.add_subparsers(dest="command", required=True)

    seed_parser = subparsers.add_parser("seed", help="Charge les référentiels en base")
    seed_parser.set_defaults(func=_cmd_seed)

    etl_parser = subparsers.add_parser("etl", help="Pipeline d'ingestion")
    etl_subparsers = etl_parser.add_subparsers(dest="etl_command", required=True)
    run_all_parser = etl_subparsers.add_parser("run-all", help="Rejoue le pipeline complet")
    run_all_parser.set_defaults(func=_cmd_etl_run_all)

    return parser


def main(argv: Sequence[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    result: int = args.func(args)
    return result


if __name__ == "__main__":
    sys.exit(main())
