# Víkingsvöllur in Vallaeyjar

The public viewer ships Víkingsvöllur beside Kaplakriki as a second built-in island. It loads for every visitor, survives reload without local storage, and cannot be removed as though it were a private import. User-created islands retain their existing local-only behavior.

The exporter converts the existing evaluated Blender delivery from Z-up to Y-up, merges static geometry into material/layer batches, and preserves 1,076 individually selectable seats in two shared mesh batches. The rectangular site slab and adjacent training fields are omitted so the existing floating island supplies the terrain. The package is approximately 1 MB in 30 batches.

Seat metadata now optionally carries validated IDs, labels and local eye/target offsets. Existing Kaplakriki seat inference remains unchanged. Invalid explicit seat records are rejected before rendering. Exports retain seat records, so seat picking continues after importing the downloaded package.

Regenerate with `python3 scripts/export_vikingur.py /path/to/Vikingsvollur_Blender`. The package records a SHA-256 of its source .blend. See `public/projects/vallaeyjar/vikingur-sources.md` for evidence and precision limits.

## Verification

- All seven Node tests passed; explicit seat records and 3,050 existing Kaplakriki seats covered.
- Next.js production build and TypeScript checks passed; edited page files passed ESLint.
- Chromium desktop and emulated mobile tests passed for both stadiums: actual seat raycasts/taps, fixed seated eye position, look controls, restored roof, return to overview and switching islands.
- Vikingur remains available after reload and cannot be removed as a private island. Download preserves all seat records; reimport correctly opens the existing island without duplication.
- Screenshots of the floating islands and seated views were inspected. These tests verify interaction, not surveyed accuracy or physical-device browser compatibility.
