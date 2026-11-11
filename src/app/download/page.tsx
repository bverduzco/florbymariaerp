import Link from "next/link";
import { promises as fs } from "fs";
import path from "path";

/**
 * /download — index page listing all available workbook versions.
 *
 * Server component that reads the /download/ folder and shows each .xlsx
 * as a clickable download link. Uses the /download/[version] route.
 */
async function listWorkbooks() {
  const dir = path.join(process.cwd(), "download");
  try {
    const files = await fs.readdir(dir);
    return files
      .filter((f) => f.endsWith(".xlsx"))
      .sort()
      .reverse();
  } catch {
    return [];
  }
}

const VERSION_BY_FILENAME: Record<string, string> = {
  "ERP Zai v1.7.xlsx": "v1.7",
  "ERP Zai v1.8.xlsx": "v1.8",
  "ERP Zai v1.8.1.xlsx": "v1.8.1",
  "ERP Zai v1.8.2.xlsx": "v1.8.2",
  "ERP Zai v1.8.3.xlsx": "v1.8.3",
  "Flor by Maria ERP v1.9.4.xlsx": "v1.9.4",
};

export default async function DownloadIndex() {
  const files = await listWorkbooks();

  return (
    <main style={{
      fontFamily: "system-ui, -apple-system, sans-serif",
      maxWidth: 720,
      margin: "60px auto",
      padding: "0 24px",
      color: "#1F2937",
    }}>
      <h1 style={{ fontSize: 28, marginBottom: 8 }}>Flor by Maria — ERP Workbooks</h1>
      <p style={{ color: "#6B7280", marginBottom: 32 }}>
        Click any version to download the .xlsx file.
      </p>

      <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: 12 }}>
        {files.map((fileName) => {
          const version = VERSION_BY_FILENAME[fileName] ?? fileName.replace(/\.xlsx$/, "").replace(/ERP Zai /, "");
          return (
            <li key={fileName}>
              <Link
                href={`/download/${version}`}
                style={{
                  display: "block",
                  padding: "16px 20px",
                  border: "1px solid #E5E7EB",
                  borderRadius: 8,
                  textDecoration: "none",
                  color: "#1F2937",
                  background: "#FFFFFF",
                  transition: "border-color 0.15s, transform 0.15s",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 16 }}>{fileName}</div>
                    <div style={{ color: "#6B7280", fontSize: 13, marginTop: 2 }}>
                      Click to download
                    </div>
                  </div>
                  <span style={{ fontSize: 24 }}>⬇</span>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>

      <p style={{ marginTop: 40, color: "#9CA3AF", fontSize: 12 }}>
        Latest version is <strong>v1.9.4</strong> — adds per-line color + variant tracking,
        ad-hoc purchase with no-SKU support, payment status dropdown, per-line cost basis
        (list / linked-purchase / manual), execution time tracking, and editable execution logs.
      </p>
    </main>
  );
}
