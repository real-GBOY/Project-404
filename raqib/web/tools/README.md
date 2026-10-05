# tools/transpile.mjs (historical)

`src/ui/generated/**` was produced once from the approved Claude Design file (`Raqib.dc.html`, from the Claude Design project
089bc4ff-… with DesignSync) by this script (`npx --yes -p htmlparser2 node tools/transpile.mjs src/ui <path-to>/Raqib.dc.html`).

**Those screens are now ordinary source owned by this repository.** They were edited after generation (every color now comes from
`src/styles/colors.ts` and every font stack from `src/styles/typography.ts`), so re-running the transpiler would overwrite that work
and reintroduce raw literals (the `colors` test would fail). Do not regenerate them. Change behavior in a presenter
(`src/presenters`), change a look by editing the screen or a token, and keep colors in `colors.ts`.

The design file as exported was cut off at 256 KiB (mid-modal), so the modal frame/footer, toast and evidence viewer were always
hand-written (`src/components`).
