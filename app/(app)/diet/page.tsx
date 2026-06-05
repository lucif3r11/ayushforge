import { redirect } from "next/navigation";

// Renamed to /nutrition.
export default function DietPage() {
  redirect("/nutrition");
}
