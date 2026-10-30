export async function downloadResponse(
  response: Response,
  fallbackFileName: string,
): Promise<string> {
  const disposition = response.headers.get("Content-Disposition") ?? ""
  const encodedName =
    disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1] ??
    disposition.match(/filename="?([^";]+)"?/i)?.[1]

  let fileName = fallbackFileName
  if (encodedName) {
    try {
      fileName = decodeURIComponent(encodedName)
    } catch {
      fileName = encodedName
    }
  }

  const blob = await response.blob()
  if (blob.size === 0) {
    throw new Error("The generated file was empty")
  }

  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)

  return fileName
}
