import argparse
import sys
from collections.abc import Sequence

from macrolens.db.seed import run_seed
from macrolens.db.session import session_scope
from macrolens.etl import pipeline
from macrolens.etl.sources import jst


def _cmd_seed(_args: argparse.Namespace) -> int:
    with session_scope() as session:
        report = run_seed(session)
    print(
        f"countries={report.countries} indicators={report.indicators} "
        f"sources={report.sources} events={report.events}"
    )
    return 0


def _cmd_etl_download(args: argparse.Namespace) -> int:
    if args.source != "jst":
        print(f"Source inconnue : {args.source!r} (seule 'jst' est disponible en Phase 2).")
        return 1
    raw_dir = pipeline.DEFAULT_DATA_DIR / "raw" / "jst" / jst.VINTAGE
    files = jst.download(raw_dir, force=args.force)
    for f in files:
        print(f"{f.filename}  sha256={f.sha256}  {f.size_bytes} octets")
    return 0


def _cmd_etl_run_all(_args: argparse.Namespace) -> int:
    with session_scope() as session:
        report = pipeline.run_all(session)
    print(
        f"observations={report.n_observations} events={report.n_events} "
        f"coverage={report.coverage_report_path}"
    )
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="macrolens")
    subparsers = parser.add_subparsers(dest="command", required=True)

    seed_parser = subparsers.add_parser("seed", help="Charge les référentiels en base")
    seed_parser.set_defaults(func=_cmd_seed)

    etl_parser = subparsers.add_parser("etl", help="Pipeline d'ingestion")
    etl_subparsers = etl_parser.add_subparsers(dest="etl_command", required=True)

    download_parser = etl_subparsers.add_parser("download", help="Télécharge une source")
    download_parser.add_argument("--source", required=True)
    download_parser.add_argument("--force", action="store_true")
    download_parser.set_defaults(func=_cmd_etl_download)

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
