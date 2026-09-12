# Space Race · Cargo Run

A playable 3D browser game built with React, Three.js and a Cloudflare Workers-compatible Vinext server. Deliver medical supplies from Port Meridian to Kepler Outpost in a 75-second continuous-forward flight.

## Play

- Choose Kestrel (balanced), Wraith (agile), Atlas (armored), or draw an optional custom ship.
- WASD / arrows: steer left, right, up and down. Space: fire pulse cannons. Escape: pause.
- On touchscreens, drag the steering pad and hold FIRE.
- Avoid asteroids and black-hole gravity wells. Pirates fire at your ship. Impacts damage hull and cargo.
- Reach the destination with hull and cargo remaining. Pause, return to hangar, or restart after either result.

## Local development

```sh
npm ci
npm run dev
```

The local URL is printed by the server. Production build: `npm run build`. Type check: `npx tsc --noEmit`. Tests: `npx playwright test` (the configuration uses Chrome on macOS; adapt `executablePath` for another platform). Start the local server before browser tests.

## AI setup and truthful fallbacks

Live AI is implemented but requires a server-side OpenAI API key. Use the OpenAI Developers plugin's `openai-platform-api-key` workflow with owner approval to create/reuse a key, then set `OPENAI_API_KEY` as a secret in the existing Site's runtime environment. Do not put it in chat, source, the hosting manifest, or a client-prefixed variable. Optional server variable `OPENAI_MODEL` defaults to `gpt-4.1-mini`.

For local development, copy `.env.example` to ignored `.env` and configure the key there using a secure credential workflow. Both endpoints use the OpenAI Responses API with strict JSON schema, no response storage, input size limits, timeouts, and validated geometry/gameplay bounds. The API key is accessed only by server routes.

- `/api/ship`: sends the top-down sketch image to OpenAI vision, obtains nine half-widths, thickness and engine count, then validates the blueprint. The same real extruded 3D mesh appears in preview and in flight. This is a constrained, mirrored stylized hull, not unrestricted mesh reconstruction.
- `/api/mission`: asks OpenAI for encounters before launch. The plan enforces spacing, coordinates, counts and black-hole limits. All movement, spawning, collision detection and combat run locally. No per-frame model calls.
- `/api/ai-status`: reports only whether the server credential is configured.

When a key is absent or a model call fails, the game offers an explicitly labeled fixed practice mission and a local outline-to-mesh builder. These fallbacks do not claim to use live AI. Sketches/custom ships live in the current browser session only. The Site is owner-private by default; the lightweight per-isolate request limit is not a substitute for public-service abuse controls.

## Source and assets

The GitHub `origin` is preserved. `.openai/hosting.json` identifies the existing ChatGPT Site and must be reused for updates. Sites' separate source repository is used for deployment. Never create a second Site for this checkout.

Ships, asteroids, planets and gravity wells are genuine Three.js geometry authored in Codex. The nebula asset was generated with OpenAI image generation. No external text-to-3D provider is required.

Official API references: [structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs), [vision inputs](https://developers.openai.com/api/docs/guides/images-vision).
