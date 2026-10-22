import { NextRequest, NextResponse } from "next/server"
import { readFile } from "fs/promises"
import path from "path"

export const dynamic = "force-dynamic"

/**
 * GET /download/<filename>
 * Serves files from the /home/z/my-project/download/ folder.
 * Used for generated PDFs, Excel drafts, etc.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path: pathParts } = await params
  const fileName = pathParts.join("/")

  // Prevent path traversal
  if (fileName.includes("..") || fileName.startsWith("/")) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 })
  }

  const fullPath = path.join("/home/z/my-project/download", fileName)

  try {
    const fileBuffer = await readFile(fullPath)

    // Determine content type based on extension
    const ext = path.extname(fileName).toLowerCase()
    let contentType = "application/octet-stream"
    if (ext === ".pdf") contentType = "application/pdf"
    else if (ext === ".xlsx") contentType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    else if (ext === ".csv") contentType = "text/csv"

    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `inline; filename="${path.basename(fileName)}"`,
        "Content-Length": fileBuffer.byteLength.toString(),
      },
    })
  } catch {
    return NextResponse.json({ error: "File not found" }, { status: 404 })
  }
}
