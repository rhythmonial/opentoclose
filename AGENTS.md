<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Keep usage low

The project owner wants Claude usage kept as low as possible:

- Don't preview or screenshot small changes (spacing, wording, colors, simple layout). Make the change, run typecheck and lint on the files touched, and push; the owner checks the deployed site.
- Preview only bigger changes (new behavior or flows, anything risky), or when asked. Prefer checking page text over opening screenshots.
- Run a full `next build` only before larger pushes, not after every tweak.
- Keep replies short: what changed and anything the owner needs to know.
