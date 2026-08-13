"""Utilitaires de sérialisation partagés entre les routers."""

from __future__ import annotations

import math


def none_if_nan(value: float | None) -> float | None:
    """NaN n'est pas du JSON standard — une feature non calculable doit
    apparaître comme `null`, jamais comme un littéral NaN non-conforme."""
    if value is None or math.isnan(value):
        return None
    return value
