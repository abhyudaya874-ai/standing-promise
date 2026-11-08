---
description: Postman collection, mock server and monitor for the money path
---

# Postman

In the pack: `postman/collection.json` (7 requests, each with tests), `postman/environment.local.json`.

1. Import the collection into Postman (free plan). Set `base` to `http://localhost:3000`. Run the folder top to bottom: capabilities, create, SSRF rejection, settle, settle again, replay, studio query.
2. Headless: `npx newman run postman/collection.json -e postman/environment.local.json`. Add it as `npm run test:api` (see BOOTSTRAP). It needs the dev server and a sandbox DB.
3. **Mock server**: Postman > the collection > Mock. Useful while PayPal or a vendor is down; point `base` at the mock to demo the UI contract.
4. **Monitor**: create a monitor on the collection, schedule it across the demo window, `base` = the Render URL. Screenshot the green run for the submission.
5. When a route's contract changes, update the collection in the SAME commit (new request + test).
