"""
v1.8.3 fix script — remove broken external link.

Problem identified:
  The workbook contains an external link to a missing file called "Prices":
    xl/externalLinks/externalLink1.xml
    xl/externalLinks/_rels/externalLink1.xml.rels  →  Target="Prices"  Type="xlPathMissing"

  Excel tries to refresh this external link on open, fails (file doesn't exist),
  and triggers a "We found a problem with some content... do you want us to recover"
  repair prompt. The recovered file works fine but the prompt is alarming.

  This external link is a leftover from an older workbook version (likely created
  before v1.7). It's not referenced by any active formula — Excel itself marks
  the Type as "xlPathMissing" indicating it already knows the file is gone.

Fix:
  1. Load the workbook
  2. Clear the external_links list (openpyxl exposes it as wb._external_links)
  3. Remove the orphan files from the saved zip
  4. Save as ERP Zai v1.8.3.xlsx (overwrite the broken one)

Note: this fix is INDEPENDENT of the v1.8.3 changes (col X addition).
  The col X changes are valid. The external link is pre-existing corruption
  that finally got noticed when the user opened the file fresh.

Run:
    python /home/z/my-project/scripts/v1_8_3_fix_external_link.py
"""
import zipfile
import shutil
from pathlib import Path
from openpyxl import load_workbook

SRC = Path("/home/z/my-project/download/ERP Zai v1.8.3.xlsx")
BACKUP = Path("/home/z/my-project/download/ERP Zai v1.8.3.broken-backup.xlsx")
DST = Path("/home/z/my-project/download/ERP Zai v1.8.3.xlsx")  # overwrite

# Files to remove from the xlsx package (broken external link)
BROKEN_FILES = [
    "xl/externalLinks/externalLink1.xml",
    "xl/externalLinks/_rels/externalLink1.xml.rels",
]


def remove_external_links_via_openpyxl():
    """Approach 1: use openpyxl to clear the external_links list before save."""
    print(f"Loading: {SRC.name}")
    wb = load_workbook(SRC, data_only=False)
    
    # Inspect what's there
    print(f"  External links before: {len(wb._external_links)}")
    for i, link in enumerate(wb._external_links):
        # ExternalLink objects have .external_book or similar
        try:
            book = link.external_book
            print(f"    [{i}] {book}")
        except (AttributeError, TypeError):
            print(f"    [{i}] {link}")
    
    # Clear the list — openpyxl will not write the parts if list is empty
    wb._external_links = []
    print(f"  External links after clearing: {len(wb._external_links)}")
    
    # Save to a temp file first to verify
    tmp = SRC.with_suffix(".tmp.xlsx")
    wb.save(tmp)
    print(f"  Saved to temp file: {tmp.name}")
    return tmp


def verify_clean_file(path):
    """Check the resulting file has no external link references."""
    with zipfile.ZipFile(path) as z:
        all_files = z.namelist()
        bad = [f for f in BROKEN_FILES if f in all_files]
        if bad:
            print(f"  ⚠ Still contains: {bad}")
            return False
        # Also check workbook.xml.rels
        rels = z.read("xl/_rels/workbook.xml.rels").decode("utf-8")
        if "externalLink" in rels:
            print(f"  ⚠ workbook.xml.rels still references externalLink")
            # Find context
            idx = rels.find("externalLink")
            print(f"    Context: ...{rels[max(0,idx-80):idx+200]}...")
            return False
        # Check [Content_Types].xml
        ct = z.read("[Content_Types].xml").decode("utf-8")
        if "externalLink" in ct:
            print(f"  ⚠ [Content_Types].xml still references externalLink")
            return False
        # Check workbook.xml itself
        wbxml = z.read("xl/workbook.xml").decode("utf-8")
        if "externalLink" in wbxml or "externalReferences" in wbxml:
            print(f"  ⚠ workbook.xml still references externalReferences")
            return False
    print(f"  ✓ No external link references found in saved file")
    return True


def main():
    if not SRC.exists():
        raise FileNotFoundError(f"Source not found: {SRC}")
    
    # Back up the broken file
    print(f"\nBacking up broken file → {BACKUP.name}")
    shutil.copy2(SRC, BACKUP)
    
    print("\n[1] Removing external_links via openpyxl...")
    tmp = remove_external_links_via_openpyxl()
    
    print("\n[2] Verifying saved file is clean...")
    if verify_clean_file(tmp):
        print(f"\n[3] Replacing {SRC.name} with clean version")
        # Replace the original
        tmp.replace(DST)
        print(f"  ✓ Replaced. Original kept as backup at: {BACKUP.name}")
    else:
        print(f"\n  ⚠ Verification failed. Temp file kept at: {tmp.name}")
        print(f"  Manual inspection needed.")


if __name__ == "__main__":
    main()
