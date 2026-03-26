import * as migration_20260326_000000_autosite_schema from './20260326_000000_autosite_schema'
import * as migration_20260326_120000_dental_sites_full_schema from './20260326_120000_dental_sites_full_schema'

export const migrations = [
  {
    up: migration_20260326_000000_autosite_schema.up,
    down: migration_20260326_000000_autosite_schema.down,
    name: '20260326_000000_autosite_schema',
  },
  {
    up: migration_20260326_120000_dental_sites_full_schema.up,
    down: migration_20260326_120000_dental_sites_full_schema.down,
    name: '20260326_120000_dental_sites_full_schema',
  },
]
