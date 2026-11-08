# Postman

- `collection.json`: the money path with tests on every request. Import into Postman, or run headless:
  `npx newman run postman/collection.json -e postman/environment.local.json` (needs the app running).
- **Mock server**: in Postman, create a mock from this collection so the front end can be built before PayPal is wired.
- **Monitor**: create a monitor on the collection, schedule it for the demo window, point `base` at the Render URL.
  A green monitor is a screenshot for the submission.
- PayPal's own collection (Postman public network, "PayPal") is useful to poke the sandbox Orders API directly.
