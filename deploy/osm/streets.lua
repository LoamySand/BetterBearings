-- osm2pgsql flex style (KAN-56): named highway ways only, into osm.streets_import.
-- import.sh adds the indexes and swaps it into osm.streets.
-- Keeps every named highway=* way, so a future mode (e.g. cyclist: paths, footways, bike lanes)
-- needs no re-import. The game's own type list is applied at query time in /api/streets (D2).
-- These values are not real streets: planned, being built, or gone.
local skip_highway = { proposed = true, planned = true, construction = true, abandoned = true, razed = true }

-- Tags kept in a jsonb column. access and area: the game skips private roads and marks enclosed
-- areas (server/db/streets.js). The rest are bike and path tags; bike lanes are usually tags on the road.
local tag_keys = {
  'access', 'area',
  'bicycle', 'foot', 'segregated', 'surface',
  'cycleway', 'cycleway:left', 'cycleway:right', 'cycleway:both',
}

local streets = osm2pgsql.define_table({
  name = 'streets_import',
  schema = 'osm',
  ids = { type = 'way', id_column = 'osm_id' },
  columns = {
    { column = 'name', type = 'text', not_null = true },
    { column = 'highway', type = 'text', not_null = true },
    -- Tags the client reads today: ref (I-25, US 550), alternative names, width
    { column = 'ref', type = 'text' },
    { column = 'old_name', type = 'text' },
    { column = 'loc_name', type = 'text' },
    { column = 'width', type = 'text' },
    { column = 'tags', type = 'jsonb' }, -- only the keys in tag_keys; NULL when none are set
    { column = 'geom', type = 'linestring', projection = 4326, not_null = true },
  },
  indexes = {}, -- import.sh creates them after the load, which is faster
})

function osm2pgsql.process_way(object)
  local tags = object.tags
  if not tags.name or not tags.highway or skip_highway[tags.highway] then
    return
  end
  local kept = nil
  for _, key in ipairs(tag_keys) do
    if tags[key] then
      kept = kept or {}
      kept[key] = tags[key]
    end
  end
  streets:insert({
    name = tags.name,
    highway = tags.highway,
    ref = tags.ref,
    old_name = tags.old_name,
    loc_name = tags.loc_name,
    width = tags.width,
    tags = kept,
    geom = object:as_linestring(),
  })
end
