import { redirect } from "next/navigation"

// TEMPORARY: redirect to wireframe HTML so user can view it in preview panel
// with mobile views. Revert to redirect("/dashboard") when done.
export default function RootPage() {
  redirect("/flor-wireframe.html")
}
