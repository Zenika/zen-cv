# zen-cv

A web app for editing Zenika CVs and exporting them to PDF.

The app is a single Node.js project that contains both parts:

- a **Vue 3** front end, where CVs are displayed and edited in the browser;
- a **Hono** back end, which provides a JSON API, stores CVs in **PostgreSQL** and generates PDFs with **Playwright**.

In production, a single process serves both the API and the built front end. It runs on Google Cloud Run and is restricted to `@zenika.com` accounts.

## Getting started

### Prerequisites

- Node.js 24 (see `.nvmrc`). The server is TypeScript run directly by Node, without a build step.
- pnpm 12 (pinned in `package.json` under `packageManager`).
- A PostgreSQL database. Locally, this is usually the Cloud SQL `dev` database reached through the [Cloud SQL Auth Proxy](https://cloud.google.com/sql/docs/postgres/sql-proxy):

  ```sh
  cloud-sql-proxy zen-cv-513014:europe-west9:dev-zen-cv --port 5432
  ```

  Any other Postgres works too, for example `docker run -e POSTGRES_PASSWORD=dev -p 5432:5432 postgres:17`.

### Setup

```sh
pnpm install
pnpm exec playwright install chromium   # browser used for the PDF export
cp .env.example .env.local              # then fill in DATABASE_URL
pnpm db:migrate                         # creates the tables
pnpm db:seed                            # optional: loads server/db/seed.json, skipping CVs that already exist
pnpm dev
```

Then open http://localhost:5173.

### Scripts

| Script | What it does |
| --- | --- |
| `pnpm dev` | Vite dev server with hot reload. The API runs inside it under `/api`. |
| `pnpm build` | Type-checks (`vue-tsc`) and builds the front end into `dist/`. |
| `pnpm start` | Production server: the API plus `dist/`, on `PORT` (default 3000). Run `pnpm build` first. |
| `pnpm db:migrate` | Creates the database tables. Safe to run more than once. |
| `pnpm db:seed` | Inserts the CVs from `server/db/seed.json` that don't exist yet. |
| `pnpm test:unit` | Vitest, in watch mode. |
| `pnpm lint` | oxlint, ESLint and stylelint, all with `--fix`. |
| `pnpm format` | Prettier on `src/`. |

### Environment variables

| Variable | Used by | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | dev, start, db scripts | Postgres connection string, read from `.env.local` locally and from Secret Manager in production. |
| `TEST_DATABASE_URL` | tests | Optional. Turns on the Postgres tests, which run in a temporary schema that is dropped afterwards. |
| `PORT` | start | HTTP port. Default `3000`; Cloud Run sets `8080`. |
| `STATIC_ROOT` | start | Folder containing the built front end. Default `dist`. |

`.env.local` is ignored by git. Never commit a connection string.

## Project structure

```
src/                 Vue front end
  main.ts            app entry point and router
  App.vue            root component (<RouterView>)
  views/             one component per route
  components/        reusable UI pieces
  composables/       state and behaviour shared by components (useCv)
  service/           HTTP calls to the API (cvApi)
  styles/            global SCSS: variables, mixins, shared blocks
  types.ts           re-exports the shared CV types
shared/
  cv.ts              Zod schemas and types, used by the front end and the back end
server/              Hono back end
  index.ts           production entry point (API + static files)
  app.ts             builds the Hono app and wires its dependencies
  routes/            HTTP layer: routing, validation, responses
  services/          business logic and domain errors
  repository/        data access (Postgres)
  db/                connection pool, migration, seed data
  pdf/               PDF rendering with Playwright
  scripts/           db:migrate and db:seed
  __tests__/         API and repository tests
deploy/              one-off GCP setup scripts
Dockerfile           production image
.github/workflows/   CI and deployment
```

## Front end

Vue 3 with TypeScript, Vite and Vue Router.

### Composition API

Every component uses `<script setup lang="ts">`:

- **Props and events are typed:** `defineProps<{ … }>()` and `defineEmits<{ … }>()`.
- **State uses** `ref`, `computed` and `useTemplateRef`; there is no Options API and no global store.
- **Shared logic lives in composables** (see below) rather than in mixins.

### How the layers fit together

```
View  ──uses──▶  Composable  ──calls──▶  Service  ──fetch──▶  /api
 │                   │
 └─ passes state ──▶ Components ──call save()──┘
```

- **Views** (`src/views/`) are the pages, one per route:
  - `HomeView` (`/`) lists the CVs.
  - `CvView` (`/cv/:id`) shows and edits one CV, and offers the PDF download. It gets the route `id` as a prop (`props: true`).
  - Because `App.vue` keys `<RouterView>` on the full path, switching CV mounts a fresh view.
- **Composables** (`src/composables/`) hold a page's state and behaviour.
  - `useCv(id)` loads the CV and saves changes. It also exposes loading, saving and export errors, and handles the PDF download.
  - `save(patch)` merges the patch into the CV and sends the whole CV. The change is shown once the server confirms it. With `{ optimistic: true }`, as used for drag-and-drop reordering, it is shown immediately and undone if the save fails.
- **Services** (`src/service/`) are the only code that knows about HTTP.
  - `cvApi.ts` wraps `fetch` for each endpoint and turns network and HTTP failures into `Error`s. Their messages are the plain-text French error messages sent by the server.
  - `errorMessage(error)` turns any caught error into displayable text.
- **Components** (`src/components/`) are presentational.
  - They receive data through props. To change the CV, they either call the `save` function they are given or emit events to their parent.
  - The components:
    - `CvHeader`: name, title and bio.
    - `CvSkills`: expertise, methodologies, trainer.
    - `CvExperiences`: list, add, edit, delete, reorder (drag-and-drop with `vue-draggable-plus`).
    - `ExperienceCard`: one experience.
    - `ExperienceForm`: add and edit form.
    - `InlineEdit`: generic click-to-edit field. It exposes an `edit` function through a scoped slot.

The front end shares its types with the back end through `shared/cv.ts`, re-exported by `src/types.ts`, so the API contract has a single definition.

### Styles: SCSS and BEM

- **Global styles** live in `src/styles/`:
  - `_variables.scss`: colours, fonts, widths, and the `mobile` mixin.
  - `cv.scss`: blocks shared between components, such as `.card`, `.button`, `.divider` and `.row`, and the print rules.
- **Component styles** go in the component's `<style lang="scss">` block. They are not scoped, because BEM class names already keep them from clashing. Start the block with `@use '@/styles/variables' as *;`.
- **Class names follow [BEM](https://getbem.com/naming/):**
  - a block named after the component (`.inline-edit`);
  - elements written `__element` (`.inline-edit__field`);
  - modifiers written `--modifier` (`.inline-edit--multiline`).

  In SCSS, nest elements and modifiers under the block with `&__` and `&--`. Don't style tags, and don't nest selectors more deeply than BEM needs.
- **Fonts:** Montserrat (headings) and Open Sans (body) come from `@fontsource-variable`, so the PDF doesn't depend on fonts installed on the server.
- **Linting:** stylelint (`standard-scss` and Vue configs) checks styles. Properties are ordered with `recess-order`, and `pnpm lint` reorders them automatically.

### Print and PDF

The PDF is generated from the same page the user sees.

- Print rules in `cv.scss` (`@media print`) adapt the layout to A4.
- `break-inside: avoid` keeps each section on one page.
- The server adds a red band at the top of every page and the Zenika logo at the bottom.

## Back end

The back end is [Hono](https://hono.dev/) on Node.js (`@hono/node-server`), with [Zod](https://zod.dev/) for validation. The TypeScript files run directly with Node 24's type stripping, so `tsconfig.server.json` only allows syntax that can simply be erased: no `enum` and no parameter properties. Imports use the `.ts` extension.

### API

All routes are under `/api`. Errors are returned as plain text in French.

| Method | Path | Response |
| --- | --- | --- |
| `GET` | `/api/cvs` | `200`: list of `{ id, firstname, name, title }` |
| `GET` | `/api/cvs/:id` | `200`: the full CV · `404` |
| `PUT` | `/api/cvs/:id` | Replaces the whole CV. `204` · `400` if the body is invalid · `404` |
| `GET` | `/api/cvs/:id/pdf` | `200`: `application/pdf` · `404` · `500` if the export fails |

### Layers

```
routes/  ──▶  services/  ──▶  repository/  ──▶  PostgreSQL
                  └──────────▶  pdf/  ──▶  headless Chromium
```

- **Routes** (`routes/cvs.ts`) handle HTTP only. They read parameters, validate the body and turn results into responses.
- **Service** (`services/cvService.ts`) holds the business rules, for example "a missing CV is an error" or "check the CV exists before exporting it". It throws domain errors (`services/errors.ts`), which `app.ts` maps to HTTP statuses in `onError`.
- **Repository** (`repository/`) is the only code that writes SQL.
  - The `CvRepository` interface has one implementation, `postgresRepository.ts`. The tests use an in-memory one.
  - Data read from the database is validated with `cvSchema` too.
- **Dependencies are passed in, not imported.**
  - `createServerApp()` creates the pool, the PDF renderer, the repository and the service, and passes each one to the next.
  - The tests call `createApp(service)` with a fake repository instead.

### Zod

`shared/cv.ts` defines the CV schema once (`cvSchema`, `experienceSchema`, …). The TypeScript types are derived from it with `z.infer`, so they cannot drift apart.

- **Request validation:** `@hono/zod-validator` checks `PUT` bodies. An invalid body gets a `400` with `z.prettifyError`, which lists each invalid field. Error messages are in French (`z.config(z.locales.fr())`).
- **Typed handlers:** after validation, `c.req.valid('json')` is typed as `UserData`.
- **Changing the CV format:** edit the schema. The types, the API validation and the front end all follow. Existing rows that no longer match the schema will fail to load, so update the data too.

### Database

The data is stored in one table, `cvs`:
- `id text primary key`;
- `data jsonb`, which holds the whole CV;
- `created_at` and `updated_at`.

The CV is always read and written as a whole document, so it doesn't need relational tables.

The migration in `db/database.ts` is idempotent, and the production server runs it on every start. `db/seed.json` holds the initial CVs.

### PDF export

`pdf/pdfRenderer.ts` turns a CV into a PDF:

1. It opens the app's own `/cv/:id` page in headless Chromium.
2. It waits for the CV and the fonts to finish loading.
3. It prints the page to an A4 PDF, with the red band at the top of each page and the logo at the bottom.

A single browser is started on the first export and reused. Each export gets its own browser context, so several exports can run at the same time.

### How the dev server works

In development there is no separate back-end process.

- The `apiServer()` plugin in `vite.config.ts` loads `server/app.ts` through Vite and handles every `/api/*` request.
- Back-end code reloads on save, just like the front end.
- `DATABASE_URL` is read from `.env.local`.

## Tests

```sh
pnpm test:unit                          # all projects, watch mode
pnpm exec vitest run --project server   # back end only
```

Vitest runs two projects (`vitest.config.ts`):

- `app`: front-end tests with jsdom and `@vue/test-utils` (`src/**/__tests__`).
- `server`: back-end tests in Node (`server/__tests__`).
  - `cvs.spec.ts` tests the API end to end through `app.request()`, using an in-memory repository and a fake PDF renderer.
  - `postgresRepository.spec.ts` runs against a real Postgres when `TEST_DATABASE_URL` is set, in a temporary schema. Don't point it at a database you care about.

`src/__tests__/App.spec.ts` and `e2e/vue.spec.ts` are leftovers from the Vite scaffold and are out of date, so CI doesn't run them.

## Deployment

The app runs on **Google Cloud Run** (`europe-west9`) with **Cloud SQL for PostgreSQL**. **Identity-Aware Proxy** restricts access to `@zenika.com` Google accounts.

### Continuous deployment

`.github/workflows/deploy.yml` has two jobs:

- **check** runs on every push and pull request:
  1. install dependencies;
  2. lint, and fail if lint changes any file;
  3. type-check and build;
  4. run the back-end tests against a temporary Postgres.
- **deploy** runs on `main` only:
  1. signs in to GCP through Workload Identity Federation, so no keys are stored in GitHub;
  2. builds the Docker image and pushes it to Artifact Registry;
  3. deploys it to Cloud Run. `DATABASE_URL` comes from Secret Manager (`zen-cv-database-url`).

The workflow reads these GitHub repository variables:
- `GCP_PROJECT_ID`
- `GCP_WORKLOAD_IDENTITY_PROVIDER`
- `GCP_DEPLOY_SERVICE_ACCOUNT`
- `GCP_RUNTIME_SERVICE_ACCOUNT`
- `CLOUD_SQL_CONNECTION_NAME`

### Docker image

The `Dockerfile` builds in two stages:

1. Build the front end.
2. Create a Node 24 runtime image with production dependencies and Chromium for the PDF export. The server runs as the non-root `node` user on port 8080.

To try the image locally:

```sh
docker build -t zen-cv .
docker run --rm -p 8080:8080 -e PORT=8080 -e DATABASE_URL=postgresql://… zen-cv
```

When the container runs in Docker on Linux, `localhost` points to the container itself. To reach a database on your machine, add `--network host`.

### Setting up a new GCP project

These scripts are run once, by hand. Both are safe to run again.

1. `deploy/setup-gcp.sh` sets up the project:
   - enables the APIs and creates the Artifact Registry repository;
   - creates the service accounts and the `DATABASE_URL` secret;
   - configures Workload Identity Federation for `Zenika/zen-cv`;
   - prints the GitHub variables to set.
2. Deploy once, by pushing to `main` or running the workflow manually.
3. `deploy/enable-iap.sh` turns on IAP and grants access to the `zenika.com` domain.

The Zenika organisation only allows resources in approved regions (`constraints/gcp.resourceLocations`). Anything that would default to `global` must be pinned to `europe-west9`.

### Cloud Run settings

The Cloud SQL socket URL has the form `postgresql://USER:PASSWORD@/DATABASE?host=/cloudsql/PROJECT:REGION:INSTANCE`.

The service has 2 GiB of memory, for Chromium, and handles at most 10 concurrent requests per instance. It scales to zero, so the first request after a quiet period takes a few seconds.

## Conventions

- **Language:** code is in English; text shown to users, including API error messages, is in French.
- **Comments:** keep them rare.
- **Formatting:** Prettier, with the settings in `.prettierrc.json`. Run `pnpm lint` before committing; CI fails if lint would change anything.
