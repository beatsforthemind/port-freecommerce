# Typefaces

The interface and every sign in the station use two typefaces, served from this
site rather than from a font service.

| File | Typeface | Weights | Source |
| --- | --- | --- | --- |
| `space-grotesk-latin-wght.woff2` | Space Grotesk 2.000 | 300–700, variable | `ofl/spacegrotesk/SpaceGrotesk[wght].ttf` |
| `barlow-condensed-latin-500.woff2` | Barlow Condensed 1.408 | 500 | `ofl/barlowcondensed/BarlowCondensed-Medium.ttf` |
| `barlow-condensed-latin-600.woff2` | Barlow Condensed 1.408 | 600 | `ofl/barlowcondensed/BarlowCondensed-SemiBold.ttf` |

Sources are from <https://github.com/google/fonts> (commit `35e77c385497`,
November 2026). Both typefaces are under the SIL Open Font License 1.1 and
declare no Reserved Font Name. The licence and copyright notices are in
`public/fonts/OFL.txt`, which is published with the site and linked from the
Controls dialog; the notices are also kept in each file's name table.

## What is in the files

Each file is a subset: the Latin range Google Fonts serves as `latin`, plus the
arrows U+2190–2199. Space Grotesk draws those arrows, and the signs use them;
the hosted `latin` subset left most of them out, so they fell back to whatever
the visitor's system offered. Barlow Condensed has no arrows and is only used
for headings.

Two characters the interface uses are in neither typeface and still fall back:
the pause mark `Ⅱ`, and `⇄`, which the signs avoid for that reason.

## Rebuilding

Only needed if the character set or the weights change. With Python's
`fonttools` and `brotli` installed:

```sh
LATIN="U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD"
pyftsubset "SpaceGrotesk[wght].ttf" --unicodes="$LATIN,U+2190-2199" \
  --layout-features+=tnum --name-IDs='*' --no-hinting --flavor=woff2 \
  --output-file=space-grotesk-latin-wght.woff2
```

The same command produces the two Barlow Condensed files. `tnum` is kept
because the interface asks for tabular figures. A file's name is its identity:
if its contents change, the build gives it a new address, so the year-long
cache on `/assets/` stays safe.
