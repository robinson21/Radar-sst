import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  res.json({ message: "Cron scan endpoint - functionality is currently simplified", timestamp: new Date().toISOString() });
}
