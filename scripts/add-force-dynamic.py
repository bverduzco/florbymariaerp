#!/usr/bin/env python3
"""Add `export const dynamic = "force-dynamic"` to all ERP page.tsx files.

This prevents Next.js from trying to statically prerender these pages at build
time, which requires DB access on Vercel's build environment (and can fail
when env vars or DB connectivity aren't available at build time).
"""
import re
import sys
from pathlib import Path

DYNAMIC_LINE = 'export const dynamic = "force-dynamic"\n'

ERP_PAGES_DIR = Path("/home/z/my-project/src/app/(erp)")

def process_file(path: Path) -> bool:
    """Returns True if file was modified, False if skipped."""
    text = path.read_text(encoding="utf-8")
    if "force-dynamic" in text:
        return False

    # Find the first import statement (start of line)
    m = re.search(r"^import ", text, flags=re.MULTILINE)
    if not m:
        print(f"!! No import found in {path}", file=sys.stderr)
        return False

    insert_pos = m.start()
    # Insert the dynamic export with a blank line separator
    new_text = text[:insert_pos] + DYNAMIC_LINE + "\n" + text[insert_pos:]
    path.write_text(new_text, encoding="utf-8")
    return True

def main():
    pages = sorted(ERP_PAGES_DIR.rglob("page.tsx"))
    modified = 0
    skipped = 0
    for p in pages:
        if process_file(p):
            modified += 1
            print(f"  MODIFIED: {p}")
        else:
            skipped += 1
            print(f"  skipped:  {p}")
    print(f"\nTotal: {modified} modified, {skipped} skipped")

if __name__ == "__main__":
    main()
