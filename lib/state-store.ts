import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { neon } from "@neondatabase/serverless";
import type { AppState, NormUpdate } from "../src/types";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, "..");
const dataDir = path.join(projectRoot, "data");
const statePath = path.join(dataDir, "state.json");
const snapshotDir = path.join(dataDir, "snapshots");
const databaseUrl = process.env.DATABASE_URL;

type SnapshotRecord = {
  source: string;
  capturedAt: string;
  mode: string;
  remoteUrl: string;
  extractedCount: number;
  content: string;
};

let sqlClient: ReturnType<typeof neon> | null = databaseUrl ? neon(databaseUrl) : null;
let dbReady = false;

async function ensureDatabase() {
  if (!sqlClient || dbReady) {
    return;
  }

  await sqlClient`
    CREATE TABLE IF NOT EXISTS app_state (
      id text PRIMARY KEY,
      payload jsonb NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `;

  await sqlClient`
    CREATE TABLE IF NOT EXISTS app_snapshots (
      source text PRIMARY KEY,
      payload jsonb NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `;

  dbReady = true;
}

export function getStatePath() {
  return databaseUrl ? "postgres://app_state" : statePath;
}

export async function initializeStorage() {
  if (databaseUrl) {
    await ensureDatabase();
    return;
  }

  await mkdir(dataDir, { recursive: true });
  await mkdir(snapshotDir, { recursive: true });
}

export async function loadStoredState(): Promise<Partial<AppState> | null> {
  await initializeStorage();

  if (sqlClient) {
    await ensureDatabase();
    const rows = await sqlClient`
      SELECT payload
      FROM app_state
      WHERE id = 'default'
      LIMIT 1
    `;

    return (rows[0] as { payload?: Partial<AppState> } | undefined)?.payload ?? null;
  }

  try {
    const raw = await readFile(statePath, "utf8");
    return JSON.parse(raw) as Partial<AppState>;
  } catch {
    return null;
  }
}

export async function saveStoredState(state: AppState) {
  await initializeStorage();

  if (sqlClient) {
    await ensureDatabase();
    await sqlClient`
      INSERT INTO app_state (id, payload, updated_at)
      VALUES ('default', ${JSON.stringify(state)}::jsonb, now())
      ON CONFLICT (id)
      DO UPDATE SET payload = EXCLUDED.payload, updated_at = now()
    `;
    return;
  }

  await writeFile(statePath, JSON.stringify(state, null, 2), "utf8");
}

export async function saveSnapshot(
  source: string,
  mode: "snapshot" | "remote",
  remoteUrl: string,
  content: string,
  extractedItems: NormUpdate[],
) {
  const payload: SnapshotRecord = {
    source,
    capturedAt: new Date().toISOString(),
    mode,
    remoteUrl,
    extractedCount: extractedItems.length,
    content,
  };

  await initializeStorage();

  if (sqlClient) {
    await ensureDatabase();
    await sqlClient`
      INSERT INTO app_snapshots (source, payload, updated_at)
      VALUES (${source}, ${JSON.stringify(payload)}::jsonb, now())
      ON CONFLICT (source)
      DO UPDATE SET payload = EXCLUDED.payload, updated_at = now()
    `;
    return;
  }

  const filePath = path.join(snapshotDir, `${source.toLowerCase()}.json`);
  await writeFile(filePath, JSON.stringify(payload, null, 2), "utf8");
}
