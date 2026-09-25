"""Shared constants for the Nauthólsvík pipeline (no third-party imports)."""

# Local metric frame: transverse Mercator with scale 1.0 at the origin, so one
# Blender unit is one real metre (distortion < 1 mm/km inside the model).
# Origin = centre of the geothermal lagoon's high-tide water line.
# +X = east, +Y = true north, +Z = up (metres above mean sea level).
LAT0, LON0 = 64.1213, -21.9300
PROJ = (f"+proj=tmerc +lat_0={LAT0} +lon_0={LON0} +k=1 +x_0=0 +y_0=0 "
        "+ellps=WGS84 +units=m +no_defs")

# ArcticDEM heights are WGS84-ellipsoidal. Mean sea level is taken as 65.10 m
# above the ellipsoid: with it, the highest DSM point on the Reykjavík Airport
# runways matches the published aerodrome elevation (14 m AMSL). ArcticDEM
# flattens open water to 66.48 m (+1.38 m here), matching the OSM note that
# the lagoon shoreline was surveyed at high tide.
ELLIPSOID_TO_MSL = 65.10
DEM_WATER_FLAT = 66.4766

# Water level used in the scene: a mid-to-high tide with the lagoon full and
# the mouth sill submerged, as in the reference photos. Reykjavík's spring
# tidal range is roughly 4 m, so this is a chosen state, not a constant.
WATER_Z = 1.20

# Detailed, drivable world and the lower-detail visual backdrop (local metres).
WORLD = (-450.0, -350.0, 450.0, 500.0)
BACKDROP = (-730.0, -920.0, 1450.0, 1070.0)
