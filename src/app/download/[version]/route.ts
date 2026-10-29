import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

/**
 * GET /download/[version]
 *
 * Serves ERP workbook .xlsx files from a Next.js route handler.
 *
 * Why this exists:
 *   The public preview gateway filters out static file paths in /public/.
 *   Routing downloads through a Next.js dynamic route is the only way to
 *   deliver .xlsx files to the user's browser via the preview URL.
 *
 * Supported versions:
 *   v1.7, v1.8, v1.8.1, v1.8.2
 *
 * Example:
 *   GET /download/v1.8.2  →  returns ERP Zai v1.8.2.xlsx as attachment
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ version: string }> }
) {
  const { version } = await params;

  // Whitelist of allowed versions → actual filename in /download/
  const VERSION_MAP: Record<string, string> = {
    "v1.7": "ERP Zai v1.7.xlsx",
    "v1.8": "ERP Zai v1.8.xlsx",
    "v1.8.1": "ERP Zai v1.8.1.xlsx",
    "v1.8.2": "ERP Zai v1.8.2.xlsx",
    "v1.8.3": "ERP Zai v1.8.3.xlsx",
  };

  const fileName = VERSION_MAP[version];
  if (!fileName) {
    return NextResponse.json(
      {
        error: "Unknown version",
        requested: version,
        available: Object.keys(VERSION_MAP),
      },
      { status: 404 }
    );
  }

  const filePath = path.join(process.cwd(), "download", fileName);

  try {
    const fileBuffer = await fs.readFile(filePath);

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${fileName.replace(/"/g, "'")}"`,
        "Content-Length": fileBuffer.byteLength.toString(),
        "Cache-Control": "no-cache",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "File read failed", detail: message, path: filePath },
      { status: 500 }
    );
  }
}
