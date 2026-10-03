"""Téléchargement des sources publiques : réessais sur incident réseau, jamais
de fichier tronqué laissé sur disque."""

from collections.abc import Iterator
from pathlib import Path
from typing import Any

import httpx
import pytest

from macrolens.etl import common


class _FakeResponse:
    def __init__(self, status: int, chunks: list[bytes], fail_mid_stream: bool = False) -> None:
        self.status_code = status
        self._chunks = chunks
        self._fail_mid_stream = fail_mid_stream

    def raise_for_status(self) -> None:
        if self.status_code >= 400:
            request = httpx.Request("GET", "https://example.test/f")
            raise httpx.HTTPStatusError(
                "err", request=request, response=httpx.Response(self.status_code, request=request)
            )

    def iter_bytes(self) -> Iterator[bytes]:
        for i, chunk in enumerate(self._chunks):
            if self._fail_mid_stream and i == 1:
                raise httpx.ReadTimeout("coupure en cours de téléchargement")
            yield chunk


class _Stream:
    def __init__(self, outcome: Any) -> None:
        self._outcome = outcome

    def __enter__(self) -> _FakeResponse:
        if isinstance(self._outcome, Exception):
            raise self._outcome
        return self._outcome  # type: ignore[no-any-return]

    def __exit__(self, *exc: object) -> None:
        return None


def _patch_stream(monkeypatch: pytest.MonkeyPatch, outcomes: list[Any]) -> list[int]:
    calls: list[int] = []

    def fake_stream(*args: Any, **kwargs: Any) -> _Stream:
        calls.append(1)
        return _Stream(outcomes[len(calls) - 1])

    monkeypatch.setattr(common.httpx, "stream", fake_stream)
    return calls


def _download(tmp_path: Path, **kwargs: Any) -> list[common.DownloadedFile]:
    return common.download_targets(
        tmp_path, [("f.bin", "https://example.test/f", "bin")], retry_delay=0, **kwargs
    )


def test_retries_after_connect_timeout_then_succeeds(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    calls = _patch_stream(
        monkeypatch,
        [httpx.ConnectTimeout("timed out"), _FakeResponse(200, [b"abc", b"def"])],
    )
    result = _download(tmp_path)
    assert len(calls) == 2
    assert (tmp_path / "f.bin").read_bytes() == b"abcdef"
    assert result[0].size_bytes == 6


def test_gives_up_after_all_attempts(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    calls = _patch_stream(monkeypatch, [httpx.ConnectTimeout("timed out")] * 3)
    with pytest.raises(httpx.ConnectTimeout):
        _download(tmp_path)
    assert len(calls) == 3
    assert not (tmp_path / "f.bin").exists()


def test_does_not_retry_client_errors(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    calls = _patch_stream(monkeypatch, [_FakeResponse(404, [])])
    with pytest.raises(httpx.HTTPStatusError):
        _download(tmp_path)
    assert len(calls) == 1


def test_retries_server_errors(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    calls = _patch_stream(monkeypatch, [_FakeResponse(503, []), _FakeResponse(200, [b"ok"])])
    _download(tmp_path)
    assert len(calls) == 2


def test_interrupted_download_leaves_no_truncated_file(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    _patch_stream(
        monkeypatch,
        [_FakeResponse(200, [b"abc", b"def"], fail_mid_stream=True)] * 3,
    )
    with pytest.raises(httpx.ReadTimeout):
        _download(tmp_path)
    assert list(tmp_path.iterdir()) == []


def test_existing_file_is_not_downloaded_again(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    (tmp_path / "f.bin").write_bytes(b"already here")
    calls = _patch_stream(monkeypatch, [])
    _download(tmp_path)
    assert calls == []
