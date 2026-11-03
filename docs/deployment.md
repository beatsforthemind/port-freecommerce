# Deploy Port FreeCommerce through Vercel

The app is a static Vite site. Vercel builds the source and serves `dist/`; there are no server functions, databases, environment variables, or API keys to configure. Vercel supports [Vite deployments](https://vercel.com/docs/frameworks/frontend/vite) and the selected [Node 24 runtime](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions).

## Project settings

`vercel.json` supplies these [build settings](https://vercel.com/docs/project-configuration/vercel-json):

| Setting | Value |
| --- | --- |
| Root directory | The folder containing `package.json` and `vercel.json` |
| Framework | Vite |
| Node.js | 24.x, from `package.json` |
| Install command | `npm ci --include=dev` |
| Build command | `npm run build` |
| Output directory | `dist` |
| Environment variables | None |

Keep `package-lock.json`, `scripts/`, and `public/` with the source. `.vercelignore` excludes local dependencies, generated output, review documents, local environment files, and editor metadata from CLI uploads. Vercel installs dependencies and generates a fresh build.

## Check locally

```sh
nvm install
nvm use
npm ci --include=dev
npm run build
npm run preview
```

The build runs `scripts/verify-build.mjs` after Vite. It checks the compiled JavaScript and CSS, requires all four GLBs and `credits.txt`, validates GLB headers, and compares every copied public file with its source. `npm run check:build` repeats verification of an existing build.

In the preview, enter the station, open the map with **M**, and visit observation, the exchange, the docks, and the upper promenade. Check the Controls credits link. Verify mouse movement or the drag fallback, and touch movement on a phone. Fonts use Google Fonts with local fallbacks; model assets are served from the deployment itself.

## Deploy from this folder

The Vercel CLI is already available in the current workspace environment. Run:

```sh
vercel
```

Sign in if prompted, then select your account or team and the intended project. Confirm the root directory and settings above. The default deployment is a preview; use its URL for the same smoke check before publishing:

```sh
vercel --prod
```

These commands create remote deployments. Preparation alone does not link an account, create a Vercel project, or publish the site. No project IDs or credentials are stored in the source; `.vercel/` is ignored.

Alternatively, import [beatsforthemind/port-freecommerce](https://github.com/beatsforthemind/port-freecommerce) from GitHub into Vercel. Use the repository root as the project root and retain the supplied settings.

## Asset delivery and routing

`vercel.json` gives hashed files in `/assets/` a one-year immutable browser cache. HTML and unversioned `/models/` files revalidate, so future model replacements are visible to returning visitors. These values use Vercel's [Cache-Control header support](https://vercel.com/docs/caching/cache-control-headers).

All models and their credits are copied from `public/models/poly-pizza/` into the deployment. The station's map changes scene state without changing the URL, so no SPA catch-all rewrite is configured. Missing assets remain ordinary missing files rather than receiving HTML.

Vite preview serves the production artifact locally; it does not apply Vercel's CDN headers. After deployment, inspect the live response headers and model requests to confirm platform delivery. A nonfatal bundle-size advisory remains for the Three.js scene; it does not prevent the production build.

## Readiness verification

Verified on November 3, 2026 with Node 24.22.1: a clean dependency install and production build passed in an isolated folder. Chromium checks at 1280×800 and a touch-enabled 390×844 viewport loaded all four models and 80 inhabitants, visited every sector and the upper promenade, and fetched the model credits successfully. No JavaScript errors or local HTTP failures occurred. Local font fallbacks also worked. These functional checks used emulated devices and do not measure hardware performance.

An independent review confirmed the build fails when a required model or the credits file is removed from both source and output. All configured Vercel properties were checked against the published configuration schema. Live Vercel delivery remains to be checked after publishing.
