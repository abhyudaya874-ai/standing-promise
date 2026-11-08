---
description: Elastic: Jina embeddings, hybrid precedent search (RRF), verdict indexing, ES|QL, Agent Builder tools
---

# Elastic

In the reference code: `lib/integrations/elastic.ts`, `scripts/elastic-setup.mjs`, calls in `agents/explainer.ts` (precedent) and `agents/archivist.ts` (index). Default OFF; turn on after the money path is green twice.

1. Start the free serverless trial: https://ela.st/elastic-paypal-hackathon (project type Search or Vector Search). Create an API key in Kibana. Set `ELASTICSEARCH_URL`, `ELASTIC_API_KEY`.
2. `node scripts/elastic-setup.mjs`: creates the `eis-jina-embeddings-v3` inference endpoint and the `promise-verdicts` index (`condition_text` copied into a `semantic_text` field). If the inference PUT fails, create the endpoint in Kibana with that id.
3. `CAP_ELASTIC=1`. Settle a few promises: the archivist indexes each final verdict (`elastic.index` row in the trace).
4. Settle another promise with a similar condition: the explainer appends "2 of 3 similar past promises ended CONDITION_UNMET." (`elastic.precedent` row).
5. **ES|QL**: in Kibana Dev Tools: `POST /_query` with `{"query":"FROM promise-verdicts | STATS n = COUNT(*) BY reason | SORT n DESC"}`. `esql()` in the adapter does the same from code.
6. **Agent Builder** (Kibana UI): create an ES|QL tool over `promise-verdicts` ("how many promises ended each way?") and an agent that uses it, so a judge can ask in plain English. This part is manual, in Kibana.
7. Degraded: `CAP_ELASTIC=0` or a bad key: the explanation simply has no precedent clause.
