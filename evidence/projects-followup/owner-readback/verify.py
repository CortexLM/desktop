"""Offline packet consistency only; no network, environment reads or writes."""
from pathlib import Path
import hashlib
import json

root = Path(__file__).parent
observations = json.loads((root / "observations.json").read_bytes())
pins = json.loads((root / "pins.json").read_bytes())
assert len((root / "REPORT.md").read_text().splitlines()) <= 55
for row in observations["github"]:
    body = (root / row["rawFile"]).read_bytes()
    assert hashlib.sha256(body).hexdigest() == row["rawSHA256"]
    assert len(json.loads(body)) == row["count"] == 0
assert len(observations["publicGETs"]) == 2
for row in observations["publicGETs"]:
    body = (root / row["rawFile"]).read_bytes()
    assert hashlib.sha256(body).hexdigest() == row["bodySHA256"]
    assert len(body) == row["bodyBytes"]
    assert row["attempts"] == 1 and not row["authenticated"] and not row["redirectsAllowed"]
    assert row["sameBodyAs1207"] == (row["bodySHA256"] == row["priorBodySHA256"])
page = json.loads((root / "public-models.body").read_bytes())
counts = pins["publicCapabilities"]
assert counts["models"] == [{key: model[key] for key in ("slug", "kind", "supports_reasoning", "supports_vision")} for model in page["items"]]
assert counts["total"] == len(page["items"]) and counts["hasMore"] == page["has_more"]
assert counts["eligibleVisionReasoningChat"] == sum(m["kind"] == "chat" and m["supports_vision"] and m["supports_reasoning"] for m in page["items"]) == 0
print("PASS: report line budget, raw hashes/counts, public request limits, prior hashes and capability count")
