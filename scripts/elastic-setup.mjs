#!/usr/bin/env node
// One-time Elastic setup: Jina embeddings endpoint (Elastic Inference Service) + the verdict index.
// Usage: ELASTICSEARCH_URL=... ELASTIC_API_KEY=... node scripts/elastic-setup.mjs
// If the inference PUT fails, your project type may not expose EIS: create the endpoint in Kibana (Search > Inference)
// with the same id, or change INFERENCE_ID here AND in lib/integrations/elastic.ts.
const { ELASTICSEARCH_URL: url, ELASTIC_API_KEY: key } = process.env;
if (!url || !key) throw new Error("set ELASTICSEARCH_URL and ELASTIC_API_KEY");
const INFERENCE_ID = "eis-jina-embeddings-v3";
const headers = { "content-type": "application/json", authorization: `ApiKey ${key}` };

async function put(path, body) {
  const res = await fetch(`${url}${path}`, { method: "PUT", headers, body: JSON.stringify(body) });
  const text = await res.text();
  console.log(`${res.ok ? "OK  " : "FAIL"} PUT ${path} -> ${res.status} ${res.ok ? "" : text.slice(0, 300)}`);
  return res.ok;
}

await put(`/_inference/text_embedding/${INFERENCE_ID}`, { service: "elastic", service_settings: { model_id: "jina-embeddings-v3" } });
await put("/promise-verdicts", {
  mappings: {
    properties: {
      promiseId: { type: "keyword" },
      reason: { type: "keyword" },
      kind: { type: "keyword" },
      at: { type: "date" },
      condition_text: { type: "text", copy_to: "condition_embedding" },
      condition_embedding: { type: "semantic_text", inference_id: INFERENCE_ID },
    },
  },
});
