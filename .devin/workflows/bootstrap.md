---
description: One-time project setup from this pack. Creates the Next.js app, installs pinned deps, copies the reference code, proves it is green
---

# Bootstrap

Run ONCE, in an empty folder that already contains this pack. Follow `docs/BOOTSTRAP.md` for the exact commands and versions.
The reference code was typechecked, unit-tested (126 tests), and `next build`-ed with those exact versions.

1. `npx create-next-app@15 . --ts --tailwind --app --no-src-dir --import-alias "@/*" --use-npm` (keep the pack's files; answer "yes" to merge).
2. `npm install --save-exact` the runtime and dev dependency lists in `docs/BOOTSTRAP.md`. **Pin `typescript` to 5.9.x: Next 15's config loader breaks on TypeScript 7.**
3. `rm app/page.tsx` (create-next-app made one; the pack ships its own), then `bash scripts/install-reference.sh` (copies `reference/` into the project; never overwrites).
4. Merge `scripts` and `engines` from `docs/BOOTSTRAP.md` into `package.json` (`verify`, `verify:fast`, `test:api`).
5. `cp env.example .env.local`; ask the human for `DATABASE_URL` (a Neon BRANCH url) and the PayPal sandbox keys. Never invent keys.
6. `npx drizzle-kit migrate` on the branch DB (the initial migration is already in `drizzle/`).
7. `npm run verify`. It must print `all stages passed`.
8. `npm run dev`, open `http://localhost:3000`, check the capability strip. Commit: `infra: bootstrap from devin pack v2`.

Stop and report if step 7 fails; do not edit the reference code to "make it pass" without telling the human why.
