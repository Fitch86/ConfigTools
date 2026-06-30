/**
 * configtools Web UI — Hono HTTP server.
 *
 * Serves both the REST API and static frontend files.
 * Launched via `configtools ui` or `configtools ui --port 8080`.
 */

import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { cors } from "hono/cors";
import { readFileSync, readdirSync, existsSync, writeFileSync, mkdirSync } from "node:fs";
import { join, resolve, extname } from "node:path";
import { fileURLToPath } from "node:url";

import { listProjects, loadProject, projectDir, serverJsonPath } from "../project/store.js";
import { assembleXrayConfig } from "../engines/xray/assembler.js";
import { validateXrayConfig } from "../validate/index.js";
import { formatJson, formatJsonString } from "../format/json.js";
import { getAllModules } from "../engines/xray/registry.js";
import { generateUuid } from "../crypto/uuid.js";
import { generateRealityKeyPair } from "../crypto/reality-keys.js";
import { generateShortIds } from "../crypto/short-id.js";
import { generatePassword } from "../crypto/password.js";
import { generateSelfSignedCert } from "../cert/self-signed.js";
import type { BuildContext } from "../engines/xray/module-api.js";

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

const app = new Hono();

// CORS for local dev
app.use("*", cors());

// ---------------------------------------------------------------------------
// API: Modules
// ---------------------------------------------------------------------------

app.get("/api/modules", (c) => {
  const modules = getAllModules().map(m => ({
    id: m.id,
    label: m.label,
    prompts: m.prompts,
  }));
  return c.json(modules);
});

// ---------------------------------------------------------------------------
// API: Projects
// ---------------------------------------------------------------------------

app.get("/api/projects", (c) => {
  const names = listProjects();
  const projects = names.map(name => {
    try {
      const data = loadProject(name);
      return {
        name,
        engine: data.engine,
        inboundIds: data.inbounds.map(ib => ib.moduleId),
        logLevel: data.logLevel,
        routingPreset: data.routingPreset,
      };
    } catch {
      return { name, engine: "unknown", inboundIds: [], logLevel: "", routingPreset: "" };
    }
  });
  return c.json(projects);
});

app.get("/api/projects/:name", (c) => {
  const name = c.req.param("name");
  try {
    const data = loadProject(name);
    const dir = projectDir(name);
    // Read server.json
    const serverJsonPath2 = join(dir, "server.json");
    const serverJson = existsSync(serverJsonPath2)
      ? JSON.parse(readFileSync(serverJsonPath2, "utf-8"))
      : null;
    // Read README
    const readmePath = join(dir, "README.md");
    const readme = existsSync(readmePath) ? readFileSync(readmePath, "utf-8") : null;
    // Read cert files
    const certPath = join(dir, "certs", "cert.pem");
    const keyPath = join(dir, "certs", "key.pem");
    const certs = {
      cert: existsSync(certPath) ? readFileSync(certPath, "utf-8") : null,
      key: existsSync(keyPath) ? readFileSync(keyPath, "utf-8") : null,
    };
    return c.json({ project: data, serverJson, readme, certs });
  } catch (e: any) {
    return c.json({ error: e.message }, 404);
  }
});

app.get("/api/projects/:name/files/:path{.*}", (c) => {
  const name = c.req.param("name");
  const filePath = c.req.param("path");
  const fullPath = join(projectDir(name), filePath);

  if (!existsSync(fullPath)) {
    return c.json({ error: "File not found" }, 404);
  }
  return c.text(readFileSync(fullPath, "utf-8"));
});

// ---------------------------------------------------------------------------
// API: Generate new project
// ---------------------------------------------------------------------------

app.post("/api/generate", async (c) => {
  const body = await c.req.json();
  const { name, logLevel, routingPreset, inbounds: inboundSpecs } = body as {
    name: string;
    logLevel: string;
    routingPreset: string;
    inbounds: { moduleId: string; options: Record<string, unknown> }[];
  };

  if (!name || !inboundSpecs || inboundSpecs.length === 0) {
    return c.json({ error: "name and inbounds are required" }, 400);
  }

  // Pre-process inbound options: the wizard sends raw form values
  // that need normalization before passing to module.build()
  for (const spec of inboundSpecs) {
    const opts = spec.options;
    // serverNames: comma-separated string → string[]
    if (typeof opts.serverNames === "string") {
      opts.serverNames = (opts.serverNames as string)
        .split(",")
        .map((s: string) => s.trim())
        .filter(Boolean);
    }
    // xver: string → number
    if (typeof opts.xver === "string") {
      opts.xver = Number(opts.xver);
    }
    // port: string → number
    if (typeof opts.port === "string") {
      opts.port = Number(opts.port);
    }
    // multiMode: string → boolean
    if (typeof opts.multiMode === "string") {
      opts.multiMode = opts.multiMode === "true";
    }
  }

  // Build context
  const needsDomain = inboundSpecs.some(ib => ib.moduleId !== "reality");
  const domain = (inboundSpecs.find(ib => ib.options.domain)?.options?.domain as string) || "";

  const ctx: BuildContext = {
    uuid: generateUuid(),
    password: generatePassword(),
  };

  const hasReality = inboundSpecs.some(ib => ib.moduleId === "reality");
  if (hasReality) {
    ctx.realityKeyPair = generateRealityKeyPair();
    ctx.shortIds = generateShortIds({ count: 1, bytes: 4, includeEmpty: true });
  }

  if (needsDomain && domain) {
    ctx.selfSignedCert = generateSelfSignedCert({ domain });
  }

  // Assemble
  const result = assembleXrayConfig({
    logLevel: logLevel as any,
    routingPreset: routingPreset as any,
    inbounds: inboundSpecs,
    ctx,
  });

  // Validate
  const validation = validateXrayConfig(result.config);
  if (!validation.valid) {
    return c.json({
      error: "Validation failed",
      issues: validation.issues,
    }, 422);
  }

  // Save project
  const dir = projectDir(name);
  mkdirSync(dir, { recursive: true });

  const projectData = {
    name,
    engine: "xray" as const,
    logLevel,
    routingPreset,
    inbounds: inboundSpecs,
    ctx: {
      uuid: ctx.uuid,
      realityKeyPair: ctx.realityKeyPair,
      shortIds: ctx.shortIds,
      password: ctx.password,
    },
  };

  writeFileSync(join(dir, "project.json"), formatJson(projectData) + "\n", "utf-8");
  writeFileSync(join(dir, "server.json"), formatJson(result.config) + "\n", "utf-8");

  // Generate README
  const readmeLines = [
    `# ${name}`,
    "",
    "Generated by **configtools** — Xray-core 26.3 server config.",
    "",
    "## Nodes",
    "",
    "| # | Protocol | Port | Network | Security |",
    "|---|----------|------|---------|----------|",
  ];
  for (let i = 0; i < result.clientNodes.length; i++) {
    const n = result.clientNodes[i];
    readmeLines.push(`| ${i + 1} | ${n.protocol} | ${n.port} | ${n.network} | ${n.security} |`);
  }
  readmeLines.push("", "## Credentials", "", `- **UUID**: \`${ctx.uuid}\``);
  if (ctx.realityKeyPair) {
    readmeLines.push(`- **Reality PrivateKey**: \`${ctx.realityKeyPair.privateKey}\``);
    readmeLines.push(`- **Reality PublicKey**: \`${ctx.realityKeyPair.publicKey}\``);
  }
  if (ctx.shortIds) {
    readmeLines.push(`- **Reality ShortIds**: \`${ctx.shortIds.join("`, `")}\``);
  }
  readmeLines.push(`- **Password**: \`${ctx.password}\``, "");
  writeFileSync(join(dir, "README.md"), readmeLines.join("\n"), "utf-8");

  // Save cert files
  if (result.files) {
    for (const file of result.files) {
      const filePath = join(dir, file.name);
      mkdirSync(join(filePath, ".."), { recursive: true });
      writeFileSync(filePath, file.content, "utf-8");
    }
  }

  return c.json({
    success: true,
    name,
    clientNodes: result.clientNodes,
    ctx: {
      uuid: ctx.uuid,
      realityKeyPair: ctx.realityKeyPair,
      shortIds: ctx.shortIds,
      password: ctx.password,
    },
  });
});

// ---------------------------------------------------------------------------
// API: Update server.json
// ---------------------------------------------------------------------------

app.put("/api/projects/:name/server.json", async (c) => {
  const name = c.req.param("name");
  const body = await c.req.json();
  const path = serverJsonPath(name);

  if (!existsSync(path)) {
    return c.json({ error: "Project not found" }, 404);
  }

  // Validate before saving
  const validation = validateXrayConfig(body);
  if (!validation.valid) {
    return c.json({
      error: "Validation failed",
      issues: validation.issues,
    }, 422);
  }

  writeFileSync(path, formatJson(body) + "\n", "utf-8");
  return c.json({ success: true });
});

// ---------------------------------------------------------------------------
// API: Check / Validate
// ---------------------------------------------------------------------------

app.post("/api/projects/:name/check", (c) => {
  const name = c.req.param("name");
  const path = serverJsonPath(name);

  if (!existsSync(path)) {
    return c.json({ error: "Project not found" }, 404);
  }

  const config = JSON.parse(readFileSync(path, "utf-8"));
  const dir = projectDir(name);
  const result = validateXrayConfig(config, dir);
  return c.json(result);
});

// ---------------------------------------------------------------------------
// API: Format
// ---------------------------------------------------------------------------

app.post("/api/projects/:name/format", (c) => {
  const name = c.req.param("name");
  const path = serverJsonPath(name);

  if (!existsSync(path)) {
    return c.json({ error: "Project not found" }, 404);
  }

  const raw = readFileSync(path, "utf-8");
  const formatted = formatJsonString(raw);
  writeFileSync(path, formatted + "\n", "utf-8");
  return c.json({ success: true });
});

// ---------------------------------------------------------------------------
// API: Validate arbitrary JSON (for editor live-check)
// ---------------------------------------------------------------------------

app.post("/api/validate", async (c) => {
  const body = await c.req.json();
  const result = validateXrayConfig(body);
  return c.json(result);
});

// ---------------------------------------------------------------------------
// Static file serving (frontend)
// ---------------------------------------------------------------------------

const FRONTEND_DIR = resolve(fileURLToPath(import.meta.url), "..", "frontend");

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".ts": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

app.get("/ui/*", (c) => {
  const url = new URL(c.req.url);
  let relPath = url.pathname.slice("/ui/".length) || "index.html";
  const fullPath = join(FRONTEND_DIR, relPath);

  if (!existsSync(fullPath) || fullPath.startsWith("..")) {
    return c.notFound();
  }

  const ext = extname(fullPath);
  const mimeType = MIME_TYPES[ext] || "application/octet-stream";
  const content = readFileSync(fullPath, "utf-8");
  return c.text(content, 200, { "Content-Type": mimeType });
});

// Redirect root to /ui/
app.get("/", (c) => c.redirect("/ui/"));

// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------

export function startUiServer(port: number = 3000): void {
  console.log(`  configtools UI → http://localhost:${port}/ui/`);
  serve({ fetch: app.fetch, port }, () => {
    console.log(`  Server running on http://localhost:${port}`);
  });
}

export { app };
