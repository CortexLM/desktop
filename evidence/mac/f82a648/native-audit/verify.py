#!/usr/bin/env python3
"""Offline receipt/pixel audit. Requires existing Pillow; never launches the app.

Run from any directory: python3 evidence/mac/f82a648/native-audit/verify.py
--record writes checks.json and SHA256SUMS in this assigned audit directory.
Original PNGs must remain at the absolute paths recorded in native/images.json.
"""
import argparse
from collections import Counter
from datetime import datetime
import hashlib
import json
from pathlib import Path
import re

from PIL import Image, __version__ as pillow_version

AUDIT = Path(__file__).resolve().parent
BASE = AUDIT.parent
REPO = BASE.parents[2]
REV = "f82a64800c0fffd6ebaa99e571a8af0fa4307095"
ASAR = "a6d3c4f59d10b3d3fd16e7309441ebb6aff1dd670e11ff06a57362eca805f422"
MEMBERS = "7516cb61de528e30b3ce4b3719c8f0cadb86401caf9b569dfd5f6985dd32257a"
OLD = "43f443aeca84688ef867eae89c629878f592e2bcd3601f17fef3be1ffdd57584"
POINTER = "d5f261e5ea8ebb5ccb278a4a9cc4c4f4fe93679a300fe375ed087c10c986cc2c"
SUPPLEMENT = "3a3c694f32edefa8259e9280a3b6fa32f5c772fb4072ac41011a2dbbc9ae3cb6"
HELPERS = {
    "terminal-state-native-backend.mjs": "d22fcbe2287a7898452778ea58d665f0742f4a1d4d580ec7c237dc10cfc70d4d",
    "launch-terminal-state-native.py": "4aec6651e6178bf890a299551497514f5159342a8f94db8972515c000fc10257",
    "cleanup-terminal-state-native.py": "c46f218f17bcda2ba031fe8f2959f9f8e18dda379a7edcd076b01be0c881c08a",
}
ledger = {}


def digest(data):
    return hashlib.sha256(data).hexdigest()


def read(path):
    path = path if path.is_absolute() else BASE / path
    data = path.read_bytes()
    key = str(path.relative_to(REPO)) if path.is_relative_to(REPO) else str(path)
    value = digest(data)
    assert key not in ledger or ledger[key] == value, f"Input changed during audit: {key}"
    ledger[key] = value
    return data


def load(name):
    return json.loads(read(Path(name)))


def duration(m):
    value = (datetime.fromisoformat(m["finishedAt"]) - datetime.fromisoformat(m["startedAt"])).total_seconds()
    assert round(value * 1000) == m["durationMs"]


def inside(rect, clip):
    return (rect[2] > rect[0] and rect[3] > rect[1]
            and rect[0] >= clip[0] - .5 and rect[1] >= clip[1] - .5
            and rect[2] <= clip[2] + .5 and rect[3] <= clip[3] + .5)


def clean_receipt(r, expected):
    for key in ("protocol", "root", "runID", "pid", "platform", "port", "scriptSHA256"):
        assert r[key] == expected[key], key
    assert r["requests"] == r["failures"] == [] and r["counts"]["errors"] == 0


def call_counts(calls):
    return {"total": len(calls), "methods": dict(sorted(Counter(c["method"] for c in calls).items())),
            "statuses": dict(sorted(Counter(str(c["status"]) for c in calls).items()))}


def verify():
    # Pin inputs, excluding coordinator narrative/derived ledgers to avoid circular hashes.
    for p in sorted(BASE.rglob("*")):
        if p.is_file() and AUDIT not in p.parents and p != BASE / "README.md" and p.name != "SHA256SUMS":
            read(p)
    read(Path(__file__).resolve())
    package, admission, artifact = load("package.json"), load("package-review.json"), load("artifact.json")
    members, installed = load("members.json"), load("installed.json")
    assert admission["status"] == "approved" and admission["applicationRevision"] == REV
    assert package["applicationRevision"] == members["revision"] == installed["applicationRevision"] == REV
    assert package["asarSHA256"] == installed["installedASAR"] == admission["archiveSHA256"]["app.asar"] == ASAR
    assert package["innerSHA256"] == installed["zipSHA256"] == admission["archiveSHA256"]["Cortex.zip"]
    assert package["outerSHA256"] == admission["archiveSHA256"]["artifact.zip"] == artifact["digest"].removeprefix("sha256:")
    assert package["run"] == admission["workflowRunID"] == artifact["workflow_run"]["id"] == 37132419774
    assert package["artifact"] == admission["artifactID"] == artifact["id"] == 11277523097
    assert artifact["workflow_run"]["head_sha"] == REV
    assert package["members"] == members["members"] and members["dirty"] is False
    assert len(members["members"]) == len({r["path"] for r in members["members"]}) == admission["buildMembers"] == 90
    assert digest(read(Path("members.json"))) == MEMBERS
    for name, pin in HELPERS.items():
        assert digest(read(REPO / "evidence/mac/99e3d04/scripts" / name)) == pin

    m = load("native/manifest.json")
    s = load("dark-delete-supplement/manifest.json")
    old_source = read(Path("initial-toast-hover/projects-native.mjs"))
    source = read(Path("native/projects-native.mjs"))
    supplement_source = read(Path("dark-delete-supplement/driver.mjs"))
    assert digest(old_source) == digest(read(Path("initial-screen-permission/projects-native.mjs"))) == OLD
    insertion = b" await page.locator('.systeme-phead h1').hover(); await expect(page.locator('.toast')).toHaveCount(0);"
    assert source.count(insertion) == 1 and source.replace(insertion, b"", 1) == old_source
    assert digest(source) == m["helperHashes"]["projects-native.mjs"] == POINTER
    assert digest(supplement_source) == s["sourceSHA256"] == SUPPLEMENT
    assert read(Path("native/manifest.json")) == read(Path("/tmp/opencode/projects-native-f82a648-pointer/manifest.json"))
    assert read(Path("dark-delete-supplement/manifest.json")) == read(Path("/tmp/opencode/projects-native-f82a648-dark-delete/manifest.json"))
    assert m["status"] == "failed" and m["durationMs"] == 128800
    assert m["failure"]["stage"] == "dark:delete-project-ui"
    assert "Native flow exceeded its 120-second budget" in m["failure"]["diagnostic"]
    assert "projects-native.mjs:106:5" in m["failure"]["diagnostic"]
    assert source.decode().splitlines()[105].lstrip().startswith("mark(`${theme}:delete-project-ui`);")
    assert "installedAfter" not in m and "projectDeleted" not in m["themes"][1]
    duration(m)
    duration(s)
    assert m["revision"] == s["revision"] == REV and m["expectedAsar"] == s["asar"] == ASAR
    identity = m["installedBefore"]
    assert identity == s["installedBefore"] == s["installedAfter"]
    assert identity["pid"] == 67608 and identity["membersVerified"] == m["memberCount"] == 90
    assert identity["membersSHA256"] == m["membersSHA256"] == MEMBERS
    assert identity["root"] == "/private/tmp/opencode/desktop-terminal-state-projects-f82a648-pointer"
    assert identity["asarSHA256"] == ASAR and identity["revision"] == REV
    assert identity["processCount"] == 1 and identity["isolated"] is True
    assert identity["inspectorSHA256"] == HELPERS["launch-terminal-state-native.py"]
    assert m["rootHelperHashes"] == HELPERS
    assert {k: m["helperHashes"][k] for k in HELPERS} == HELPERS
    assert m["pageErrors"] == m["consoleErrors"] == m["rendererHttp"] == [] and m["unexpectedDialogs"] == 0
    assert s["errors"] == []
    assert m["budget"] == {"captureRequests": 4, "bytesPerOriginal": 8388608, "originalBytesTotal": 33554432, "flowMs": 120000}
    assert m["captureRequests"] == len(m["captures"]) == 4

    images = load("native/images.json")
    indexed = {Path(i["original"]).name: i for i in images}
    assert len(indexed) == 4 and set(indexed) == {c["file"] for c in m["captures"]}
    frame_checks, rgba_by_name = [], {}
    for c in m["captures"]:
        assert c["status"] == "passed" and c["httpStatus"] == 200
        assert c["pid"] == 67608 and c["id"] == 8902 and c["active"] is True
        assert c["bounds"] == {"X": 0, "Y": 30, "Width": 960, "Height": 640}
        assert c["viewport"] == c["pixels"] == [960, 640] and len(c["boxes"]) == 14
        assert c["theme"] in ("light", "dark") and c["file"].endswith(f"-{c['theme']}.png")
        assert c["focus"]["visible"] is True and c["focus"]["outlineWidth"] == "2px"
        assert c["focus"]["outlineStyle"] == "solid"
        assert c["focus"]["name"] == ("Create project" if "create" in c["file"] else "Overview")
        for box in c["boxes"]:
            assert box["visible"] is True and box["hit"] is True and box["fieldFits"] is True and box["opacity"] == 1
            assert inside(box["bounds"], box["clip"]) and all(inside(r, box["clip"]) for r in box["ink"])
            assert box["ink"] or box["tag"] in ("INPUT", "TEXTAREA", "BUTTON")
        row = indexed[c["file"]]
        original, retained = Path(row["original"]), BASE / "native" / row["path"]
        assert original.parent == Path("/tmp/opencode/projects-native-f82a648-pointer")
        assert retained.parent == BASE / "native" and retained.suffix == ".webp"
        png, webp = read(original), read(retained)
        assert digest(png) == c["sha256"] == row["sourceSHA256"] and len(png) == c["bytes"]
        assert digest(webp) == row["sha256"] and row["size"] == [960, 640]
        with Image.open(original) as a, Image.open(retained) as b:
            assert a.format == "PNG" and b.format == "WEBP" and a.size == b.size == (960, 640)
            assert a.n_frames == b.n_frames == 1
            rgba = a.convert("RGBA").tobytes()
            assert rgba == b.convert("RGBA").tobytes() and digest(rgba) == row["rgbaSHA256"]
        rgba_by_name[c["file"]] = digest(rgba)
        frame_checks.append({"file": c["file"], "theme": c["theme"], "statusWithinFailedRun": c["status"],
                             "originalBytes": len(png), "webpBytes": len(webp), "rgbaSHA256": digest(rgba),
                             "geometryTargets": len(c["boxes"]), "inkRectangles": sum(len(b["ink"]) for b in c["boxes"]),
                             "focus": c["focus"], "pixelEquality": True})
    assert sum(c["bytes"] for c in m["captures"]) <= m["budget"]["originalBytesTotal"]
    assert all(c["bytes"] <= m["budget"]["bytesPerOriginal"] for c in m["captures"])

    themes = m["themes"]
    assert [t["theme"] for t in themes] == ["light", "dark"]
    for t in themes:
        theme, created, edited, chat = t["theme"], t["created"], t["edited"], t["session"]
        assert t["createSubmitted"] is True and t["sidebarLinkVerified"] is True
        assert re.fullmatch(r"prj_[\w-]+", t["projectID"]) and re.fullmatch(r"ses_[\w-]+", t["sessionID"])
        assert created["id"] == edited["id"] == chat["projectID"] == t["projectID"]
        assert {k: created[k] for k in t["expected"]} == t["expected"]
        assert created["name"] == f"Native {theme} project" and created["instructions"] == f"Use {theme} project notes."
        assert created["icon"] == "rocket" and created["color"] == ("#FF6A13" if theme == "light" else "#12B8A0")
        assert edited == {**created, "instructions": f"Use revised {theme} project notes.", "time": edited["time"]}
        assert edited["time"]["created"] == created["time"]["created"] <= created["time"]["updated"] <= edited["time"]["updated"]
        assert chat == {**t["sessionIntent"], "id": t["sessionID"], "time": chat["time"]}
        assert chat["title"] == f"Native {theme} chat" and chat["kind"] == "chat" and chat["agent"] == "build"
        assert chat["model"] == {"providerID": "native-project", "modelID": "reasoner"}
        creation, saved = (t["longInputChecks"][k] for k in ("creation", "savedInstructions"))
        assert creation["nameLength"] == 48 and creation["instructionsLength"] == saved["renderedLength"] == saved["savedLength"] == 4000
        assert creation["nameSHA256"] == digest(b"W" * 48)
        assert creation["instructionsSHA256"] == saved["savedSHA256"] == digest(b"W" * 4000)
        assert creation["valuesUnchanged"] is True and saved["valueUnchanged"] is True
        assert len(creation["widths"]) == 2 and len(saved["widths"]) == 3
        for w in creation["widths"] + saved["widths"]:
            assert w["fits"] is True and w["width"] > 0 and w["contentWidth"] <= w["width"] + 1
            assert 0 <= w["left"] < w["right"] <= 960
        assert [len(g["roots"]) for g in t["radios"]] == [8, 6]
        for g, selected in zip(t["radios"], ("Rocket", "Orange" if theme == "light" else "Teal")):
            assert [r["name"] for r in g["roots"] if r["checked"] == "true"] == [selected]
            assert all(r["tag"] == "BUTTON" and r["tabIndex"] == (0 if r["checked"] == "true" else -1) for r in g["roots"])
            assert g["inputs"] == [{"type": "radio", "hidden": "true", "tabIndex": -1}] * len(g["roots"])
    assert themes[0]["projectDeleted"] is True and themes[0]["sessionDeleted"] is True and themes[0]["emptyMessagesPreserved"] is True
    assert themes[0]["detached"] == {k: v for k, v in themes[0]["session"].items() if k != "projectID"}
    assert all(k not in themes[1] for k in ("detached", "projectDeleted", "sessionDeleted", "emptyMessagesPreserved"))
    calls = m["stateCalls"]
    assert call_counts(calls) == {"total": 45, "methods": {"DELETE": 3, "GET": 40, "POST": 2}, "statuses": {"200": 42, "201": 2, "404": 1}}
    guarded = ["/api/" + k for k in ("projects", "sessions", "bots", "tasks", "providers", "plugins", "permissions")]
    for rows in (calls[:7], calls[-8:-1]):
        assert [r["route"] for r in rows] == guarded and all(r["count"] == 0 and r["status"] == 200 for r in rows)
    owned = {f"/api/projects/{t['projectID']}" for t in themes} | {f"/api/sessions/{t['sessionID']}" for t in themes}
    assert all(r["method"] == "GET" or r["method"] == "POST" and r["route"] == "/api/sessions" or r["method"] == "DELETE" and r["route"] in owned for r in calls)
    assert all("/prompt" not in r["route"] for r in calls)
    assert len(m["cleanup"]) == 7 and all(v is True for v in m["cleanup"].values())

    assert s["status"] == "passed" and s["durationMs"] == 8840 and s["durationMs"] < 30000 and s["captures"] == 0
    assert s["nativeDark"] == "true" and s["darkUIDeletePreservesChat"] is True
    assert s["detached"] == {k: v for k, v in s["chat"].items() if k != "projectID"}
    assert s["chat"]["projectID"] == s["project"]["id"] and s["project"]["id"] not in {t["projectID"] for t in themes}
    assert s["project"]["name"] == "Native dark deletion" and s["project"]["instructions"] == "Keep this controlled context."
    assert s["chat"]["title"] == "Native dark retained chat" and s["chat"]["model"] == themes[0]["session"]["model"]
    assert len(s["cleanup"]) == 5 and all(v is True for v in s["cleanup"].values())
    assert call_counts(s["calls"]) == {"total": 14, "methods": {"DELETE": 2, "GET": 11, "POST": 1}, "statuses": {"200": 11, "201": 1, "404": 2}}
    assert [r["route"] for r in s["calls"][:3]] == ["/api/projects", "/api/sessions", "/api/providers"]
    assert s["calls"][5] == {"route": f"/api/projects/{s['project']['id']}", "method": "GET", "status": 404}
    assert s["calls"][9] == {"route": f"/api/projects/{s['project']['id']}", "method": "DELETE", "status": 404}
    assert [r["route"] for r in s["calls"] if r["method"] == "DELETE"] == [f"/api/projects/{s['project']['id']}", f"/api/sessions/{s['chat']['id']}"]

    launch, binding, cleanup = load("launch.json"), load("binding.json"), load("cleanup.json")
    assert binding == {"expectedAsar": ASAR, "revision": REV, "membersSHA256": MEMBERS}
    assert launch["expectedAsar"] == ASAR and launch["revision"] == REV and launch["guiLaunch"] is True
    assert launch["backendPID"] == m["backend"]["pid"] == 67602 and launch["runID"] == m["backend"]["runID"]
    assert launch["capturePID"] == 67606
    for r in (m["backendReceipt"], s["backendReceipt"], load("backend-receipt.json")):
        clean_receipt(r, m["backend"])
    assert load("backend-receipt.json") == s["backendReceipt"]
    assert cleanup["applicationRevision"] == REV and cleanup["asarSHA256"] == ASAR
    assert cleanup["helpersStopped"] == [{"file": "backend.pid", "pid": 67602}, {"file": "capture.pid", "pid": 67606}]
    pre, final = load("pre-lease.json"), load("final-restoration.json")
    assert pre["nativeDark"] == final["preLeaseOSDark"] == final["nativeDark"] == "true"
    assert pre["beforeQuitOrInstall"] is True and pre["initialScreenshotObserved"] is True
    assert pre["leaseID"] == final["leaseID"] and final["leaseReleased"] is True
    assert final["OSStateRestoredAfterSharedCleanup"] is True and final["ordinaryDarkWindowObserved"] is True
    assert final["ordinaryPID"] == 68197 and final["isolatedArgumentsAbsent"] is True and final["asarSHA256"] == ASAR
    assert final["portsClosed"] == {"9444": True, "9445": True, "9456": True}
    assert final["localPortsClosed"] == {"19444": True, "19445": True}

    earlier = []
    for folder, ms, originals, checks in (("initial-screen-permission", 29782, 0, 5), ("initial-toast-hover", 47147, 1, 6)):
        attempt = load(f"{folder}/manifest.json")
        duration(attempt)
        assert attempt["status"] == "failed" and attempt["durationMs"] == ms and attempt["captureRequests"] == 1
        assert attempt["revision"] == REV and attempt["expectedAsar"] == ASAR and attempt["membersSHA256"] == MEMBERS
        assert attempt["helperHashes"] == {"projects-native.mjs": OLD, **HELPERS} and attempt["rootHelperHashes"] == HELPERS
        assert sum(c["status"] == "passed" for c in attempt["captures"]) == originals
        assert len(attempt["cleanup"]) == checks and all(v is True for v in attempt["cleanup"].values())
        assert attempt["pageErrors"] == attempt["consoleErrors"] == attempt["rendererHttp"] == [] and attempt["unexpectedDialogs"] == 0
        for r in (attempt["backendReceipt"], load(f"{folder}/backend-receipt.json")):
            clean_receipt(r, attempt["backend"])
        if originals == 0:
            assert attempt["captures"][0]["httpStatus"] == 500 and "sha256" not in attempt["captures"][0]
        else:
            assert 'class="t-body"' in attempt["failure"]["diagnostic"] and "intercepts pointer events" in attempt["failure"]["diagnostic"]
            image = load(f"{folder}/image.json")
            old_png = Path("/tmp/opencode/projects-native-f82a648-confirm/project-create-light.png")
            old_webp = BASE / folder / "project-create-light.webp"
            assert digest(read(old_png)) == image["originalSHA256"] == attempt["captures"][0]["sha256"]
            assert digest(read(old_webp)) == image["retainedSHA256"]
            with Image.open(old_png) as a, Image.open(old_webp) as b:
                assert a.size == b.size == (960, 640) and a.n_frames == b.n_frames == 1
                rgba = a.convert("RGBA").tobytes()
                assert rgba == b.convert("RGBA").tobytes()
            assert digest(rgba) == image["rgbaSHA256"] == rgba_by_name["project-create-light.png"]
        earlier.append({"directory": folder, "status": "failed", "durationMs": ms, "originals": originals, "cleanupChecks": checks})

    # A bounded scan supplements controlled-value comparisons and manual window review.
    private = re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\bBearer\s+(?!\[redacted\])\S+|\beyJ[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+|[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}")
    for obj in (m, s, load("initial-screen-permission/manifest.json"), load("initial-toast-hover/manifest.json"), final):
        assert not private.search(json.dumps(obj)), "Unexpected private-data pattern"

    return {
        "auditStatus": "scoped-composite-evidence-accepted", "applicationRevision": REV,
        "scope": "Offline immutable receipts, source binding, original/retained pixel identity; manual image findings in REPORT.md",
        "monolithicCollectorPassed": False, "budgetFailurePreserved": True,
        "package": {"run": 37132419774, "artifact": 11277523097, "asarSHA256": ASAR, "members": 90, "membersSHA256": MEMBERS,
                    "scope": "Prior independent package admission cross-bound; large archive not reopened"},
        "sourcePins": {"pointer": POINTER, "beforePointer": OLD, "darkDeleteSupplement": SUPPLEMENT, "helpers": HELPERS},
        "identity": {"sameInstalledPID": 67608, "windowID": 8902, "backendPID": 67602, "runID": m["backend"]["runID"], "root": identity["root"]},
        "pointerRun": {"status": m["status"], "durationMs": m["durationMs"], "failureStage": m["failure"]["stage"],
                       "captureRequests": 4, "perCapturePasses": 4, "cleanupChecks": 7, "calls": call_counts(calls)},
        "frames": frame_checks, "geometryTargets": sum(len(c["boxes"]) for c in m["captures"]),
        "inkRectangles": sum(len(b["ink"]) for c in m["captures"] for b in c["boxes"]),
        "originalPNGBytes": sum(c["bytes"] for c in m["captures"]),
        "longInputs": {"themes": [t["theme"] for t in themes], "creationNameLength": 48, "instructionsLength": 4000,
                       "widthTargets": sum(len(t["longInputChecks"][k]["widths"]) for t in themes for k in ("creation", "savedInstructions")),
                       "savedAndRenderedHashesMatch": True, "reopenAndMetadataBasis": "Pinned sequential driver assertions completed before later captures; raw long bodies not retained"},
        "radioButtonSnapshots": sum(len(g["roots"]) for t in themes for g in t["radios"]),
        "hiddenRadioInputs": sum(len(g["inputs"]) for t in themes for g in t["radios"]),
        "behaviors": {"bothThemesCreateEditSidebarLinks": True, "lightUIDelete": "pointer run", "darkUIDelete": "separate supplement",
                      "chatRecordMinusProjectPreserved": True, "emptyMessagesOnly": True, "distinctControlledProjects": 3,
                      "directCallLogsExcludeUIWrites": True, "supplementEmptyListsAndURLBasis": "Pinned successful driver assertions; returned list bodies and final URL not retained"},
        "supplement": {"status": s["status"], "durationMs": s["durationMs"], "budgetMs": 30000, "captures": 0, "cleanupChecks": 5, "calls": call_counts(s["calls"])},
        "earlierAttempts": earlier, "imageOccurrences": 5, "uniqueRGBAImages": len(set(rgba_by_name.values())),
        "earlierCreatePixelDuplicate": True, "backendInferenceRequests": 0, "backendErrors": 0,
        "restoration": {**final, "basis": "Retained coordinator receipt, cross-checked offline; no new device observation"},
        "privacy": {"limitedSecretPatternMatches": 0, "controlledRecordValuesVerified": True, "manualScope": "Four original Cortex windows only"},
        "limits": ["Original collector exceeded 120 seconds; no single passing complete run", "No inference or nonempty transcript native proof",
                   "No native process restart/busy-refusal/race proof", "No native persisted long-name/Library acceptance", "No frozen-reference comparison or broader product completion"],
        "execution": {"mode": "offline", "applicationLaunches": 0, "applicationTests": 0, "newCaptures": 0, "networkRequests": 0, "pillowVersion": pillow_version},
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--record", action="store_true", help="Write this audit's derived receipts")
    args = parser.parse_args()
    checks = verify()
    checks_path, hashes_path = AUDIT / "checks.json", AUDIT / "SHA256SUMS"
    if args.record:
        checks_path.write_text(json.dumps(checks, indent=2) + "\n")
        read(checks_path)
        read(AUDIT / "REPORT.md")
        hashes_path.write_text("".join(f"{sha}  {name}\n" for name, sha in sorted(ledger.items())))
    else:
        assert json.loads(checks_path.read_text()) == checks, "Derived receipt differs"
        expected = dict(line.rstrip("\n").split("  ", 1)[::-1] for line in hashes_path.read_text().splitlines())
        read(checks_path)
        read(AUDIT / "REPORT.md")
        assert ledger == expected, "Input/output SHA ledger differs"
    for name, sha in ledger.items():
        p = Path(name) if Path(name).is_absolute() else REPO / name
        assert digest(p.read_bytes()) == sha, f"Changed during audit: {name}"
    print(json.dumps({"audit": checks["auditStatus"], "monolithicCollectorPassed": False,
                      "frames": len(checks["frames"]), "geometryTargets": checks["geometryTargets"],
                      "longWidthTargets": checks["longInputs"]["widthTargets"], "hashedFiles": len(ledger)}))
