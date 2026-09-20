# Hlíðarendi / Valur in Vallaeyjar

Publish the delivered Blender reconstruction as a built-in island next to Kaplakriki and Víkingsvöllur, available to every visitor independently of browser storage. Export the evaluated Blender meshes to the existing stadium-islands format, preserving 1,200 named seats and their exact local eye/target offsets under the floating island transform. Existing Kaplakriki seat behavior remains supported. Keep source attribution and uncertainty visible, provide a direct link and editable Blender download.

The exporter omits the large ground slab and geographic context outside the venue so the stadium fits on the floating island. No changes are made to the original Blender artifact.

Files: scripts/export_valur.py, public/projects/vallaeyjar/valur-blender.json, valur-hlidarendi.blend, valur-sources.html; shared built-in loading and seat adapter; project page link and copy.

Verification: model data/schema and camera offsets; actual browser raycast into Valur, seated controls and return to islands; repeat Kaplakriki seat checks; Next.js production build; Vercel production deployment state.

Accuracy: photographic/map reconstruction, not a surveyed 1:1 replica; row arrangement and dimensions are estimates. Sources and full limitations are included in valur-sources.html.

Validated on 20 September 2026: 13 Node tests; ESLint for edited route/data; production build; actual Valur and Vikingur desktop/mobile raycasts, fixed-eye controls, roof restoration and export; Kaplakriki desktop/mobile seat regression. Direct route: /verkefni/vallaeyjar?eyja=valur.
