import { json } from "@/lib/api";
import { latestResult } from "@/lib/pipeline";

export const dynamic = "force-dynamic";

export async function GET() {
  return json({ result: await latestResult() });
}
