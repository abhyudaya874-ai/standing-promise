// HTTP shell for the concierge: GET / (chat page), GET /health, POST /api/chat. Port 80 in production (RFC-1 rule 14).
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { runAgent } from "./agent.mjs";

const PAGE = `<!doctype html><meta charset="utf-8"><title>Promise concierge</title>
<style>body{font:15px system-ui;max-width:640px;margin:2rem auto;padding:0 1rem}#log p{margin:.4rem 0;white-space:pre-wrap}.u{color:#555}form{display:flex;gap:.5rem;margin-top:1rem}input{flex:1;padding:.5rem}</style>
<h1>Promise concierge</h1><div id="log"></div>
<form id="f"><input id="q" placeholder="Why was promise … released?" autofocus><button>Ask</button></form>
<script>
const log=document.getElementById('log'),history=[];
document.getElementById('f').onsubmit=async e=>{e.preventDefault();const q=document.getElementById('q'),t=q.value.trim();if(!t)return;q.value='';
history.push({role:'user',content:t});log.insertAdjacentHTML('beforeend','<p class="u"></p>');log.lastChild.textContent='You: '+t;
log.insertAdjacentHTML('beforeend','<p></p>');const out=log.lastChild;out.textContent='…';
try{const r=await fetch('/api/chat',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({messages:history})});
const j=await r.json();const reply=j.reply||j.error||'(no answer)';history.push({role:'assistant',content:reply});out.textContent=reply;}catch(err){out.textContent='Could not reach the agent.';}};
</script>`;

export function createAppServer(config) {
  return createServer(async (req, res) => {
    const send = (code, body, type = "application/json") => {
      res.writeHead(code, { "content-type": type });
      res.end(type === "application/json" ? JSON.stringify(body) : body);
    };
    if (req.method === "GET" && req.url === "/health") return send(200, { ok: true });
    if (req.method === "GET" && (req.url === "/" || req.url === "/index.html")) return send(200, PAGE, "text/html; charset=utf-8");
    if (req.method === "POST" && req.url === "/api/chat") {
      let raw = "";
      for await (const chunk of req) {
        raw += chunk;
        if (raw.length > 50_000) return send(413, { error: "too large" });
      }
      try {
        const { messages } = JSON.parse(raw);
        if (!Array.isArray(messages) || messages.length === 0 || messages.length > 40) return send(400, { error: "messages required" });
        const safe = messages
          .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
          .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }));
        return send(200, { reply: await runAgent(safe, config) });
      } catch (err) {
        return send(502, { error: err instanceof Error ? err.message : "failed" });
      }
    }
    return send(404, { error: "not found" });
  });
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const need = (k) => {
    const v = process.env[k];
    if (!v) throw new Error(`missing env ${k} (injected by Astropods for the gateway model and agent.inputs)`);
    return v;
  };
  const config = {
    gatewayUrl: need("ASTRO_GATEWAY_URL").replace(/\/$/, ""),
    gatewayKey: need("ASTRO_GATEWAY_API_KEY"),
    model: process.env.MODEL_DEFAULT ?? "claude-haiku-4-5",
    apiUrl: need("PROMISE_API_URL").replace(/\/$/, ""),
  };
  createAppServer(config).listen(Number(process.env.PORT ?? 80), () => console.log("promise-concierge listening"));
}
