import { redirect } from "next/navigation"

// The old ERP single-page app lived here. The new UI is at /dashboard
// with 21 standalone routes. Redirect to keep one entry point.
export default function RootPage() {
  redirect("/dashboard")
}
