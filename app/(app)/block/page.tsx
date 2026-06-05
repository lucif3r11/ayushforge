import { redirect } from "next/navigation";

// Block management has moved into the Train tab.
export default function BlockPage() {
  redirect("/train");
}
