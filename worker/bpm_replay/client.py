"""HTTP client for the site's worker API (app/api/worker/*). Standard library only, so the worker needs no extra packages."""
from __future__ import annotations

import json
import urllib.error
import urllib.request


class ServerError(Exception):
    def __init__(self, status: int, message: str):
        super().__init__(f"HTTP {status}: {message}")
        self.status = status


class WorkerClient:
    def __init__(self, base_url: str, token: str, timeout: float = 60):
        self.base = base_url.rstrip("/")
        self.token = token
        self.timeout = timeout

    def _request(self, method: str, path: str, body: dict | None = None) -> tuple[int, bytes]:
        data = json.dumps(body).encode() if body is not None else None
        req = urllib.request.Request(self.base + path, data=data, method=method)
        req.add_header("authorization", f"Bearer {self.token}")
        req.add_header("user-agent", "BPMWorker/1")
        if data is not None:
            req.add_header("content-type", "application/json")
        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as res:
                return res.status, res.read()
        except urllib.error.HTTPError as e:
            raw = e.read()
            try:
                msg = json.loads(raw).get("error", "")
            except (ValueError, AttributeError):
                msg = raw[:120].decode("utf8", "replace")
            raise ServerError(e.code, msg) from e

    def claim(self) -> dict | None:
        """Next job {"id", "size", "attempt"}, or None when the queue is empty."""
        status, raw = self._request("POST", "/api/worker/claim")
        return None if status == 204 else json.loads(raw)

    def eval_claim(self) -> dict | None:
        """Next analysed replay to evaluate {"id", "size", "attempt"}, or None when nothing is waiting."""
        status, raw = self._request("POST", "/api/worker/eval/claim")
        return None if status == 204 else json.loads(raw)

    def eval_report(self, job_id: int, result: dict) -> dict:
        return json.loads(self._request("POST", f"/api/worker/eval/{job_id}/result", result)[1])

    def download(self, job_id: int) -> bytes:
        return self._request("GET", f"/api/worker/replays/{job_id}")[1]

    def report(self, job_id: int, result: dict) -> dict:
        return json.loads(self._request("POST", f"/api/worker/replays/{job_id}/result", result)[1])

    def upload_timeline(self, job_id: int, data: bytes, attempt: int | None = None) -> dict:
        """`attempt` is the attempt number the claim handed out: the site refuses a timeline from an attempt that has been replaced."""
        query = f"?attempt={attempt}" if attempt is not None else ""
        req = urllib.request.Request(self.base + f"/api/worker/replays/{job_id}/timeline{query}", data=data, method="PUT")
        req.add_header("authorization", f"Bearer {self.token}")
        req.add_header("user-agent", "BPMWorker/1")
        req.add_header("content-type", "application/gzip")
        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as res:
                return json.loads(res.read())
        except urllib.error.HTTPError as e:
            raw = e.read()
            try:
                msg = json.loads(raw).get("error", "")
            except (ValueError, AttributeError):
                msg = raw[:120].decode("utf8", "replace")
            raise ServerError(e.code, msg) from e
