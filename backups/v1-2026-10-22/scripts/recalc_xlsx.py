"""
Convert an .xlsx file's formulas to cached values using LibreOffice headless.
LibreOffice opens the file, computes all formulas, and saves it back with cached results.
This lets openpyxl's data_only=True mode return actual values instead of None.

Usage: python recalc_xlsx.py <input.xlsx> [output.xlsx]
"""
import os
import shutil
import subprocess
import sys
import tempfile


def recalc(input_path: str, output_path: str | None = None) -> str:
    if output_path is None:
        output_path = input_path
    if not os.path.exists(input_path):
        raise FileNotFoundError(input_path)

    # LibreOffice needs a writable output dir
    out_dir = tempfile.mkdtemp(prefix="lo_recalc_")
    try:
        # Convert to xlsx (forces formula recalculation)
        result = subprocess.run(
            [
                "libreoffice", "--headless",
                "--convert-to", "xlsx",
                "--outdir", out_dir,
                input_path,
            ],
            capture_output=True,
            text=True,
            timeout=60,
        )
        if result.returncode != 0:
            print("LibreOffice stderr:", result.stderr, file=sys.stderr)
            raise RuntimeError(f"LibreOffice conversion failed: {result.returncode}")

        # Find the converted file (same basename)
        basename = os.path.basename(input_path)
        converted = os.path.join(out_dir, basename)
        if not os.path.exists(converted):
            # Try without spaces in name
            for f in os.listdir(out_dir):
                if f.endswith(".xlsx"):
                    converted = os.path.join(out_dir, f)
                    break

        if not os.path.exists(converted):
            raise RuntimeError(f"LibreOffice did not produce output in {out_dir}")

        # Move to output path (use copyfile to avoid chmod on root-owned files)
        shutil.copyfile(converted, output_path)
        return output_path
    finally:
        shutil.rmtree(out_dir, ignore_errors=True)


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python recalc_xlsx.py <input.xlsx> [output.xlsx]")
        sys.exit(1)
    inp = sys.argv[1]
    out = sys.argv[2] if len(sys.argv) > 2 else inp
    result = recalc(inp, out)
    print(f"Recalculated: {result}")
