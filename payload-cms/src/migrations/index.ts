import * as migration_20260326_000000_autosite_schema from './20260326_000000_autosite_schema'

export const migrations = [
  {
    up: migration_20260326_000000_autosite_schema.up,
    down: migration_20260326_000000_autosite_schema.down,
    name: '20260326_000000_autosite_schema',
  },
]
