import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createApiApp } from "../lib/api-app";

const app = createApiApp();

export default function handler(req: VercelRequest, res: VercelResponse) {
  app(req, res);
}
