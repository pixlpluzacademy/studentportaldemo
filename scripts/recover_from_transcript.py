#!/usr/bin/env python3
"""Recover files from Cursor agent transcript JSONL by replaying Write/StrReplace ops."""

from __future__ import annotations

import json
import os
import re
import sys
from pathlib import Path

TRANSCRIPT = Path(
    r"C:\Users\laksh\.cursor\projects\d-Work-Projects-Latheif-Productions-Pixel-Pluz-Software-pixlpluzportal"
    r"\agent-transcripts\ca00464f-795f-4a27-bf61-556dff566421\ca00464f-795f-4a27-bf61-556dff566421.jsonl"
)
WORKSPACE = Path(r"d:\Work\Projects\Latheif Productions\Pixel Pluz\Software\pixlpluzportal")

EXPLICIT_TARGETS = {
    "app/api/admin/tasks/route.ts",
    "app/api/admin/task-submissions/route.ts",
    "app/api/admin/class-materials/route.ts",
    "app/api/admin/attendance/route.ts",
    "app/api/admin/complaints/route.ts",
    "app/api/admin/mentor-ratings/route.ts",
    "app/task-submissions/submit/[taskId]/page.tsx",
}

STUDENT_PREFIX = "app/api/student/"

NO_RESUBMIT_PATHS = {
    "app/api/admin/task-submissions/route.ts",
    "app/task-submissions/submit/[taskId]/page.tsx",
}

RESUBMIT_MARKERS = (
    "handleResubmit",
    "canStudentResubmit",
    "resubmitTask",
    "submission_history",
    "resubmit_deadline",
    "studentCanResubmit",
    "SubmissionHistoryEntry",
    "useSearchParams",
    "type: 'initial' | 'resubmit'",
    "isResubmitMode",
    "resubmit mode",
)


def normalize_path(raw: str) -> str | None:
    if not raw:
        return None
    p = raw.replace("\\", "/")
    prefix = "d:/work/projects/latheif productions/pixel pluz/software/pixlpluzportal/"
    if p.lower().startswith(prefix):
        p = p[len(prefix) :]
    m = re.search(r"pixlpluzportal[/\\](.+)$", p, re.I)
    if m:
        p = m.group(1)
    return p.replace("\\", "/").lstrip("/")


def is_target_path(rel: str) -> bool:
    if rel in EXPLICIT_TARGETS:
        return True
    return rel.startswith(STUDENT_PREFIX) and rel.endswith(".ts")


def has_resubmit_content(content: str) -> bool:
    return any(marker in content for marker in RESUBMIT_MARKERS)


def apply_str_replace(content: str | None, old: str, new: str) -> str | None:
    if content is None:
        return None
    if old not in content:
        return content
    return content.replace(old, new, 1)


def is_revert_shell_line(obj: dict) -> bool:
    try:
        for block in obj.get("message", {}).get("content", []):
            if block.get("type") != "tool_use" or block.get("name") != "Shell":
                continue
            cmd = block.get("input", {}).get("command", "")
            if "Remove-Item" in cmd and "app/api/admin/tasks" in cmd:
                return True
    except Exception:
        pass
    return False


def extract_tool_ops(obj: dict, line_no: int) -> list[dict]:
    ops: list[dict] = []
    content = obj.get("message", {}).get("content", [])
    if not isinstance(content, list):
        return ops
    for block in content:
        if block.get("type") != "tool_use":
            continue
        name = block.get("name")
        if name not in ("Write", "StrReplace"):
            continue
        inp = block.get("input") or {}
        path = normalize_path(inp.get("path", ""))
        if not path or not is_target_path(path):
            continue
        ops.append(
            {
                "line": line_no,
                "tool": name,
                "path": path,
                "contents": inp.get("contents"),
                "old_string": inp.get("old_string"),
                "new_string": inp.get("new_string"),
            }
        )
    return ops


def main() -> int:
    if not TRANSCRIPT.exists():
        print(f"ERROR: Transcript not found: {TRANSCRIPT}", file=sys.stderr)
        return 1

    files: dict[str, str | None] = {}
    no_resubmit: dict[str, str] = {}
    last_line: dict[str, int] = {}
    all_ops: list[dict] = []
    revert_line: int | None = None

    with TRANSCRIPT.open("r", encoding="utf-8") as f:
        for line_no, line in enumerate(f, start=1):
            line = line.strip()
            if not line:
                continue
            try:
                obj = json.loads(line)
            except json.JSONDecodeError:
                continue

            if is_revert_shell_line(obj):
                revert_line = line_no
                break

            all_ops.extend(extract_tool_ops(obj, line_no))

    for op in all_ops:
        path = op["path"]
        if op["tool"] == "Write" and op["contents"] is not None:
            files[path] = op["contents"]
            last_line[path] = op["line"]
            if path in NO_RESUBMIT_PATHS and not has_resubmit_content(op["contents"]):
                no_resubmit[path] = op["contents"]
        elif op["tool"] == "StrReplace":
            old = op.get("old_string")
            new = op.get("new_string")
            if old is not None and new is not None:
                updated = apply_str_replace(files.get(path), old, new)
                if updated is not None:
                    files[path] = updated
                    last_line[path] = op["line"]
                    if path in NO_RESUBMIT_PATHS and not has_resubmit_content(updated):
                        no_resubmit[path] = updated

    discovered = sorted({op["path"] for op in all_ops if op["path"].startswith(STUDENT_PREFIX)})
    targets = set(EXPLICIT_TARGETS) | set(discovered)

    written: list[str] = []
    failed: list[str] = []
    skipped_resubmit: list[str] = []

    for rel in sorted(targets):
        if rel in NO_RESUBMIT_PATHS and rel in no_resubmit:
            content = no_resubmit[rel]
            if rel in files and files[rel] and has_resubmit_content(files[rel]):
                skipped_resubmit.append(rel)
        elif rel in files and files[rel] is not None:
            content = files[rel]
        else:
            failed.append(rel)
            continue

        out_path = WORKSPACE / rel.replace("/", os.sep)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(content.replace("\r\n", "\n"), encoding="utf-8", newline="\n")
        written.append(rel)

    print("=== Recovery Report ===")
    print(f"Transcript lines processed: {revert_line or 'all'}")
    print(f"Total tool ops matched: {len(all_ops)}")
    print(f"Discovered student routes: {discovered or '(none)'}")
    print()
    print(f"Successfully written ({len(written)}):")
    for p in written:
        note = " [used pre-resubmit version]" if p in skipped_resubmit else ""
        print(f"  - {p} (last op ~line {last_line.get(p, '?')}){note}")
    print()
    if failed:
        print(f"Could NOT recover ({len(failed)}):")
        for p in failed:
            print(f"  - {p}")
    else:
        print("Could NOT recover: (none)")

    return 0 if not failed else 2


if __name__ == "__main__":
    raise SystemExit(main())
