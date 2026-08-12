"""Utilitaires partagés entre les loaders de sources (etl/sources/*.py)."""

from __future__ import annotations

import hashlib
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path

import httpx


@dataclass(frozen=True)
class DownloadedFile:
    filename: str
    path: Path
    media_type: str
    sha256: str
    size_bytes: int
    origin_url: str
    downloaded_at: datetime


def sha256_of(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def download_targets(
    dest_dir: Path,
    targets: list[tuple[str, str, str]],
    *,
    force: bool = False,
    timeout: float = 120.0,
) -> list[DownloadedFile]:
    """`targets` : liste de (filename, url, media_type). Idempotent : ne
    retélécharge pas un fichier déjà présent, sauf si `force=True` (§7.1)."""
    dest_dir.mkdir(parents=True, exist_ok=True)
    results = []
    for filename, url, media_type in targets:
        path = dest_dir / filename
        if force or not path.exists():
            with httpx.stream("GET", url, follow_redirects=True, timeout=timeout) as resp:
                resp.raise_for_status()
                with path.open("wb") as fh:
                    for chunk in resp.iter_bytes():
                        fh.write(chunk)
        results.append(
            DownloadedFile(
                filename=filename,
                path=path,
                media_type=media_type,
                sha256=sha256_of(path),
                size_bytes=path.stat().st_size,
                origin_url=url,
                downloaded_at=datetime.now(UTC),
            )
        )
    return results
