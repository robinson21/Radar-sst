import { runScan } from "../../lib/compliance-service";

export default async function handler(_req: unknown, res: { json: (body: unknown) => void }) {
  res.json(await runScan("automatic"));
}
