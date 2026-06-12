#!/usr/bin/env python3
"""
generate.py — ADR index generator (stdlib only, no third-party deps).

Installed at docs/adr/generate.py; operates on the directory it lives in.

Usage:
  python3 generate.py           regenerate README.md and .adr-index.json in place
  python3 generate.py --check   compare regenerated output to on-disk files;
                                exit 1 if they differ (ignores the JSON `generated`
                                timestamp field so --check is stable across runs)
"""

import difflib
import json
import os
import re
import sys
from datetime import datetime, timezone

# ---------------------------------------------------------------------------
# Paths (all relative to the directory this script lives in)
# ---------------------------------------------------------------------------

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
README_PATH = os.path.join(SCRIPT_DIR, "README.md")
INDEX_PATH = os.path.join(SCRIPT_DIR, ".adr-index.json")

ACTIVE_STATUSES = {"proposed", "accepted"}
ADR_FILENAME_RE = re.compile(r"^\d{4}-.+\.md$")

# ---------------------------------------------------------------------------
# Minimal YAML frontmatter parser
#
# Supports the subset used by our template:
#   - top-level scalar:    key: value  (with or without quotes)
#   - inline list:         key: [a, b, c]
#   - block list:
#       key:
#         - item1
#         - item2
#   - null scalar:         key: null
#   - bool scalar:         key: true / false
# ---------------------------------------------------------------------------

def _strip_quotes(s: str) -> str:
    s = s.strip()
    if (s.startswith('"') and s.endswith('"')) or \
       (s.startswith("'") and s.endswith("'")):
        return s[1:-1]
    return s


def _parse_inline_list(raw: str) -> list:
    """Parse '[a, b, c]' -> ['a', 'b', 'c']."""
    inner = raw.strip()
    if inner.startswith("[") and inner.endswith("]"):
        inner = inner[1:-1]
    if not inner.strip():
        return []
    return [_strip_quotes(item) for item in inner.split(",") if item.strip()]


def _coerce(value: str):
    """Coerce a raw scalar string to Python bool/None/str."""
    v = value.strip()
    if v == "true":
        return True
    if v == "false":
        return False
    if v == "null" or v == "~" or v == "":
        return None
    return _strip_quotes(v)


def parse_frontmatter(text: str) -> dict:
    """
    Extract and parse YAML frontmatter from a Markdown string.
    Returns a dict of the parsed keys.  Raises ValueError if no frontmatter.
    """
    lines = text.splitlines()
    if not lines or lines[0].strip() != "---":
        # Check if there's an HTML comment before the frontmatter
        start = 0
        for i, line in enumerate(lines):
            if line.strip() == "---":
                start = i
                break
        else:
            raise ValueError("No YAML frontmatter found")
        lines = lines[start:]

    # Find the closing ---
    end = None
    for i in range(1, len(lines)):
        if lines[i].strip() == "---":
            end = i
            break
    if end is None:
        raise ValueError("Frontmatter not closed with ---")

    fm_lines = lines[1:end]
    result = {}
    i = 0
    while i < len(fm_lines):
        line = fm_lines[i]
        if not line.strip():
            i += 1
            continue

        m = re.match(r'^([A-Za-z0-9_-]+)\s*:(.*)', line)
        if not m:
            i += 1
            continue

        key = m.group(1)
        raw_value = m.group(2).strip()

        if raw_value.startswith("["):
            result[key] = _parse_inline_list(raw_value)
            i += 1
        elif raw_value == "":
            # Possible block list or empty scalar — peek ahead
            block_items = []
            j = i + 1
            while j < len(fm_lines):
                item_m = re.match(r'^\s+-\s+(.*)', fm_lines[j])
                if item_m:
                    block_items.append(_strip_quotes(item_m.group(1).strip()))
                    j += 1
                else:
                    break
            if block_items:
                result[key] = block_items
                i = j
            else:
                result[key] = None
                i += 1
        else:
            result[key] = _coerce(raw_value)
            i += 1

    return result


# ---------------------------------------------------------------------------
# ADR loading
# ---------------------------------------------------------------------------

def load_adrs(adr_dir: str) -> list:
    """Scan adr_dir for NNNN-*.md, parse frontmatter, return list sorted by id."""
    records = []
    for fname in os.listdir(adr_dir):
        if not ADR_FILENAME_RE.match(fname):
            continue
        path = os.path.join(adr_dir, fname)
        try:
            with open(path, encoding="utf-8") as fh:
                text = fh.read()
            fm = parse_frontmatter(text)
        except Exception as exc:
            print(f"WARNING: skipping {fname}: {exc}", file=sys.stderr)
            continue

        adr_id = fm.get("id") or fname[:4]
        if isinstance(adr_id, (int, float)):
            adr_id = str(int(adr_id)).zfill(4)
        else:
            adr_id = str(adr_id).strip().zfill(4)

        applies_to = fm.get("applies-to") or []
        if not isinstance(applies_to, list):
            applies_to = [applies_to] if applies_to else []

        tags = fm.get("tags") or []
        if not isinstance(tags, list):
            tags = [tags] if tags else []

        records.append({
            "id": adr_id,
            "title": fm.get("title", "(untitled)"),
            "status": (fm.get("status") or "proposed").lower(),
            "date": fm.get("date", ""),
            "file": fname,
            "applies_to": applies_to,
            "global": bool(fm.get("global", False)),
            "tags": tags,
            "superseded_by": fm.get("superseded-by"),
        })

    records.sort(key=lambda r: r["id"])
    return records


# ---------------------------------------------------------------------------
# README generator
# ---------------------------------------------------------------------------

def _md_table(headers: list, rows: list) -> str:
    lines = []
    lines.append("| " + " | ".join(headers) + " |")
    lines.append("| " + " | ".join("---" for _ in headers) + " |")
    for row in rows:
        lines.append("| " + " | ".join(str(c) for c in row) + " |")
    return "\n".join(lines)


def generate_readme(adrs: list) -> str:
    active = [a for a in adrs if a["status"] in ACTIVE_STATUSES]
    archived = [a for a in adrs if a["status"] not in ACTIVE_STATUSES]

    global_active = [a for a in active if a["global"]]
    pathbound_active = [a for a in active if not a["global"]]

    lines = []

    lines.append("## Consulting ADRs")
    lines.append("")
    lines.append(
        "This directory contains Architecture Decision Records (ADRs) — binding records\n"
        "of significant architectural and process decisions for this project.\n"
        "\n"
        "**Before changing architecture or established patterns, any coding agent MUST:**\n"
        "\n"
        "1. Read this index (`README.md`) to get an overview of active decisions.\n"
        "2. Read every ADR whose `applies-to` globs match files you are about to touch.\n"
        "3. Read all ADRs marked `global: true` — they apply everywhere, unconditionally.\n"
        "4. Do **not** override or re-litigate an `accepted` decision. If your change\n"
        "   requires violating one, surface the conflict explicitly and propose a\n"
        "   superseding ADR instead of silently proceeding.\n"
        "\n"
        "The index below is generated from YAML frontmatter by `generate.py`.\n"
        "Do not edit `README.md` or `.adr-index.json` by hand."
    )
    lines.append("")

    if global_active:
        lines.append("## Global decisions")
        lines.append("")
        rows = [
            [f"[ADR-{a['id']}]({a['file']})", a["title"], a["status"]]
            for a in global_active
        ]
        lines.append(_md_table(["ID", "Title", "Status"], rows))
        lines.append("")

    lines.append("## Active decisions")
    lines.append("")
    if pathbound_active:
        rows = [
            [
                f"[ADR-{a['id']}]({a['file']})",
                a["title"],
                a["status"],
                ", ".join(a["applies_to"]),
                ", ".join(a["tags"]),
            ]
            for a in pathbound_active
        ]
        lines.append(_md_table(["ID", "Title", "Status", "Applies to", "Tags"], rows))
    else:
        lines.append("_No path-bound active ADRs._")
    lines.append("")

    lines.append("## Archived")
    lines.append("")
    if archived:
        rows = [
            [
                f"[ADR-{a['id']}]({a['file']})",
                a["title"],
                a["status"],
                str(a["superseded_by"]) if a["superseded_by"] else "",
            ]
            for a in archived
        ]
        lines.append(_md_table(["ID", "Title", "Status", "Superseded by"], rows))
    else:
        lines.append("_No archived ADRs._")
    lines.append("")

    lines.append("<!-- generated by generate.py — do not edit by hand -->")
    lines.append("")

    return "\n".join(lines)


# ---------------------------------------------------------------------------
# JSON manifest generator
# ---------------------------------------------------------------------------

def generate_index_json(adrs: list, timestamp: str) -> str:
    """Build .adr-index.json — active, path-bound, non-global ADRs only."""
    manifest_adrs = [
        {
            "id": a["id"],
            "title": a["title"],
            "status": a["status"],
            "file": a["file"],
            "applies_to": a["applies_to"],
            "tags": a["tags"],
        }
        for a in adrs
        if a["status"] in ACTIVE_STATUSES
        and not a["global"]
        and len(a["applies_to"]) > 0
    ]
    doc = {"generated": timestamp, "adrs": manifest_adrs}
    return json.dumps(doc, indent=2) + "\n"


# ---------------------------------------------------------------------------
# --check helpers
# ---------------------------------------------------------------------------

def _strip_generated_field(json_text: str) -> str:
    return re.sub(r'^\s*"generated"\s*:.*\n', "", json_text, flags=re.MULTILINE)


def _read_file(path: str):
    try:
        with open(path, encoding="utf-8") as fh:
            return fh.read()
    except FileNotFoundError:
        return None


def _diff_summary(label: str, on_disk, expected: str) -> str:
    on_disk_lines = (on_disk or "").splitlines(keepends=True)
    expected_lines = expected.splitlines(keepends=True)
    diff = list(difflib.unified_diff(
        on_disk_lines, expected_lines,
        fromfile=f"{label} (on disk)",
        tofile=f"{label} (expected)",
        n=3,
    ))
    return "".join(diff)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    check_mode = "--check" in sys.argv

    adrs = load_adrs(SCRIPT_DIR)
    timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    readme_content = generate_readme(adrs)
    index_content = generate_index_json(adrs, timestamp)

    if check_mode:
        ok = True

        disk_readme = _read_file(README_PATH)
        if disk_readme != readme_content:
            diff = _diff_summary("README.md", disk_readme, readme_content)
            print(f"README.md is out of date:\n{diff}", file=sys.stderr)
            ok = False

        disk_index = _read_file(INDEX_PATH)
        disk_index_cmp = _strip_generated_field(disk_index or "")
        index_cmp = _strip_generated_field(index_content)
        if disk_index_cmp != index_cmp:
            diff = _diff_summary(".adr-index.json", disk_index, index_content)
            print(f".adr-index.json is out of date:\n{diff}", file=sys.stderr)
            ok = False

        if ok:
            print("ADR index is up to date.", file=sys.stderr)
            sys.exit(0)
        else:
            print("\nRun `python3 docs/adr/generate.py` to regenerate.", file=sys.stderr)
            sys.exit(1)
    else:
        with open(README_PATH, "w", encoding="utf-8") as fh:
            fh.write(readme_content)
        with open(INDEX_PATH, "w", encoding="utf-8") as fh:
            fh.write(index_content)
        print(f"Generated {README_PATH}")
        print(f"Generated {INDEX_PATH}")


if __name__ == "__main__":
    main()
