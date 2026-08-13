import argparse
import sys
from collections.abc import Sequence

from macrolens.db.seed import run_seed
from macrolens.db.session import session_scope
from macrolens.etl import pipeline
from macrolens.etl.sources import bis_cbpol, jst, maddison
from macrolens.panel import build_pool, persist_state_vectors

_DOWNLOADERS = {"jst": jst, "bis_cbpol": bis_cbpol, "maddison": maddison}


def _cmd_seed(_args: argparse.Namespace) -> int:
    with session_scope() as session:
        report = run_seed(session)
    print(
        f"countries={report.countries} indicators={report.indicators} "
        f"sources={report.sources} events={report.events}"
    )
    return 0


def _cmd_etl_download(args: argparse.Namespace) -> int:
    module = _DOWNLOADERS.get(args.source)
    if module is None:
        print(f"Source inconnue : {args.source!r} (disponibles : {sorted(_DOWNLOADERS)}).")
        return 1
    raw_dir = pipeline.DEFAULT_DATA_DIR / "raw" / args.source / module.VINTAGE
    files = module.download(raw_dir, force=args.force)
    for f in files:
        print(f"{f.filename}  sha256={f.sha256}  {f.size_bytes} octets")
    return 0


def _cmd_etl_run_all(_args: argparse.Namespace) -> int:
    with session_scope() as session:
        report = pipeline.run_all(session)
    for s in report.sources:
        r = s.reconcile
        print(
            f"{s.source_id}: nouvelles={r.inserted_new} "
            f"remplacées={r.replaced_by_higher_priority} "
            f"écartées={r.rejected_lower_priority} conflits={len(r.conflicts)}"
        )
    print(
        f"total observations={report.n_observations} "
        f"coverage={report.coverage_report_path} conflicts={report.conflicts_report_path}"
    )
    return 0


def _cmd_build_features(args: argparse.Namespace) -> int:
    with session_scope() as session:
        built = build_pool(session, reference_frame=args.reference_frame)
        n_written = persist_state_vectors(session, built)
    n_complete = sum(1 for sv in built.state_vectors if sv.is_complete)
    print(
        f"build_id={built.build_id} points={len(built.state_vectors)} "
        f"complets={n_complete} lignes_ecrites={n_written}"
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

    build_features_parser = subparsers.add_parser(
        "build-features", help="Calcule et persiste les vecteurs d'état (§8, feature store)"
    )
    build_features_parser.add_argument("--reference-frame", default="rolling30")
    build_features_parser.set_defaults(func=_cmd_build_features)

    return parser


def main(argv: Sequence[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    result: int = args.func(args)
    return result


if __name__ == "__main__":
    sys.exit(main())
