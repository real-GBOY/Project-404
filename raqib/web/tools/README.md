# tools/transpile.mjs

Regenerates `src/ui/generated/**` from the approved Claude Design file (`Raqib.dc.html`, read from the Claude
Design project 089bc4ff-… with DesignSync). Needs `htmlparser2` (not a project dependency):

    npx --yes -p htmlparser2 node tools/transpile.mjs src/ui <path-to>/Raqib.dc.html

Note: the design file as exported was cut off at 256 KiB (mid-modal), so the modal frame/footer, toast and
evidence viewer are hand-written in `src/ui/*.tsx`. Never edit generated files; change the presenter instead.
