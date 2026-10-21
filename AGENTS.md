# AGENTS.md — NightOut

`CLAUDE.md` is the source of truth for every rule, business decision, and convention in this repo (written in Thai). Read it before your first edit; look up its business-rule section ("กฎธุรกิจที่ตกลงแล้ว") before touching any feature it names. This file carries the guardrails, the workflow, and pointers. When the two disagree, `CLAUDE.md` wins.

## Guardrails

- **Leave every change uncommitted.** Agents never run `git commit`, `git push`, `git merge`, `gh pr merge`, or enable auto-merge (also blocked in `.claude/settings.json`). Draft a Conventional Commit message instead (`feat(web): …`, `fix(api): …`, `docs: …`, one concern per commit).
- Work on `demo`, starting from the latest `origin/demo`. `main` is deploy-only and the owner merges `demo → main`. Create no sub-branches.
- Clients (`apps/frontend`, `apps/admin`) call Supabase for `supabase.auth.*` only. Every data read/write and upload goes through the NestJS API via `Rest` from `@nightout/utils/rest` (ADR 0002). ESLint enforces it.
- Payments stay mock/DRAFT. Real-money collection stays off until the owner says otherwise.
- Bar data comes from real merchants only. `supabase/seed.sql` holds master data only.
- Secrets stay in `.env` (copied from `.env.example`), outside Git and browser bundles.

## Workflow (every task)

1. **Sync.** Pull the latest `demo`, then run the `sync-requirements` skill (`.claude/skills/sync-requirements/SKILL.md`). Done when the Google Doc revision matches `docs/requirements/nightout-2-day.md`, or no Docs connector exists and you use the snapshot. Scope, phases, and business rules: `docs/REQUIREMENTS.md` (§0 owner decisions win) → `CLAUDE.md` business rules → `docs/PROMPT.md`.
2. **Ask first.** Stop and ask the user when the task:
   - is out of plan (not in a REQUIREMENTS phase and not in `CLAUDE.md` business rules). Say so plainly if it is a later phase (2/3/4) or "ตัดทิ้งถาวร ⛔".
   - touches a ❓ item in REQUIREMENTS.
   - adds a customer feature whose `apps/admin` management page is unspecified.

   On approval of out-of-plan work: write it back to the Google Doc as `นอก MVP — อนุมัติ YYYY-MM-DD` (the `sync-requirements` write-back step), re-sync, then code. Done when the user has answered and the doc is updated (or the user has the text to paste).
3. **Build** along the domain slices (ADR 0006). New or changed endpoint: work through the `CLAUDE.md` checklist "เพิ่ม/แก้ endpoint", all 8 steps: DB → contracts → API → row types → web → shared utils → docs → tests.
4. **Refactor** only the code this task touched: dead code, duplicates, naming, hooks/utils into the right folder. Behaviour stays identical.
5. **Record.** Done when each one that applies is updated:
   - `CHANGELOG.md` of every module, domain, and package you touched (create if missing). Newest on top, `## YYYY-MM-DD — <short title>`, bullets of what and why plus main files, migrations, and endpoints.
   - `docs/STRUCTURE.md` for added, removed, or renamed modules and domains.
   - `docs/SITEMAP.md` for added, removed, or changed routes (table, diagram §1, navigation).
   - `docs/DATABASE.md` §5.0 for new migrations or functions.
   - `CLAUDE.md` for new business rules. New ADR in `docs/adr/` for structural decisions.
6. **Verify.** Done when `pnpm lint && pnpm typecheck && pnpm test && pnpm build` passes. For UI changes, also check the page in a browser.

## Map

- `apps/frontend` (`:5173`): customer, merchant, staff web. `apps/admin` (`:5174`, under `/admin/`): backoffice. `apps/backend` (`:3000`): NestJS; domains in `src/domains/<domain>/`, migrations in `supabase/migrations/`.
- `packages/contracts` (zod bodies, result types, `<DOMAIN>_ERRORS`) · `types` (enums, `Db.*` rows) · `utils` (logic shared by web and API, `Rest`) · `ui` (theme tokens) · `config` (ESLint/TS). `utils` never imports `contracts`.
- A page is `src/modules/<camelCase>/page.tsx` plus its own `components/ type/ form/ modal/ utils/`. Its API calls live in that module's `api.ts` (ADR 0007): redeclare a shared endpoint per module rather than importing across modules. Shared across pages: `src/ui`, `src/hooks`, `src/services`. Routes: `src/router/index.tsx`.
- One business topic uses the same domain name in all four layers: `packages/contracts/src/<domain>.ts`, `apps/backend/src/domains/<domain>/`, each web module's `api.ts`, and `<ts>_<domain>_<topic>.sql`. Grep the domain name to trace a feature.
- Docs: `docs/ARCHITECTURE.md`, `docs/DATABASE.md`, `docs/SITEMAP.md`, `docs/STRUCTURE.md`, `docs/SUPABASE.md` (local setup), `docs/PARTY_SET.md`, `docs/adr/`.

## API and database

- API keys in body, query, and response are snake_case; convert to camelCase inside services. Controllers return plain data (wrapped automatically into `{ status, status_code, data, code, err_msg }`). Every endpoint has `@ApiDoc({ summary, description, returns })`. Error messages are Thai, in `<DOMAIN>_ERRORS`.
- Migrations are append-only. Add a new `<YYYYMMDDHHMMSS>_<domain>_<topic>.sql`. The last file that defines a function is the live one. A new enum value lives in a migration separate from its first use.
- New write function: `app_*` / `admin_*`, `language plpgsql set search_path = ''`, first param `p_actor uuid`, end the file with `revoke … from public, anon, authenticated; grant execute … to service_role;`.
- New table: FK indexes + `enable row level security` + revoke writes + its own `admin_read` policy.
- After a schema change run `pnpm --filter @nightout/backend db:types`.

## UI

- Load the `impeccable` and `frontend-design` skills before any UI work, plus `antd` / `ant-design`, `mobile-native`, or `animate` when relevant. Skills live in `.agents/skills/` and `.claude/skills/`. `impeccable` exists in both: keep them identical when editing.
- Ant Design v6 in both apps: run `antd info <Component> --format json` before writing and `antd lint <path> --format json` after. Icons come from `@phosphor-icons/react` only. Tailwind is for layout and decoration only.
- Stay on the Figma + Midnight Gold theme; dark is the default. Colors change in `packages/ui/src/tokens.ts` and `theme.css` together (a test checks).
- User-facing text joins values with `MetaList`, `StatusChip`, `DraftChip`, `RuleList`, `AdBadge`, or plain Thai connectors. The " · " / "•" separator is for code comments, logs, and docs only. See `CLAUDE.md` § Skills for which component fits.
- In-app payment is labelled with `TABLE_FEE_LABEL` / `TABLE_FEE_SHORT` from `@nightout/utils` (code and tables still say `deposit`).
- Brand is NightOut: packages `@nightout/*`, storage keys prefixed `nightout-`, check-in QR `NIGHTOUT:<booking id>`.

## Settled decisions (ask before reopening)

Each has its reasoning and code pointers in `CLAUDE.md`:

- Booking covers a table + at most one bar promotion. No food or drink pre-order, no split-pay, no slip-upload flow growth.
- Promotions and mini-ads stay alcohol-free (Thai Alcohol Act s.30/32). The system warns via `alcoholWordsIn()` and still saves.
- Auth is Supabase email/password + Google/Facebook. No OTP, no other providers, password reset stays closed.
- Safety badge reads "ข้อมูลอ้างอิงจากร้านค้า (Merchant Declared)" + last-checked date + disclaimer (`ui/components/safetyList.tsx`).
- Ranking score constants in `packages/utils/src/ranking.ts` and SQL `run_tier_scores()` change together.
- Maps use Leaflet + OpenFreeMap / OSM; geocoding goes through backend `GET /geocode/*`.
