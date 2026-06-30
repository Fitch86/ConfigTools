/**
 * Project store — load/save project directories.
 *
 * Project dir: `output/<name>/`
 *   - project.json  — source of truth (input choices for rebuild)
 *   - server.json   — the generated Xray config
 *   - README.md     — summary + share links
 *   - certs/        — cert.pem + key.pem (if WS/gRPC present)
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { formatJson } from "../format/json.js";

// ---------------------------------------------------------------------------
// Project data
// ---------------------------------------------------------------------------

export interface ProjectData {
  name: string;
  engine: "xray";
  logLevel?: string;
  routingPreset?: string;
  inbounds: InboundEntry[];
  ctx: ProjectContext;
}

export interface InboundEntry {
  moduleId: string;
  options: Record<string, unknown>;
}

export interface ProjectContext {
  uuid: string;
  realityKeyPair?: { privateKey: string; publicKey: string };
  shortIds?: string[];
  password: string;
}

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const OUTPUT_DIR = "output";

export function projectDir(name: string): string {
  return resolve(OUTPUT_DIR, name);
}

export function projectJsonPath(name: string): string {
  return join(projectDir(name), "project.json");
}

export function serverJsonPath(name: string): string {
  return join(projectDir(name), "server.json");
}

export function readmePath(name: string): string {
  return join(projectDir(name), "README.md");
}

// ---------------------------------------------------------------------------
// List projects
// ---------------------------------------------------------------------------

export function listProjects(): string[] {
  if (!existsSync(OUTPUT_DIR)) return [];
  return readdirSync(OUTPUT_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .filter(d => existsSync(join(OUTPUT_DIR, d.name, "project.json")))
    .map(d => d.name);
}

// ---------------------------------------------------------------------------
// Load project
// ---------------------------------------------------------------------------

export function loadProject(name: string): ProjectData {
  const path = projectJsonPath(name);
  const raw = readFileSync(path, "utf-8");
  return JSON.parse(raw) as ProjectData;
}

// ---------------------------------------------------------------------------
// Save project
// ---------------------------------------------------------------------------

export interface SaveProjectInput {
  project: ProjectData;
  serverConfig: Record<string, unknown>;
  readme: string;
  files?: { name: string; content: string }[];
}

export function saveProject(input: SaveProjectInput): void {
  const dir = projectDir(input.project.name);
  mkdirSync(dir, { recursive: true });

  // project.json (source of truth)
  writeFileSync(join(dir, "project.json"), formatJson(input.project) + "\n", "utf-8");

  // server.json (generated config)
  writeFileSync(join(dir, "server.json"), formatJson(input.serverConfig) + "\n", "utf-8");

  // README.md
  writeFileSync(join(dir, "README.md"), input.readme, "utf-8");

  // Extra files (certs etc.)
  if (input.files) {
    for (const file of input.files) {
      const filePath = join(dir, file.name);
      mkdirSync(join(filePath, ".."), { recursive: true });
      writeFileSync(filePath, file.content, "utf-8");
    }
  }
}
