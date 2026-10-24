import { NextResponse } from "next/server"
import { execFile } from "child_process"
import { promisify } from "util"
import path from "path"
import { promises as fs } from "fs"

const execFileAsync = promisify(execFile)

export const dynamic = "force-dynamic"
export const maxDuration = 60

/**
 * POST /api/backup
 * Generates a full backup Excel from the SQLite database.
 * Returns the file path + auto-download trigger.
 */
export async function POST() {
  const scriptPath = path.join(process.cwd(), "scripts", "generate_backup_excel.py")
  const downloadDir = "/home/z/my-project/download"

  // Ensure download dir exists
  await fs.mkdir(downloadDir, { recursive: true })

  try {
    const { stdout } = await execFileAsync("python3", [scriptPath], {
      maxBuffer: 1024 * 1024 * 50,
    })

    // Parse the output to find the file path
    const outputLine = stdout.split("\n").find((l) => l.startsWith("OUTPUT:"))
    if (!outputLine) {
      throw new Error("Backup script did not return a file path")
    }
    const filePath = outputLine.replace("OUTPUT:", "").trim()
    const fileName = path.basename(filePath)

    // Parse tab info
    const tabs = stdout
      .split("\n")
      .filter((l) => l.startsWith("TAB:"))
      .map((l) => {
        const parts = l.replace("TAB:", "").split(":")
        return { name: parts[0], rows: parts[1] || "?" }
      })

    return NextResponse.json({
      success: true,
      fileName,
      downloadPath: filePath,
      tabCount: tabs.length,
      tabs,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: "Failed to generate backup", detail: msg }, { status: 500 })
  }
}
