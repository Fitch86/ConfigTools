/**
 * configtools Web UI — Preact + HTM single-page app.
 *
 * No build step. HTM replaces JSX. Browser-native ESM imports
 * from esm.sh CDN for Preact and HTM.
 */

import { h, render } from "https://esm.sh/preact@10.19.3";
import { useState, useEffect, useRef } from "https://esm.sh/preact@10.19.3/hooks";
import htm from "https://esm.sh/htm@3.1.1";

const html = htm.bind(h);

// ---------------------------------------------------------------------------
// Router (tiny hash-based router)
// ---------------------------------------------------------------------------

function useRoute() {
  const [path, setPath] = useState(location.hash.slice(1) || "/");
  useEffect(() => {
    const handler = () => setPath(location.hash.slice(1) || "/");
    window.addEventListener("hashchange", handler);
    return () => window.removeEventListener("hashchange", handler);
  }, []);
  return path;
}

function navigate(path) {
  location.hash = path;
}

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

const API = {
  get: (url) => fetch(url).then(r => r.json()),
  post: (url, body) =>
    fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then(r => r.json()),
  put: (url, body) =>
    fetch(url, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then(r => r.json()),
};

// ---------------------------------------------------------------------------
// Shared components
// ---------------------------------------------------------------------------

function Toast({ message, type, onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 3000); return () => clearTimeout(t); }, []);
  return html`<div class="toast toast-${type}">${message}</div>`;
}

function CopyBtn({ text }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); });
  };
  return html`<button class="copy-btn" onclick=${copy}>${copied ? "✓" : "📋"}</button>`;
}

function Badge({ type }) {
  const cls = type === "reality" ? "badge-reality" : type === "vless-ws" ? "badge-ws" : "badge-grpc";
  return html`<span class="badge ${cls}">${type}</span>`;
}

// ---------------------------------------------------------------------------
// Page: Home (Project List)
// ---------------------------------------------------------------------------

function ProjectListPage() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    API.get("/api/projects").then(data => { setProjects(data); setLoading(false); });
  };

  useEffect(load, []);

  return html`
    <div class="main">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:24px;">
        <h2>📋 Projects</h2>
        <button class="btn btn-primary" onclick=${() => navigate("/new")}>＋ New Project</button>
      </div>
      ${loading ? html`<p style="color:var(--text-muted)">Loading…</p>` :
        projects.length === 0 ?
          html`<div class="empty-state">
            <div class="emoji">🚀</div>
            <p>No projects yet. Create your first Xray config!</p>
            <button class="btn btn-primary" onclick=${() => navigate("/new")}>＋ New Project</button>
          </div>` :
          html`<div class="card-grid">
            ${projects.map(p => html`
              <div class="card" onclick=${() => navigate("/project/" + p.name)}>
                <div class="card-title">${p.name}</div>
                <div class="card-meta">${p.engine} · ${p.routingPreset || "none"}</div>
                <div class="card-badges">
                  ${(p.inboundIds || []).map(id => html`<${Badge} type=${id} />`)}
                </div>
              </div>
            `)}
          </div>`
      }
    </div>
  `;
}

// ---------------------------------------------------------------------------
// Page: New Project Wizard
// ---------------------------------------------------------------------------

function NewProjectPage() {
  const [step, setStep] = useState(0);
  const [modules, setModules] = useState([]);
  const [selectedIds, setSelectedIds] = useState(["reality"]);
  const [name, setName] = useState("my-xray");
  const [logLevel, setLogLevel] = useState("warning");
  const [routingPreset, setRoutingPreset] = useState("block-ads-cn");
  const [options, setOptions] = useState({});
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    API.get("/api/modules").then(setModules);
  }, []);

  const toggleModule = (id) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const getInboundSpecs = () => selectedIds.map(id => ({ moduleId: id, options: options[id] || {} }));

  const handleGenerate = async () => {
    setGenerating(true);
    setError("");
    try {
      const res = await API.post("/api/generate", {
        name,
        logLevel,
        routingPreset,
        inbounds: getInboundSpecs(),
      });
      if (res.error) {
        setError(res.error + (res.issues ? ": " + res.issues.map(i => i.message).join("; ") : ""));
      } else {
        setResult(res);
        setStep(2);
      }
    } catch (e) {
      setError(e.message);
    }
    setGenerating(false);
  };

  const stepLabels = ["1. Protocol", "2. Parameters", "3. Result"];
  const stepIndicators = html`
    <div class="steps">
      ${stepLabels.map((label, i) => html`
        <div class="step ${i === step ? "active" : i < step ? "done" : ""}">
          <span class="step-dot">${i < step ? "✓" : i + 1}</span>
          <span>${label}</span>
        </div>
        ${i < stepLabels.length - 1 ? html`<div class="step-line ${i < step ? "done" : ""}"></div>` : null}
      `)}
    </div>
  `;

  // Step 0: Protocol selection
  if (step === 0) {
    return html`
      <div class="main">
        ${stepIndicators}
        <div class="section-title">Select Inbound Protocols</div>
        <div class="module-cards">
          ${modules.map(m => html`
            <div class="module-card ${selectedIds.includes(m.id) ? "selected" : ""}"
                 onclick=${() => toggleModule(m.id)}>
              <div class="module-card-title">${m.label}</div>
              <div class="module-card-desc">${
                m.id === "reality" ? "Direct TCP, Reality TLS camouflage, XTLS-Vision flow" :
                m.id === "vless-ws" ? "WebSocket over TLS, CDN-friendly" :
                "gRPC over TLS, supports multiMode"
              }</div>
            </div>
          `)}
        </div>

        <div style="margin-top:20px">
          <div class="form-group">
            <label class="form-label">Project Name</label>
            <input class="form-input" value=${name} oninput=${e => setName(e.target.value)} />
          </div>
        </div>

        <div class="btn-group" style="margin-top:20px; justify-content:flex-end;">
          <button class="btn btn-primary" disabled=${selectedIds.length === 0}
                  onclick=${() => setStep(1)}>Next →</button>
        </div>
      </div>
    `;
  }

  // Step 1: Parameters
  if (step === 1) {
    const needsDomain = selectedIds.some(id => id !== "reality");

    const setOpt = (moduleId, key, value) => {
      setOptions(prev => ({
        ...prev,
        [moduleId]: { ...(prev[moduleId] || {}), [key]: value },
      }));
    };

    return html`
      <div class="main">
        ${stepIndicators}
        <div class="section-title">Common Settings</div>

        <div class="form-group">
          <label class="form-label">Log Level</label>
          <select class="form-select" value=${logLevel} onchange=${e => setLogLevel(e.target.value)}>
            <option value="warning">Warning</option>
            <option value="info">Info</option>
            <option value="error">Error</option>
            <option value="debug">Debug</option>
            <option value="none">None</option>
          </select>
        </div>

        <div class="form-group">
          <label class="form-label">Routing Preset</label>
          <select class="form-select" value=${routingPreset} onchange=${e => setRoutingPreset(e.target.value)}>
            <option value="none">None — all traffic direct</option>
            <option value="block-ads-cn">Block ads + CN direct</option>
          </select>
        </div>

        ${needsDomain ? html`
          <div class="form-group">
            <label class="form-label">Domain (for TLS + cert SAN)</label>
            <input class="form-input" placeholder="my.proxy.tld"
                   value=${options["vless-ws"]?.domain || options["vless-grpc"]?.domain || ""}
                   oninput=${e => {
                     const val = e.target.value;
                     if (selectedIds.includes("vless-ws")) setOpt("vless-ws", "domain", val);
                     if (selectedIds.includes("vless-grpc")) setOpt("vless-grpc", "domain", val);
                   }} />
            <div class="form-help">WS and gRPC inbounds share the same domain/cert</div>
          </div>
        ` : null}

        ${selectedIds.map(id => {
          const mod = modules.find(m => m.id === id);
          if (!mod) return null;

          return html`
            <div key=${id} style="margin-top:24px;">
              <div class="section-title">${mod.label} Options</div>
              ${mod.prompts.map(p => {
                if (p.name === "domain" && needsDomain) return null;
                const val = options[id]?.[p.name] ?? p.initial ?? "";
                return html`
                  <div class="form-group" key=${p.name}>
                    <label class="form-label">${p.message}</label>
                    ${p.type === "select" ?
                      html`<select class="form-select" value=${val} onchange=${e => setOpt(id, p.name, e.target.value)}>
                        ${p.choices.map(c => html`<option value=${c.value}>${c.title}</option>`)}
                      </select>` :
                      p.type === "confirm" ?
                        html`<input type="checkbox" checked=${!!val} onchange=${e => setOpt(id, p.name, e.target.checked)} />` :
                      p.type === "number" ?
                        html`<input class="form-input" type="number" min=${p.min} max=${p.max} value=${val}
                                    oninput=${e => setOpt(id, p.name, Number(e.target.value))} />` :
                      p.name === "serverNames" ?
                        html`<input class="form-input" placeholder="www.microsoft.com,microsoft.com" value=${val}
                                   oninput=${e => setOpt(id, p.name, e.target.value)} />
                             <div class="form-help">Comma-separated domain list</div>` :
                        html`<input class="form-input" value=${val}
                                   oninput=${e => setOpt(id, p.name, e.target.value)} />`
                    }
                  </div>
                `;
              })}
            </div>
          `;
        })}

        ${error ? html`<div class="issue issue-error">⚠ ${error}</div>` : null}

        <div class="btn-group" style="margin-top:20px; justify-content:space-between;">
          <button class="btn" onclick=${() => setStep(0)}>← Back</button>
          <button class="btn btn-primary" onclick=${handleGenerate}
                   disabled=${generating}>
            ${generating ? "Generating…" : "🚀 Generate Config"}
          </button>
        </div>
      </div>
    `;
  }

  // Step 2: Result
  return html`
    <div class="main">
      ${stepIndicators}
      <div class="section-title">✅ Config Generated!</div>
      <p style="color:var(--green); margin-bottom:20px;">
        Project <strong>${name}</strong> saved to <code>output/${name}/</code>
      </p>

      ${result?.ctx ? html`
        <div class="section-title">Credentials</div>
        <div style="margin-bottom:24px;">
          <div class="cred-row">
            <span class="cred-label">UUID</span>
            <span class="cred-value">${result.ctx.uuid}</span>
            <${CopyBtn} text=${result.ctx.uuid} />
          </div>
          ${result.ctx.realityKeyPair ? html`
            <div class="cred-row">
              <span class="cred-label">PrivateKey</span>
              <span class="cred-value" style="color:var(--yellow)">${result.ctx.realityKeyPair.privateKey}</span>
              <${CopyBtn} text=${result.ctx.realityKeyPair.privateKey} />
            </div>
            <div class="cred-row">
              <span class="cred-label">PublicKey</span>
              <span class="cred-value" style="color:var(--yellow)">${result.ctx.realityKeyPair.publicKey}</span>
              <${CopyBtn} text=${result.ctx.realityKeyPair.publicKey} />
            </div>
          ` : null}
          ${result.ctx.shortIds?.length ? html`
            <div class="cred-row">
              <span class="cred-label">ShortIds</span>
              <span class="cred-value">${result.ctx.shortIds.join(", ")}</span>
              <${CopyBtn} text=${result.ctx.shortIds.join(", ")} />
            </div>
          ` : null}
          <div class="cred-row">
            <span class="cred-label">Password</span>
            <span class="cred-value">${result.ctx.password}</span>
            <${CopyBtn} text=${result.ctx.password} />
          </div>
        </div>
      ` : null}

      ${result?.clientNodes?.length ? html`
        <div class="section-title">Client Nodes</div>
        ${result.clientNodes.map(node => html`
          <div class="card" style="cursor:default;">
            <div class="card-title">${node.remarks || node.protocol}</div>
            <div class="card-meta">
              Port ${node.port} · ${node.network} · ${node.security}
            </div>
            ${node.extra ? html`
              <div style="margin-top:8px; font-family:var(--font-mono); font-size:12px; color:var(--text-muted);">
                ${Object.entries(node.extra).map(([k, v]) => html`
                  <div>${k}: <span style="color:var(--text)">${String(v)}</span></div>
                `)}
              </div>
            ` : null}
          </div>
        `)}
      ` : null}

      <div class="btn-group" style="margin-top:24px;">
        <button class="btn btn-primary" onclick=${() => navigate("/project/" + name)}>📂 View Project →</button>
        <button class="btn" onclick=${() => navigate("/")}>🏠 Home</button>
      </div>
    </div>
  `;
}

// ---------------------------------------------------------------------------
// Page: Project Detail
// ---------------------------------------------------------------------------

function ProjectDetailPage({ name }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("config");
  const [editing, setEditing] = useState(false);
  const [editJson, setEditJson] = useState("");
  const [toast, setToast] = useState(null);
  const [issues, setIssues] = useState([]);
  const validateTimer = useRef(null);

  const load = () => {
    setLoading(true);
    API.get("/api/projects/" + name).then(d => {
      setData(d);
      setEditJson(JSON.stringify(d.serverJson, null, 2));
      setLoading(false);
    });
  };
  useEffect(load, [name]);

  const handleCheck = async () => {
    const res = await API.post("/api/projects/" + name + "/check");
    setIssues(res.issues || []);
    if (res.valid) setToast({ message: "✓ Config is valid!", type: "success" });
    else setToast({ message: "✗ Validation failed", type: "error" });
    setTimeout(() => setToast(null), 3000);
  };

  const handleFormat = async () => {
    await API.post("/api/projects/" + name + "/format");
    load();
    setToast({ message: "✓ Formatted!", type: "success" });
    setTimeout(() => setToast(null), 3000);
  };

  const handleSave = async () => {
    try {
      const parsed = JSON.parse(editJson);
      const res = await API.put("/api/projects/" + name + "/server.json", parsed);
      if (res.error) {
        setToast({ message: "✗ " + res.error, type: "error" });
      } else {
        setEditing(false);
        load();
        setToast({ message: "✓ Saved!", type: "success" });
      }
    } catch (e) {
      setToast({ message: "✗ Invalid JSON: " + e.message, type: "error" });
    }
    setTimeout(() => setToast(null), 3000);
  };

  const handleEditChange = (value) => {
    setEditJson(value);
    if (validateTimer.current) clearTimeout(validateTimer.current);
    validateTimer.current = setTimeout(async () => {
      try {
        const parsed = JSON.parse(value);
        const res = await API.post("/api/validate", parsed);
        setIssues(res.issues || []);
      } catch {
        setIssues([{ level: "error", path: "/", message: "Invalid JSON syntax" }]);
      }
    }, 500);
  };

  if (loading) return html`<div class="main"><p style="color:var(--text-muted)">Loading…</p></div>`;
  if (!data) return html`<div class="main"><p>Project not found.</p></div>`;

  return html`
    <div class="main">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:24px;">
        <h2>${name}</h2>
        <div class="btn-group">
          <button class="btn btn-sm" onclick=${handleCheck}>🔍 Check</button>
          <button class="btn btn-sm" onclick=${handleFormat}>✨ Format</button>
          <button class="btn btn-sm" onclick=${() => navigate("/")}>← Back</button>
        </div>
      </div>

      ${issues.length > 0 ? html`
        <div style="margin-bottom:16px;">
          ${issues.map(i => html`
            <div class="issue issue-${i.level}">
              <div class="issue-path">${i.path}</div>
              <div>${i.message}</div>
              ${i.hint ? html`<div style="font-size:12px;color:var(--text-dim)">💡 ${i.hint}</div>` : null}
            </div>
          `)}
        </div>
      ` : null}

      <div class="tabs">
        ${["config", "project", "readme", "certs"].map(t =>
          html`<div class="tab ${tab === t ? "active" : ""}" onclick=${() => setTab(t)}>${t}</div>`
        )}
      </div>

      ${tab === "config" ? html`
        ${editing ? html`
          <div>
            <textarea class="json-editor" value=${editJson}
                      oninput=${e => handleEditChange(e.target.value)}></textarea>
            <div class="btn-group" style="margin-top:12px; justify-content:flex-end;">
              <button class="btn" onclick=${() => { setEditing(false); setIssues([]); }}>Cancel</button>
              <button class="btn btn-primary" onclick=${handleSave}>💾 Save</button>
            </div>
          </div>
        ` : html`
          <div class="json-viewer">${JSON.stringify(data.serverJson, null, 2)}</div>
          <div class="btn-group" style="margin-top:12px;">
            <button class="btn btn-sm" onclick=${() => setEditing(true)}>✏️ Edit</button>
            <${CopyBtn} text=${JSON.stringify(data.serverJson, null, 2)} />
          </div>
        `}
      ` : null}

      ${tab === "project" ? html`
        <div class="json-viewer">${JSON.stringify(data.project, null, 2)}</div>
      ` : null}

      ${tab === "readme" && data.readme ? html`
        <div class="readme-content" dangerouslySetInnerHTML=${{
          __html: simpleMarkdown(data.readme),
        }}></div>
      ` : null}

      ${tab === "certs" ? html`
        ${data.certs?.cert ? html`
          <div>
            <div class="section-title">cert.pem</div>
            <div class="json-viewer">${data.certs.cert}</div>
            <div style="margin:8px 0 20px;"><${CopyBtn} text=${data.certs.cert} /></div>
            <div class="section-title">key.pem</div>
            <div class="json-viewer">${data.certs.key}</div>
            <div style="margin:8px 0;"><${CopyBtn} text=${data.certs.key} /></div>
          </div>
        ` : html`<p style="color:var(--text-muted)">No certificates for this project.</p>`}
      ` : null}

      ${toast ? html`<${Toast} message=${toast.message} type=${toast.type} onClose=${() => setToast(null)} />` : null}
    </div>
  `;
}

// ---------------------------------------------------------------------------
// Simple markdown → HTML (no dependency)
// ---------------------------------------------------------------------------

function simpleMarkdown(md) {
  return md
    .replace(/&/g, "&").replace(/</g, "<").replace(/>/g, ">")
    .replace(/^### (.*$)/gm, "<h3>$1</h3>")
    .replace(/^## (.*$)/gm, "<h2>$1</h2>")
    .replace(/^# (.*$)/gm, "<h1>$1</h1>")
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/^- (.*$)/gm, "<li>$1</li>")
    .replace(/\|---.*\|/g, "")
    .replace(/^\|(.*)\|$/gm, (_, row) => {
      const cells = row.split("|").map(c => c.trim());
      return "<tr>" + cells.map(c => `<td>${c}</td>`).join("") + "</tr>";
    })
    .replace(/(<tr>.*<\/tr>\n?)+/g, m => `<table>${m}</table>`)
    .replace(/\n{2,}/g, "<br/><br/>")
    .replace(/\n/g, "<br/>");
}

// ---------------------------------------------------------------------------
// App root
// ---------------------------------------------------------------------------

function App() {
  const route = useRoute();

  let page;
  if (route === "/" || route === "") {
    page = html`<${ProjectListPage} />`;
  } else if (route === "/new") {
    page = html`<${NewProjectPage} />`;
  } else if (route.startsWith("/project/")) {
    const name = route.slice("/project/".length);
    page = html`<${ProjectDetailPage} name=${name} />`;
  } else {
    page = html`<div class="main"><p>404 — Page not found</p></div>`;
  }

  return html`
    <div>
      <header class="app-header">
        <h1 onclick=${() => navigate("/")} style="cursor:pointer;">
          <span class="logo">⚙️</span> configtools
        </h1>
        <nav>
          <a href="#/" onclick=${e => { e.preventDefault(); navigate("/"); }}>Projects</a>
          <a href="#/new" onclick=${e => { e.preventDefault(); navigate("/new"); }}>New</a>
        </nav>
      </header>
      ${page}
    </div>
  `;
}

// ---------------------------------------------------------------------------
// Mount
// ---------------------------------------------------------------------------

render(html`<${App} />`, document.getElementById("app"));
