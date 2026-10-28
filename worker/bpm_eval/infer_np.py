"""I3 모델 번들을 NumPy만으로 평가하는 경량 추론기.

이 모듈은 봇 런타임에서 torch와 LightGBM을 가져오지 않는다. 학습 환경이
내보낸 JSON 트리와 NPZ 배열만 읽으며, 번들의 특징 순서 및 홀드아웃 누출
검사 결과를 로드 시점에 검증한다.
"""
from __future__ import annotations

import json
import hashlib
import math
from pathlib import Path
from typing import Any, Sequence

import numpy as np


_필수_MANIFEST = (
    "id",
    "kind",
    "feature_names",
    "scaler",
    "outputs",
    "train_data_hash",
    "split_manifest_hash",
    "metrics",
    "holdout_leak_check",
    "created",
)
_지원_KIND = {"lightgbm", "gbdt", "mlp", "linear", "logistic"}


def _json_읽기(path: Path) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise ValueError(f"번들 파일이 없습니다: {path.name}") from exc
    except (OSError, json.JSONDecodeError) as exc:
        raise ValueError(f"번들 JSON을 읽을 수 없습니다: {path.name}") from exc


def _번들_경로(path: Path) -> Path:
    path = Path(path)
    if path.is_file():
        if path.name != "manifest.json":
            raise ValueError("파일 경로는 manifest.json만 허용합니다")
        return path.parent
    if (path / "manifest.json").is_file():
        return path
    if not path.is_dir():
        raise ValueError(f"번들 경로가 없습니다: {path}")
    후보 = [p.parent for p in path.glob("*/manifest.json") if p.is_file()]
    if len(후보) == 1:
        return 후보[0]
    if not 후보:
        raise ValueError("manifest.json을 찾을 수 없습니다")
    raise ValueError("여러 모델 번들이 있습니다. 모델 id 폴더를 지정하십시오")


def _manifest_검증(manifest: dict[str, Any], allow_unverified: bool) -> None:
    누락 = [이름 for 이름 in _필수_MANIFEST if 이름 not in manifest]
    if 누락:
        raise ValueError(f"manifest 필수 필드 누락: {', '.join(누락)}")
    if manifest["kind"] not in _지원_KIND:
        raise ValueError(f"지원하지 않는 모델 kind: {manifest['kind']!r}")
    특징 = manifest["feature_names"]
    출력 = manifest["outputs"]
    if not isinstance(특징, list) or not 특징 or not all(isinstance(v, str) and v for v in 특징):
        raise ValueError("feature_names는 비어 있지 않은 문자열 목록이어야 합니다")
    if len(set(특징)) != len(특징):
        raise ValueError("feature_names에 중복 이름이 있습니다")
    기록된_특징_해시 = manifest.get("feature_schema_hash")
    if 기록된_특징_해시 is not None:
        계산한_특징_해시 = hashlib.sha256("\0".join(특징).encode("utf8")).hexdigest()
        if 기록된_특징_해시 != 계산한_특징_해시:
            raise ValueError("feature_schema_hash가 feature_names 이름/순서와 맞지 않습니다")
    if not isinstance(출력, list) or not 출력 or not all(isinstance(v, str) and v for v in 출력):
        raise ValueError("outputs는 비어 있지 않은 문자열 목록이어야 합니다")
    if not isinstance(manifest["metrics"], dict):
        raise ValueError("metrics는 객체여야 합니다")
    검사 = manifest["holdout_leak_check"]
    if not isinstance(검사, dict) or "passed" not in 검사 or "checked_at" not in 검사:
        raise ValueError("holdout_leak_check에는 passed와 checked_at이 필요합니다")
    if 검사.get("passed") is not True and not allow_unverified:
        raise ValueError("홀드아웃 누출 검사를 통과하지 않은 번들입니다")
    분위 = manifest.get("quantiles")
    if 분위 is not None:
        if not isinstance(분위, list) or not 분위:
            raise ValueError("quantiles는 null이 아닌 경우 비어 있지 않은 목록이어야 합니다")
        값 = [float(q) for q in 분위]
        if any(not 0.0 < q < 1.0 for q in 값) or len(set(값)) != len(값):
            raise ValueError("quantiles는 중복이 없는 0과 1 사이 값이어야 합니다")


def _sigmoid(x: np.ndarray) -> np.ndarray:
    결과 = np.empty_like(x, dtype=np.float64)
    양수 = x >= 0
    결과[양수] = 1.0 / (1.0 + np.exp(-x[양수]))
    지수 = np.exp(x[~양수])
    결과[~양수] = 지수 / (1.0 + 지수)
    return 결과


def _softmax(x: np.ndarray) -> np.ndarray:
    이동 = x - np.max(x, axis=1, keepdims=True)
    지수 = np.exp(이동)
    return 지수 / np.sum(지수, axis=1, keepdims=True)


def _변환(y: np.ndarray, 이름: str) -> np.ndarray:
    이름 = 이름.lower()
    if 이름 in {"identity", "none"}:
        return y
    if 이름 == "sigmoid":
        return _sigmoid(y)
    if 이름 == "softmax":
        return _softmax(y)
    raise ValueError(f"지원하지 않는 출력 변환: {이름}")


def _목적함수_변환(dump: dict[str, Any]) -> str:
    목적 = str(dump.get("objective", "")).lower()
    if 목적.startswith(("binary", "cross_entropy", "xentropy")):
        return "sigmoid"
    if 목적.startswith(("multiclass", "multiclassova")):
        return "softmax"
    return "identity"


class _트리앙상블:
    """여러 트리의 같은 깊이 노드를 한 NumPy 연산으로 진행한다."""

    def __init__(self, dump: dict[str, Any]):
        트리정보 = dump.get("tree_info")
        if not isinstance(트리정보, list) or not 트리정보:
            raise ValueError("trees.json의 dump_model에 tree_info가 없습니다")

        feature: list[int] = []
        threshold: list[float] = []
        left: list[int] = []
        right: list[int] = []
        default_left: list[bool] = []
        missing: list[int] = []  # 0=None, 1=NaN, 2=Zero
        leaf: list[float] = []
        category: dict[int, np.ndarray] = {}

        def 노드_추가(node: dict[str, Any]) -> int:
            위치 = len(feature)
            feature.append(-1)
            threshold.append(0.0)
            left.append(위치)
            right.append(위치)
            default_left.append(False)
            missing.append(0)
            leaf.append(float(node.get("leaf_value", 0.0)))
            if "leaf_value" in node:
                return 위치

            try:
                feature[위치] = int(node["split_feature"])
                decision = str(node.get("decision_type", "<="))
                raw_threshold = node["threshold"]
                default_left[위치] = bool(node.get("default_left", False))
                missing_name = str(node.get("missing_type", "None")).lower()
                missing[위치] = {"none": 0, "nan": 1, "zero": 2}.get(missing_name, 1)
                if decision in {"==", "in"}:
                    값들 = str(raw_threshold).split("||")
                    category[위치] = np.asarray([int(float(v)) for v in 값들 if v != ""], dtype=np.int64)
                elif decision != "<=":
                    raise ValueError(f"지원하지 않는 LightGBM 분기: {decision}")
                else:
                    threshold[위치] = float(raw_threshold)
                left[위치] = 노드_추가(node["left_child"])
                right[위치] = 노드_추가(node["right_child"])
            except (KeyError, TypeError, ValueError) as exc:
                if isinstance(exc, ValueError) and str(exc).startswith("지원하지 않는"):
                    raise
                raise ValueError("잘못된 LightGBM 트리 노드입니다") from exc
            return 위치

        roots: list[int] = []
        heads: list[int] = []
        head_count = int(dump.get("num_tree_per_iteration", 1) or 1)
        for 번호, info in enumerate(트리정보):
            if not isinstance(info, dict) or "tree_structure" not in info:
                raise ValueError("잘못된 tree_info 항목입니다")
            roots.append(노드_추가(info["tree_structure"]))
            tree_index = int(info.get("tree_index", 번호))
            heads.append(tree_index % head_count)

        self.feature = np.asarray(feature, dtype=np.int32)
        self.threshold = np.asarray(threshold, dtype=np.float64)
        self.left = np.asarray(left, dtype=np.int32)
        self.right = np.asarray(right, dtype=np.int32)
        self.default_left = np.asarray(default_left, dtype=np.bool_)
        self.missing = np.asarray(missing, dtype=np.int8)
        self.leaf = np.asarray(leaf, dtype=np.float64)
        self.roots = np.asarray(roots, dtype=np.int32)
        self.heads = np.asarray(heads, dtype=np.int32)
        self.category = category
        self.output_size = head_count
        self.average_output = bool(dump.get("average_output", False))
        self.transform = _목적함수_변환(dump)

    def predict(self, X: np.ndarray) -> np.ndarray:
        n = X.shape[0]
        현재 = np.broadcast_to(self.roots, (n, self.roots.size)).copy()
        행 = np.arange(n, dtype=np.intp)[:, None]
        최대_단계 = self.feature.size + 1
        for _ in range(최대_단계):
            분기특징 = self.feature[현재]
            활성 = 분기특징 >= 0
            if not np.any(활성):
                break
            안전특징 = np.where(활성, 분기특징, 0)
            값 = X[행, 안전특징]
            왼쪽 = 값 <= self.threshold[현재]

            결측종류 = self.missing[현재]
            결측 = ((결측종류 == 1) & np.isnan(값)) | (
                (결측종류 == 2) & (np.isnan(값) | (np.abs(값) <= 1e-35))
            )
            왼쪽 = np.where(결측, self.default_left[현재], 왼쪽)

            if self.category:
                for 노드, 범주 in self.category.items():
                    마스크 = 활성 & (현재 == 노드)
                    if np.any(마스크):
                        범주왼쪽 = np.isin(값[마스크].astype(np.int64, copy=False), 범주)
                        범주왼쪽 = np.where(np.isnan(값[마스크]), self.default_left[노드], 범주왼쪽)
                        왼쪽[마스크] = 범주왼쪽

            다음 = np.where(왼쪽, self.left[현재], self.right[현재])
            현재 = np.where(활성, 다음, 현재)
        else:
            raise ValueError("트리 순환 또는 손상된 노드를 발견했습니다")

        잎값 = self.leaf[현재]
        결과 = np.empty((n, self.output_size), dtype=np.float64)
        for head in range(self.output_size):
            선택 = self.heads == head
            결과[:, head] = np.sum(잎값[:, 선택], axis=1)
            if self.average_output and np.any(선택):
                결과[:, head] /= int(np.count_nonzero(선택))
        return _변환(결과, self.transform)


class _트리예측기:
    def __init__(self, payload: dict[str, Any]):
        models = payload.get("models") if isinstance(payload, dict) else None
        if models is None:
            self.groups = [(_트리앙상블(payload), None)]
        else:
            if not isinstance(models, list) or not models:
                raise ValueError("trees.json의 models가 비었습니다")
            self.groups = []
            for item in models:
                if not isinstance(item, dict) or "dump_model" not in item:
                    raise ValueError("trees.json models 항목에 dump_model이 필요합니다")
                group = _트리앙상블(item["dump_model"])
                변환 = item.get("output_transform")
                self.groups.append((group, str(변환) if 변환 is not None else None))
        self.output_size = sum(group.output_size for group, _ in self.groups)

    def predict(self, X: np.ndarray) -> np.ndarray:
        출력 = []
        for group, 변환 in self.groups:
            y = group.predict(X)
            if 변환 is not None:
                # group의 목적함수 변환 대신 명시 변환을 적용해야 하므로 raw를 복원할 수
                # 없다. exporter는 override가 필요할 때 dump objective를 비워 저장한다.
                y = _변환(y, 변환)
            출력.append(y)
        return np.concatenate(출력, axis=1)


def _erf_근사(x: np.ndarray) -> np.ndarray:
    """최대 절대 오차 약 1.5e-7인 벡터화 erf 근사."""
    부호 = np.sign(x)
    a = np.abs(x)
    t = 1.0 / (1.0 + 0.5 * a)
    tau = t * np.exp(
        -a * a
        - 1.26551223
        + t
        * (
            1.00002368
            + t
            * (
                0.37409196
                + t
                * (
                    0.09678418
                    + t
                    * (
                        -0.18628806
                        + t
                        * (
                            0.27886807
                            + t
                            * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))
                        )
                    )
                )
            )
        )
    )
    return 부호 * (1.0 - tau)


class _MLP예측기:
    def __init__(self, manifest: dict[str, Any], weights: Any):
        network = manifest.get("network")
        layers = network.get("layers") if isinstance(network, dict) else None
        if not isinstance(layers, list) or not layers:
            raise ValueError("MLP manifest에 network.layers가 필요합니다")
        self.layers: list[tuple[str, Any]] = []
        현재크기 = len(manifest["feature_names"])
        for layer in layers:
            if not isinstance(layer, dict) or "type" not in layer:
                raise ValueError("잘못된 MLP 레이어 명세입니다")
            종류 = str(layer["type"]).lower()
            if 종류 == "linear":
                try:
                    W = np.asarray(weights[layer["weight"]], dtype=np.float64)
                    b = np.asarray(weights[layer["bias"]], dtype=np.float64)
                except (KeyError, TypeError) as exc:
                    raise ValueError("Linear 가중치 키가 없습니다") from exc
                if W.ndim != 2 or b.shape != (W.shape[0],) or W.shape[1] != 현재크기:
                    raise ValueError("Linear 가중치 형상이 앞 레이어와 맞지 않습니다")
                현재크기 = W.shape[0]
                self.layers.append((종류, (W, b)))
            elif 종류 == "layernorm":
                try:
                    W = np.asarray(weights[layer["weight"]], dtype=np.float64)
                    b = np.asarray(weights[layer["bias"]], dtype=np.float64)
                    eps = float(layer.get("eps", 1e-5))
                except (KeyError, TypeError, ValueError) as exc:
                    raise ValueError("LayerNorm 명세가 잘못되었습니다") from exc
                if W.shape != (현재크기,) or b.shape != (현재크기,) or eps <= 0:
                    raise ValueError("LayerNorm 가중치 형상이 앞 레이어와 맞지 않습니다")
                self.layers.append((종류, (W, b, eps)))
            elif 종류 in {"relu", "tanh"}:
                self.layers.append((종류, None))
            elif 종류 == "gelu":
                approximate = str(layer.get("approximate", "none"))
                if approximate not in {"none", "tanh"}:
                    raise ValueError("GELU approximate는 none 또는 tanh여야 합니다")
                self.layers.append((종류, approximate))
            else:
                raise ValueError(f"지원하지 않는 MLP 레이어: {종류}")
        self.output_size = 현재크기

    def predict(self, X: np.ndarray) -> np.ndarray:
        y = X
        for 종류, 값 in self.layers:
            if 종류 == "linear":
                W, b = 값
                y = y @ W.T + b
            elif 종류 == "relu":
                y = np.maximum(y, 0.0)
            elif 종류 == "tanh":
                y = np.tanh(y)
            elif 종류 == "gelu":
                if 값 == "tanh":
                    y = 0.5 * y * (1.0 + np.tanh(math.sqrt(2.0 / math.pi) * (y + 0.044715 * y**3)))
                else:
                    y = 0.5 * y * (1.0 + _erf_근사(y / math.sqrt(2.0)))
            else:
                W, b, eps = 값
                평균 = np.mean(y, axis=-1, keepdims=True)
                분산 = np.mean((y - 평균) ** 2, axis=-1, keepdims=True)
                y = (y - 평균) / np.sqrt(분산 + eps) * W + b
        return np.asarray(y, dtype=np.float64)


class _선형예측기:
    def __init__(self, weights: Any, input_size: int):
        try:
            W = np.asarray(weights["weight"], dtype=np.float64)
            b = np.asarray(weights["bias"], dtype=np.float64)
        except KeyError as exc:
            raise ValueError("선형 모델은 weight와 bias 배열이 필요합니다") from exc
        if W.ndim == 1:
            W = W[None, :]
        if b.ndim == 0:
            b = b.reshape(1)
        if W.ndim != 2 or W.shape[1] != input_size or b.shape != (W.shape[0],):
            raise ValueError("선형 모델 가중치 형상이 manifest와 맞지 않습니다")
        self.W = W
        self.b = b
        self.output_size = W.shape[0]

    def predict(self, X: np.ndarray) -> np.ndarray:
        return X @ self.W.T + self.b


class Model:
    """검증된 I3 번들의 NumPy 추론 모델."""

    def __init__(self, bundle_path: Path, manifest: dict[str, Any], meta: dict[str, Any], weights: Any, trees: Any):
        self.bundle_path = bundle_path
        self.feature_names = list(manifest["feature_names"])
        self.outputs = list(manifest["outputs"])
        self.meta = meta
        self.manifest = manifest
        self.quantiles = None if manifest.get("quantiles") is None else [float(q) for q in manifest["quantiles"]]
        self._kind = str(manifest["kind"])
        self._transform = str(manifest.get("output_transform", "sigmoid" if self._kind == "logistic" else "identity"))

        scaler = manifest["scaler"]
        if scaler is None:
            self._mean = self._std = None
        else:
            if not isinstance(scaler, dict) or "mean" not in scaler or "std" not in scaler:
                raise ValueError("scaler는 null 또는 mean/std 객체여야 합니다")
            self._mean = np.asarray(scaler["mean"], dtype=np.float64)
            self._std = np.asarray(scaler["std"], dtype=np.float64)
            shape = (len(self.feature_names),)
            if self._mean.shape != shape or self._std.shape != shape or not np.all(np.isfinite(self._std)) or np.any(self._std <= 0):
                raise ValueError("scaler mean/std 형상이 잘못됐거나 std가 양수가 아닙니다")

        if self._kind in {"lightgbm", "gbdt"}:
            self._predictor = _트리예측기(trees)
            self._predictor_has_transform = True
        elif self._kind == "mlp":
            self._predictor = _MLP예측기(manifest, weights)
            self._predictor_has_transform = False
        else:
            self._predictor = _선형예측기(weights, len(self.feature_names))
            self._predictor_has_transform = False

        기대 = len(self.outputs) * (len(self.quantiles) if self.quantiles is not None else 1)
        if self._predictor.output_size != 기대:
            raise ValueError(f"모델 출력 수 {self._predictor.output_size}와 manifest 기대값 {기대}가 다릅니다")

    def check_features(self, names: Sequence[str]) -> None:
        받은이름 = list(names)
        if 받은이름 != self.feature_names:
            첫차이 = next(
                (i for i, pair in enumerate(zip(받은이름, self.feature_names)) if pair[0] != pair[1]),
                min(len(받은이름), len(self.feature_names)),
            )
            raise ValueError(
                f"특징 이름/순서 불일치(index={첫차이}): expected={self.feature_names!r}, got={받은이름!r}"
            )

    def _입력(self, X: np.ndarray) -> np.ndarray:
        값 = np.asarray(X, dtype=np.float64)
        if 값.ndim != 2 or 값.shape[1] != len(self.feature_names):
            raise ValueError(f"X는 [n, {len(self.feature_names)}] 형상이어야 합니다")
        if self._mean is not None:
            값 = (값 - self._mean) / self._std
        return 값

    def _전체출력(self, X: np.ndarray) -> np.ndarray:
        y = self._predictor.predict(self._입력(X))
        if not self._predictor_has_transform:
            y = _변환(y, self._transform)
        return y

    def predict(self, X: np.ndarray) -> np.ndarray:
        """X[n, f]를 평가해 대표 출력 [n, k]를 반환한다."""
        y = self._전체출력(X)
        if self.quantiles is None:
            return y
        shaped = y.reshape(y.shape[0], len(self.outputs), len(self.quantiles))
        대표 = int(np.argmin(np.abs(np.asarray(self.quantiles) - 0.5)))
        return shaped[:, :, 대표]

    def predict_quantiles(self, X: np.ndarray, qs: Sequence[float]) -> np.ndarray:
        """번들에 저장된 분위 중 요청한 순서대로 반환한다."""
        if self.quantiles is None:
            raise ValueError("이 모델에는 분위 출력이 없습니다")
        요청 = [float(q) for q in qs]
        if not 요청:
            raise ValueError("qs는 비어 있을 수 없습니다")
        인덱스 = []
        available = np.asarray(self.quantiles)
        for q in 요청:
            hit = np.flatnonzero(np.isclose(available, q, rtol=0.0, atol=1e-12))
            if hit.size == 0:
                raise ValueError(f"요청 분위 {q}가 번들에 없습니다: {self.quantiles}")
            인덱스.append(int(hit[0]))
        y = self._전체출력(X).reshape(-1, len(self.outputs), len(self.quantiles))
        selected = y[:, :, 인덱스]
        return selected[:, 0, :] if len(self.outputs) == 1 else selected


def load(path: Path, *, allow_unverified: bool = False) -> Model:
    """번들 폴더를 읽는다. 검증 미통과 번들은 명시적 시험 플래그만 허용한다."""
    번들 = _번들_경로(Path(path))
    manifest = _json_읽기(번들 / "manifest.json")
    if not isinstance(manifest, dict):
        raise ValueError("manifest.json 최상위는 객체여야 합니다")
    _manifest_검증(manifest, allow_unverified)
    meta = _json_읽기(번들 / "meta.json")
    trees = _json_읽기(번들 / "trees.json")
    if not isinstance(meta, dict) or not isinstance(trees, dict):
        raise ValueError("meta.json과 trees.json 최상위는 객체여야 합니다")
    try:
        weights = np.load(번들 / "weights.npz", allow_pickle=False)
    except (OSError, ValueError) as exc:
        raise ValueError("weights.npz를 읽을 수 없습니다") from exc
    try:
        return Model(번들, manifest, meta, weights, trees)
    finally:
        weights.close()


__all__ = ["Model", "load"]
