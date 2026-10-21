import { NextResponse } from "next/server"
import { writeFile, mkdir } from "fs/promises"
import { existsSync } from "fs"
import { join } from "path"
import { exec } from "child_process"
import { promisify } from "util"

const execAsync = promisify(exec)
export const dynamic = "force-dynamic"
export const maxDuration = 60

/**
 * POST /api/upload
 * Accepts multipart/form-data with field "file" = .xlsx file.
 * Saves to /home/z/my-project/upload/Floristry_ERP_uploaded.xlsx,
 * then runs the Python parser + seed script to refresh the DB.
 */
export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get("file")
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "No file uploaded (field name: file)" }, { status: 400 })
    }

    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      return NextResponse.json({ error: "Only .xlsx files are supported" }, { status: 400 })
    }

    const uploadDir = "/home/z/my-project/upload"
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true })
    }
    const targetPath = join(uploadDir, "Floristry_ERP_uploaded.xlsx")
    const bytes = await file.arrayBuffer()
    await writeFile(targetPath, Buffer.from(bytes))

    // Run the parser + seed in sequence
    const scriptDir = "/home/z/my-project/scripts"

    // The Python parser reads from a fixed path; copy uploaded file there.
    await execAsync(
      `cp "${targetPath}" "/home/z/my-project/upload/Floristry_ERP updated b.xlsx"`,
    )

    const { stdout: parseOut, stderr: parseErr } = await execAsync(
      `python ${scriptDir}/parse_erp.py`,
    )
    if (parseErr && !parseErr.includes("UserWarning")) {
      console.error("Parser stderr:", parseErr)
    }
    console.log("Parser output:", parseOut)

    const { stdout: seedOut, stderr: seedErr } = await execAsync(
      `cd /home/z/my-project && bun run scripts/seed.ts`,
    )
    console.log("Seed output:", seedOut)
    if (seedErr) console.error("Seed stderr:", seedErr)

    // Extract counts from the parser output
    const counts = {
      suppliers: parseInt(/Suppliers:\s+(\d+)/.exec(parseOut)?.[1] ?? "0"),
      materials: parseInt(/Materials:\s+(\d+)/.exec(parseOut)?.[1] ?? "0"),
      recipes: parseInt(/Recipes:\s+(\d+)/.exec(parseOut)?.[1] ?? "0"),
      products: parseInt(/Products:\s+(\d+)/.exec(parseOut)?.[1] ?? "0"),
    }

    return NextResponse.json({
      success: true,
      message: "ERP refreshed",
      counts,
      fileName: file.name,
    })
  } catch (err) {
    console.error("Upload error:", err)
    return NextResponse.json(
      { error: "Failed to process uploaded ERP file", detail: String(err) },
      { status: 500 },
    )
  }
}
