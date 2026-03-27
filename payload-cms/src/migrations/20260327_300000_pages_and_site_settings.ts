import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-d1-sqlite'

export async function up({ db }: MigrateUpArgs): Promise<void> {

  // ── 1. Create `pages` table ─────────────────────────────────────────────────
  await db.run(sql`CREATE TABLE IF NOT EXISTS \`pages\` (
    \`id\` integer PRIMARY KEY NOT NULL,
    \`title\` text NOT NULL,
    \`slug\` text NOT NULL,
    \`tenant_id\` integer,
    \`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    \`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    FOREIGN KEY (\`tenant_id\`) REFERENCES \`tenants\`(\`id\`) ON UPDATE no action ON DELETE set null
  );`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`pages_updated_at_idx\` ON \`pages\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`pages_created_at_idx\` ON \`pages\` (\`created_at\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`pages_tenant_idx\` ON \`pages\` (\`tenant_id\`);`)

  // ── 2. Create pages_blocks_* tables ────────────────────────────────────────

  // HeroBlock
  await db.run(sql`CREATE TABLE IF NOT EXISTS \`pages_blocks_hero\` (
    \`_order\` integer NOT NULL,
    \`_parent_id\` integer NOT NULL,
    \`_path\` text NOT NULL,
    \`id\` text PRIMARY KEY NOT NULL,
    \`eyebrow\` text,
    \`headline\` text,
    \`description\` text,
    \`cta_primary\` text DEFAULT 'Maak een afspraak',
    \`cta_secondary\` text DEFAULT 'Bel ons',
    \`image_url\` text,
    \`block_name\` text,
    FOREIGN KEY (\`_parent_id\`) REFERENCES \`pages\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`pages_blocks_hero_order_idx\` ON \`pages_blocks_hero\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`pages_blocks_hero_parent_id_idx\` ON \`pages_blocks_hero\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`pages_blocks_hero_path_idx\` ON \`pages_blocks_hero\` (\`_path\`);`)

  // QuoteBlock
  await db.run(sql`CREATE TABLE IF NOT EXISTS \`pages_blocks_quote\` (
    \`_order\` integer NOT NULL,
    \`_parent_id\` integer NOT NULL,
    \`_path\` text NOT NULL,
    \`id\` text PRIMARY KEY NOT NULL,
    \`text\` text,
    \`author_name\` text,
    \`author_role\` text,
    \`block_name\` text,
    FOREIGN KEY (\`_parent_id\`) REFERENCES \`pages\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`pages_blocks_quote_order_idx\` ON \`pages_blocks_quote\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`pages_blocks_quote_parent_id_idx\` ON \`pages_blocks_quote\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`pages_blocks_quote_path_idx\` ON \`pages_blocks_quote\` (\`_path\`);`)

  // FeaturesBlock (top-level + items sub-table)
  await db.run(sql`CREATE TABLE IF NOT EXISTS \`pages_blocks_features\` (
    \`_order\` integer NOT NULL,
    \`_parent_id\` integer NOT NULL,
    \`_path\` text NOT NULL,
    \`id\` text PRIMARY KEY NOT NULL,
    \`eyebrow\` text,
    \`title\` text,
    \`subtitle\` text,
    \`image_url\` text,
    \`block_name\` text,
    FOREIGN KEY (\`_parent_id\`) REFERENCES \`pages\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`pages_blocks_features_order_idx\` ON \`pages_blocks_features\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`pages_blocks_features_parent_id_idx\` ON \`pages_blocks_features\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`pages_blocks_features_path_idx\` ON \`pages_blocks_features\` (\`_path\`);`)

  await db.run(sql`CREATE TABLE IF NOT EXISTS \`pages_blocks_features_items\` (
    \`_order\` integer NOT NULL,
    \`_parent_id\` text NOT NULL,
    \`id\` text PRIMARY KEY NOT NULL,
    \`icon\` text,
    \`title\` text,
    \`desc\` text,
    FOREIGN KEY (\`_parent_id\`) REFERENCES \`pages_blocks_features\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`pages_blocks_features_items_order_idx\` ON \`pages_blocks_features_items\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`pages_blocks_features_items_parent_id_idx\` ON \`pages_blocks_features_items\` (\`_parent_id\`);`)

  // ServicesBlock (top-level + items + items_bullets)
  await db.run(sql`CREATE TABLE IF NOT EXISTS \`pages_blocks_services\` (
    \`_order\` integer NOT NULL,
    \`_parent_id\` integer NOT NULL,
    \`_path\` text NOT NULL,
    \`id\` text PRIMARY KEY NOT NULL,
    \`eyebrow\` text,
    \`title\` text,
    \`subtitle\` text,
    \`block_name\` text,
    FOREIGN KEY (\`_parent_id\`) REFERENCES \`pages\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`pages_blocks_services_order_idx\` ON \`pages_blocks_services\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`pages_blocks_services_parent_id_idx\` ON \`pages_blocks_services\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`pages_blocks_services_path_idx\` ON \`pages_blocks_services\` (\`_path\`);`)

  await db.run(sql`CREATE TABLE IF NOT EXISTS \`pages_blocks_services_items\` (
    \`_order\` integer NOT NULL,
    \`_parent_id\` text NOT NULL,
    \`id\` text PRIMARY KEY NOT NULL,
    \`tag\` text,
    \`title\` text,
    \`desc\` text,
    \`image_url\` text,
    \`cta\` text,
    FOREIGN KEY (\`_parent_id\`) REFERENCES \`pages_blocks_services\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`pages_blocks_services_items_order_idx\` ON \`pages_blocks_services_items\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`pages_blocks_services_items_parent_id_idx\` ON \`pages_blocks_services_items\` (\`_parent_id\`);`)

  await db.run(sql`CREATE TABLE IF NOT EXISTS \`pages_blocks_services_items_bullets\` (
    \`_order\` integer NOT NULL,
    \`_parent_id\` text NOT NULL,
    \`id\` text PRIMARY KEY NOT NULL,
    \`text\` text,
    FOREIGN KEY (\`_parent_id\`) REFERENCES \`pages_blocks_services_items\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`pages_blocks_services_items_bullets_order_idx\` ON \`pages_blocks_services_items_bullets\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`pages_blocks_services_items_bullets_parent_id_idx\` ON \`pages_blocks_services_items_bullets\` (\`_parent_id\`);`)

  // TeamBlock (top-level + members)
  await db.run(sql`CREATE TABLE IF NOT EXISTS \`pages_blocks_team\` (
    \`_order\` integer NOT NULL,
    \`_parent_id\` integer NOT NULL,
    \`_path\` text NOT NULL,
    \`id\` text PRIMARY KEY NOT NULL,
    \`eyebrow\` text,
    \`title\` text,
    \`subtitle\` text,
    \`block_name\` text,
    FOREIGN KEY (\`_parent_id\`) REFERENCES \`pages\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`pages_blocks_team_order_idx\` ON \`pages_blocks_team\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`pages_blocks_team_parent_id_idx\` ON \`pages_blocks_team\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`pages_blocks_team_path_idx\` ON \`pages_blocks_team\` (\`_path\`);`)

  await db.run(sql`CREATE TABLE IF NOT EXISTS \`pages_blocks_team_members\` (
    \`_order\` integer NOT NULL,
    \`_parent_id\` text NOT NULL,
    \`id\` text PRIMARY KEY NOT NULL,
    \`name\` text,
    \`role\` text,
    \`bio\` text,
    \`image_url\` text,
    FOREIGN KEY (\`_parent_id\`) REFERENCES \`pages_blocks_team\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`pages_blocks_team_members_order_idx\` ON \`pages_blocks_team_members\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`pages_blocks_team_members_parent_id_idx\` ON \`pages_blocks_team_members\` (\`_parent_id\`);`)

  // ReviewsBlock (top-level + items)
  await db.run(sql`CREATE TABLE IF NOT EXISTS \`pages_blocks_reviews\` (
    \`_order\` integer NOT NULL,
    \`_parent_id\` integer NOT NULL,
    \`_path\` text NOT NULL,
    \`id\` text PRIMARY KEY NOT NULL,
    \`title\` text,
    \`subtitle\` text,
    \`block_name\` text,
    FOREIGN KEY (\`_parent_id\`) REFERENCES \`pages\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`pages_blocks_reviews_order_idx\` ON \`pages_blocks_reviews\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`pages_blocks_reviews_parent_id_idx\` ON \`pages_blocks_reviews\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`pages_blocks_reviews_path_idx\` ON \`pages_blocks_reviews\` (\`_path\`);`)

  await db.run(sql`CREATE TABLE IF NOT EXISTS \`pages_blocks_reviews_items\` (
    \`_order\` integer NOT NULL,
    \`_parent_id\` text NOT NULL,
    \`id\` text PRIMARY KEY NOT NULL,
    \`name\` text,
    \`stars\` integer,
    \`date\` text,
    \`text\` text,
    FOREIGN KEY (\`_parent_id\`) REFERENCES \`pages_blocks_reviews\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`pages_blocks_reviews_items_order_idx\` ON \`pages_blocks_reviews_items\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`pages_blocks_reviews_items_parent_id_idx\` ON \`pages_blocks_reviews_items\` (\`_parent_id\`);`)

  // HoursBlock (top-level + items)
  await db.run(sql`CREATE TABLE IF NOT EXISTS \`pages_blocks_hours\` (
    \`_order\` integer NOT NULL,
    \`_parent_id\` integer NOT NULL,
    \`_path\` text NOT NULL,
    \`id\` text PRIMARY KEY NOT NULL,
    \`block_name\` text,
    FOREIGN KEY (\`_parent_id\`) REFERENCES \`pages\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`pages_blocks_hours_order_idx\` ON \`pages_blocks_hours\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`pages_blocks_hours_parent_id_idx\` ON \`pages_blocks_hours\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`pages_blocks_hours_path_idx\` ON \`pages_blocks_hours\` (\`_path\`);`)

  await db.run(sql`CREATE TABLE IF NOT EXISTS \`pages_blocks_hours_items\` (
    \`_order\` integer NOT NULL,
    \`_parent_id\` text NOT NULL,
    \`id\` text PRIMARY KEY NOT NULL,
    \`day\` text,
    \`time\` text,
    \`open\` integer DEFAULT 1,
    FOREIGN KEY (\`_parent_id\`) REFERENCES \`pages_blocks_hours\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`pages_blocks_hours_items_order_idx\` ON \`pages_blocks_hours_items\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`pages_blocks_hours_items_parent_id_idx\` ON \`pages_blocks_hours_items\` (\`_parent_id\`);`)

  // VergoedingBlock (top-level + info_blocks + insurers)
  await db.run(sql`CREATE TABLE IF NOT EXISTS \`pages_blocks_vergoeding\` (
    \`_order\` integer NOT NULL,
    \`_parent_id\` integer NOT NULL,
    \`_path\` text NOT NULL,
    \`id\` text PRIMARY KEY NOT NULL,
    \`eyebrow\` text,
    \`title\` text,
    \`intro\` text,
    \`cta\` text,
    \`block_name\` text,
    FOREIGN KEY (\`_parent_id\`) REFERENCES \`pages\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`pages_blocks_vergoeding_order_idx\` ON \`pages_blocks_vergoeding\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`pages_blocks_vergoeding_parent_id_idx\` ON \`pages_blocks_vergoeding\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`pages_blocks_vergoeding_path_idx\` ON \`pages_blocks_vergoeding\` (\`_path\`);`)

  await db.run(sql`CREATE TABLE IF NOT EXISTS \`pages_blocks_vergoeding_info_blocks\` (
    \`_order\` integer NOT NULL,
    \`_parent_id\` text NOT NULL,
    \`id\` text PRIMARY KEY NOT NULL,
    \`title\` text,
    \`text\` text,
    FOREIGN KEY (\`_parent_id\`) REFERENCES \`pages_blocks_vergoeding\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`pages_blocks_vergoeding_info_blocks_order_idx\` ON \`pages_blocks_vergoeding_info_blocks\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`pages_blocks_vergoeding_info_blocks_parent_id_idx\` ON \`pages_blocks_vergoeding_info_blocks\` (\`_parent_id\`);`)

  await db.run(sql`CREATE TABLE IF NOT EXISTS \`pages_blocks_vergoeding_insurers\` (
    \`_order\` integer NOT NULL,
    \`_parent_id\` text NOT NULL,
    \`id\` text PRIMARY KEY NOT NULL,
    \`name\` text,
    FOREIGN KEY (\`_parent_id\`) REFERENCES \`pages_blocks_vergoeding\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`pages_blocks_vergoeding_insurers_order_idx\` ON \`pages_blocks_vergoeding_insurers\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`pages_blocks_vergoeding_insurers_parent_id_idx\` ON \`pages_blocks_vergoeding_insurers\` (\`_parent_id\`);`)

  // ContactBlock
  await db.run(sql`CREATE TABLE IF NOT EXISTS \`pages_blocks_contact\` (
    \`_order\` integer NOT NULL,
    \`_parent_id\` integer NOT NULL,
    \`_path\` text NOT NULL,
    \`id\` text PRIMARY KEY NOT NULL,
    \`eyebrow\` text,
    \`title\` text,
    \`intro\` text,
    \`block_name\` text,
    FOREIGN KEY (\`_parent_id\`) REFERENCES \`pages\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`pages_blocks_contact_order_idx\` ON \`pages_blocks_contact\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`pages_blocks_contact_parent_id_idx\` ON \`pages_blocks_contact\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`pages_blocks_contact_path_idx\` ON \`pages_blocks_contact\` (\`_path\`);`)

  // ── 3. Create `site_settings` table ────────────────────────────────────────
  await db.run(sql`CREATE TABLE IF NOT EXISTS \`site_settings\` (
    \`id\` integer PRIMARY KEY NOT NULL,
    \`practice_name\` text NOT NULL,
    \`business_city\` text,
    \`business_address\` text,
    \`business_postal_code\` text,
    \`business_google_reviews_score\` text,
    \`business_google_reviews_count\` integer,
    \`business_google_reviews_url\` text,
    \`contact_phone\` text,
    \`contact_email\` text,
    \`theme_style_preset\` text,
    \`theme_accent_color\` text,
    \`theme_accent_hover_color\` text,
    \`footer_meta_title\` text,
    \`footer_meta_description\` text,
    \`footer_tagline\` text,
    \`tenant_id\` integer,
    \`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    \`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    FOREIGN KEY (\`tenant_id\`) REFERENCES \`tenants\`(\`id\`) ON UPDATE no action ON DELETE set null
  );`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`site_settings_updated_at_idx\` ON \`site_settings\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`site_settings_created_at_idx\` ON \`site_settings\` (\`created_at\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`site_settings_tenant_idx\` ON \`site_settings\` (\`tenant_id\`);`)

  // ── 4. Add pages_id + site_settings_id to payload_locked_documents_rels ────
  await db.run(sql`ALTER TABLE \`payload_locked_documents_rels\` ADD COLUMN \`pages_id\` integer;`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`payload_locked_documents_rels_pages_id_idx\` ON \`payload_locked_documents_rels\` (\`pages_id\`);`)
  await db.run(sql`ALTER TABLE \`payload_locked_documents_rels\` ADD COLUMN \`site_settings_id\` integer;`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`payload_locked_documents_rels_site_settings_id_idx\` ON \`payload_locked_documents_rels\` (\`site_settings_id\`);`)

  // ── 5. Drop orphaned flat-schema array tables (from 20260326_120000 migration) ─
  // These were created by the original full-schema migration and were never cleaned up.
  // Must be dropped before dental_sites (they reference it via _parent_id).
  await db.run(sql`DROP TABLE IF EXISTS \`dental_sites_vergoeding_insurers\`;`)
  await db.run(sql`DROP TABLE IF EXISTS \`dental_sites_vergoeding_blocks\`;`)
  await db.run(sql`DROP TABLE IF EXISTS \`dental_sites_hours_items\`;`)
  await db.run(sql`DROP TABLE IF EXISTS \`dental_sites_reviews_items\`;`)
  await db.run(sql`DROP TABLE IF EXISTS \`dental_sites_team_members\`;`)
  await db.run(sql`DROP TABLE IF EXISTS \`dental_sites_services_items\`;`)
  await db.run(sql`DROP TABLE IF EXISTS \`dental_sites_features_items\`;`)

  // ── 6. Drop dental_sites_blocks_* tables (deepest first) ───────────────────
  await db.run(sql`DROP TABLE IF EXISTS \`dental_sites_blocks_services_items_bullets\`;`)
  await db.run(sql`DROP TABLE IF EXISTS \`dental_sites_blocks_services_items\`;`)
  await db.run(sql`DROP TABLE IF EXISTS \`dental_sites_blocks_services\`;`)
  await db.run(sql`DROP TABLE IF EXISTS \`dental_sites_blocks_features_items\`;`)
  await db.run(sql`DROP TABLE IF EXISTS \`dental_sites_blocks_features\`;`)
  await db.run(sql`DROP TABLE IF EXISTS \`dental_sites_blocks_team_members\`;`)
  await db.run(sql`DROP TABLE IF EXISTS \`dental_sites_blocks_team\`;`)
  await db.run(sql`DROP TABLE IF EXISTS \`dental_sites_blocks_reviews_items\`;`)
  await db.run(sql`DROP TABLE IF EXISTS \`dental_sites_blocks_reviews\`;`)
  await db.run(sql`DROP TABLE IF EXISTS \`dental_sites_blocks_hours_items\`;`)
  await db.run(sql`DROP TABLE IF EXISTS \`dental_sites_blocks_hours\`;`)
  await db.run(sql`DROP TABLE IF EXISTS \`dental_sites_blocks_vergoeding_info_blocks\`;`)
  await db.run(sql`DROP TABLE IF EXISTS \`dental_sites_blocks_vergoeding_insurers\`;`)
  await db.run(sql`DROP TABLE IF EXISTS \`dental_sites_blocks_vergoeding\`;`)
  await db.run(sql`DROP TABLE IF EXISTS \`dental_sites_blocks_contact\`;`)
  await db.run(sql`DROP TABLE IF EXISTS \`dental_sites_blocks_quote\`;`)
  await db.run(sql`DROP TABLE IF EXISTS \`dental_sites_blocks_hero\`;`)

  // ── 7. Drop dental_sites table ──────────────────────────────────────────────
  await db.run(sql`DROP TABLE IF EXISTS \`dental_sites\`;`)

  // ── 8. Drop dental_sites_id from payload_locked_documents_rels ─────────────
  await db.run(sql`ALTER TABLE \`payload_locked_documents_rels\` DROP COLUMN \`dental_sites_id\`;`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // Re-create dental_sites (minimal — just enough to reverse the drop)
  await db.run(sql`CREATE TABLE IF NOT EXISTS \`dental_sites\` (
    \`id\` integer PRIMARY KEY NOT NULL,
    \`practice_name\` text NOT NULL,
    \`tenant_id\` integer,
    \`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    \`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    FOREIGN KEY (\`tenant_id\`) REFERENCES \`tenants\`(\`id\`) ON UPDATE no action ON DELETE set null
  );`)

  // Drop new tables
  await db.run(sql`DROP TABLE IF EXISTS \`pages_blocks_contact\`;`)
  await db.run(sql`DROP TABLE IF EXISTS \`pages_blocks_vergoeding_insurers\`;`)
  await db.run(sql`DROP TABLE IF EXISTS \`pages_blocks_vergoeding_info_blocks\`;`)
  await db.run(sql`DROP TABLE IF EXISTS \`pages_blocks_vergoeding\`;`)
  await db.run(sql`DROP TABLE IF EXISTS \`pages_blocks_hours_items\`;`)
  await db.run(sql`DROP TABLE IF EXISTS \`pages_blocks_hours\`;`)
  await db.run(sql`DROP TABLE IF EXISTS \`pages_blocks_reviews_items\`;`)
  await db.run(sql`DROP TABLE IF EXISTS \`pages_blocks_reviews\`;`)
  await db.run(sql`DROP TABLE IF EXISTS \`pages_blocks_team_members\`;`)
  await db.run(sql`DROP TABLE IF EXISTS \`pages_blocks_team\`;`)
  await db.run(sql`DROP TABLE IF EXISTS \`pages_blocks_services_items_bullets\`;`)
  await db.run(sql`DROP TABLE IF EXISTS \`pages_blocks_services_items\`;`)
  await db.run(sql`DROP TABLE IF EXISTS \`pages_blocks_services\`;`)
  await db.run(sql`DROP TABLE IF EXISTS \`pages_blocks_features_items\`;`)
  await db.run(sql`DROP TABLE IF EXISTS \`pages_blocks_features\`;`)
  await db.run(sql`DROP TABLE IF EXISTS \`pages_blocks_quote\`;`)
  await db.run(sql`DROP TABLE IF EXISTS \`pages_blocks_hero\`;`)
  await db.run(sql`DROP TABLE IF EXISTS \`pages\`;`)
  await db.run(sql`DROP TABLE IF EXISTS \`site_settings\`;`)
  await db.run(sql`ALTER TABLE \`payload_locked_documents_rels\` DROP COLUMN \`pages_id\`;`)
  await db.run(sql`ALTER TABLE \`payload_locked_documents_rels\` DROP COLUMN \`site_settings_id\`;`)
}
