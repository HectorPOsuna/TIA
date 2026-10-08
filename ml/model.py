from typing import Any

import pandas as pd
from sklearn.ensemble import GradientBoostingRegressor

MODEL_TYPE = "GradientBoostingRegressor"
DEFAULT_MODEL_PARAMS: dict[str, Any] = {
    "n_estimators": 120,
    "max_depth": 4,
    "learning_rate": 0.08,
    "subsample": 0.9,
}


def chrono_split(meta: pd.DataFrame, test_fraction: float) -> tuple[list[int], list[int]]:
    train_pos: list[int] = []
    test_pos: list[int] = []
    for _, group in meta.groupby("node_id", sort=False):
        size = len(group)
        cut = int(round(size * (1 - test_fraction)))
        train_pos.extend(group.index[:cut].tolist() if cut > 0 else [])
        test_pos.extend(group.index[cut:].tolist() if cut < size else [])
    return train_pos, test_pos


def train_model(
    matrix: pd.DataFrame,
    labels: pd.Series,
    train_pos: list[int],
    seed: int,
) -> GradientBoostingRegressor:
    model = GradientBoostingRegressor(random_state=seed, **DEFAULT_MODEL_PARAMS)
    model.fit(matrix.iloc[train_pos], labels.iloc[train_pos])
    return model