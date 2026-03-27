import * as migration_20260326_000000_autosite_schema from './20260326_000000_autosite_schema'
import * as migration_20260326_120000_dental_sites_full_schema from './20260326_120000_dental_sites_full_schema'
import * as migration_20260327_100000_add_sections_blocks from './20260327_100000_add_sections_blocks'
import * as migration_20260327_200000_fix_blocks_table_names from './20260327_200000_fix_blocks_table_names'

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
  {
    up: migration_20260327_100000_add_sections_blocks.up,
    down: migration_20260327_100000_add_sections_blocks.down,
    name: '20260327_100000_add_sections_blocks',
  },
  {
    up: migration_20260327_200000_fix_blocks_table_names.up,
    down: migration_20260327_200000_fix_blocks_table_names.down,
    name: '20260327_200000_fix_blocks_table_names',
  },
]
