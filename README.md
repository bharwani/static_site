# Fastly-style landing page

A single-page, static clone of fastly.com's homepage. Plain HTML/CSS/JS — no build step, no framework, no dependencies.

## Run it

```
python3 -m http.server 8934
```

Then open http://localhost:8934/index.html.

## Structure

```
index.html          all page content (hero, platform, network stats, solutions, spotlights, CTA, API test panel, footer)
css/style.css        styles, responsive breakpoints at 1080px / 780px / 640px
js/main.js            mobile nav toggle + stat count-up animation
js/api-tests.js       "Run API tests" button logic (see below)
images/               logo, hero graphic, section icons (.svg originals + rasterized .jpg copies; index.html uses the .jpg)
api/mock.js            client-side fetch() mock for /api/v1 and /api/v2 routes
api/mock.test.mjs      unit test for the mock's route matching (node api/mock.test.mjs)
api/test-endpoints.mjs CLI smoke/volume test that hits every mocked endpoint (see below)
```

## API mock

`api/mock.js` overrides `window.fetch` (loaded as a module in `index.html`) so any `fetch()` call to a mocked path resolves to canned JSON instead of hitting a real server. Unmatched paths fall through to the real `fetch`.

Routes:
- `/api/v1/{1,2,3,login,register}/*`
- `/api/v2/{login,register}/*`
- `/api/v2/users/:userId/{create,update,read,delete}`

Test it from the terminal:

```
node api/mock.test.mjs                          # route-matching unit test
node api/test-endpoints.mjs                      # hits every endpoint once
node api/test-endpoints.mjs --requests=50        # volume test, 50 requests/endpoint
REQUESTS_PER_ENDPOINT=50 node api/test-endpoints.mjs   # same, via env var
```

Or from the page itself: scroll to "API mock test runner" and click **Run API tests** — it prompts for a request count, runs them all through the real in-browser `fetch()`, shows a live countdown, and notifies you when done.

## Notes

- No real backend — this is a static site. The `/api` mock only works in the browser tab that loaded `index.html` (or via the Node scripts above); it does not run on a server.
- Images: `.svg` originals are hand-drawn/vector; matching `.jpg` files are rasterized copies. `index.html` currently references the `.jpg` versions.
