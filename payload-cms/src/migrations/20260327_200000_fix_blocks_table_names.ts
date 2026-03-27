import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-d1-sqlite'

/**
 * Corrective migration: Payload's D1 adapter uses `dental_sites_blocks_{slug}` naming,
 * not `dental_sites_sections_{slug}`. The previous migration used the wrong convention.
 * Also adds the `block_name` column that Payload selects from each top-level block table.
 *
 * Steps:
 *   1. Create correctly-named tables (dental_sites_blocks_*)
 *   2. Drop incorrectly-named tables (dental_sites_sections_*)
 */
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {

  // ── HeroBlock ──────────────────────────────────────────────────────────────
  await db.run(sql`CREATE TABLE IF NOT EXISTS \`dental_sites_blocks_hero\` (
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
    FOREIGN KEY (\`_parent_id\`) REFERENCES \`dental_sites\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`dental_sites_blocks_hero_order_idx\` ON \`dental_sites_blocks_hero\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`dental_sites_blocks_hero_parent_id_idx\` ON \`dental_sites_blocks_hero\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`dental_sites_blocks_hero_path_idx\` ON \`dental_sites_blocks_hero\` (\`_path\`);`)

  // ── QuoteBlock ─────────────────────────────────────────────────────────────
  await db.run(sql`CREATE TABLE IF NOT EXISTS \`dental_sites_blocks_quote\` (
    \`_order\` integer NOT NULL,
    \`_parent_id\` integer NOT NULL,
    \`_path\` text NOT NULL,
    \`id\` text PRIMARY KEY NOT NULL,
    \`text\` text,
    \`author_name\` text,
    \`author_role\` text,
    \`block_name\` text,
    FOREIGN KEY (\`_parent_id\`) REFERENCES \`dental_sites\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`dental_sites_blocks_quote_order_idx\` ON \`dental_sites_blocks_quote\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`dental_sites_blocks_quote_parent_id_idx\` ON \`dental_sites_blocks_quote\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`dental_sites_blocks_quote_path_idx\` ON \`dental_sites_blocks_quote\` (\`_path\`);`)

  // ── FeaturesBlock ──────────────────────────────────────────────────────────
  await db.run(sql`CREATE TABLE IF NOT EXISTS \`dental_sites_blocks_features\` (
    \`_order\` integer NOT NULL,
    \`_parent_id\` integer NOT NULL,
    \`_path\` text NOT NULL,
    \`id\` text PRIMARY KEY NOT NULL,
    \`eyebrow\` text,
    \`title\` text,
    \`subtitle\` text,
    \`image_url\` text,
    \`block_name\` text,
    FOREIGN KEY (\`_parent_id\`) REFERENCES \`dental_sites\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`dental_sites_blocks_features_order_idx\` ON \`dental_sites_blocks_features\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`dental_sites_blocks_features_parent_id_idx\` ON \`dental_sites_blocks_features\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`dental_sites_blocks_features_path_idx\` ON \`dental_sites_blocks_features\` (\`_path\`);`)

  await db.run(sql`CREATE TABLE IF NOT EXISTS \`dental_sites_blocks_features_items\` (
    \`_order\` integer NOT NULL,
    \`_parent_id\` text NOT NULL,
    \`id\` text PRIMARY KEY NOT NULL,
    \`icon\` text,
    \`title\` text,
    \`desc\` text,
    FOREIGN KEY (\`_parent_id\`) REFERENCES \`dental_sites_blocks_features\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`dental_sites_blocks_features_items_order_idx\` ON \`dental_sites_blocks_features_items\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`dental_sites_blocks_features_items_parent_id_idx\` ON \`dental_sites_blocks_features_items\` (\`_parent_id\`);`)

  // ── ServicesBlock ──────────────────────────────────────────────────────────
  await db.run(sql`CREATE TABLE IF NOT EXISTS \`dental_sites_blocks_services\` (
    \`_order\` integer NOT NULL,
    \`_parent_id\` integer NOT NULL,
    \`_path\` text NOT NULL,
    \`id\` text PRIMARY KEY NOT NULL,
    \`eyebrow\` text,
    \`title\` text,
    \`subtitle\` text,
    \`block_name\` text,
    FOREIGN KEY (\`_parent_id\`) REFERENCES \`dental_sites\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`dental_sites_blocks_services_order_idx\` ON \`dental_sites_blocks_services\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`dental_sites_blocks_services_parent_id_idx\` ON \`dental_sites_blocks_services\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`dental_sites_blocks_services_path_idx\` ON \`dental_sites_blocks_services\` (\`_path\`);`)

  await db.run(sql`CREATE TABLE IF NOT EXISTS \`dental_sites_blocks_services_items\` (
    \`_order\` integer NOT NULL,
    \`_parent_id\` text NOT NULL,
    \`id\` text PRIMARY KEY NOT NULL,
    \`tag\` text,
    \`title\` text,
    \`desc\` text,
    \`image_url\` text,
    \`cta\` text,
    FOREIGN KEY (\`_parent_id\`) REFERENCES \`dental_sites_blocks_services\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`dental_sites_blocks_services_items_order_idx\` ON \`dental_sites_blocks_services_items\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`dental_sites_blocks_services_items_parent_id_idx\` ON \`dental_sites_blocks_services_items\` (\`_parent_id\`);`)

  await db.run(sql`CREATE TABLE IF NOT EXISTS \`dental_sites_blocks_services_items_bullets\` (
    \`_order\` integer NOT NULL,
    \`_parent_id\` text NOT NULL,
    \`id\` text PRIMARY KEY NOT NULL,
    \`text\` text,
    FOREIGN KEY (\`_parent_id\`) REFERENCES \`dental_sites_blocks_services_items\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`dental_sites_blocks_services_items_bullets_order_idx\` ON \`dental_sites_blocks_services_items_bullets\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`dental_sites_blocks_services_items_bullets_parent_id_idx\` ON \`dental_sites_blocks_services_items_bullets\` (\`_parent_id\`);`)

  // ── TeamBlock ──────────────────────────────────────────────────────────────
  await db.run(sql`CREATE TABLE IF NOT EXISTS \`dental_sites_blocks_team\` (
    \`_order\` integer NOT NULL,
    \`_parent_id\` integer NOT NULL,
    \`_path\` text NOT NULL,
    \`id\` text PRIMARY KEY NOT NULL,
    \`eyebrow\` text,
    \`title\` text,
    \`subtitle\` text,
    \`block_name\` text,
    FOREIGN KEY (\`_parent_id\`) REFERENCES \`dental_sites\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`dental_sites_blocks_team_order_idx\` ON \`dental_sites_blocks_team\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`dental_sites_blocks_team_parent_id_idx\` ON \`dental_sites_blocks_team\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`dental_sites_blocks_team_path_idx\` ON \`dental_sites_blocks_team\` (\`_path\`);`)

  await db.run(sql`CREATE TABLE IF NOT EXISTS \`dental_sites_blocks_team_members\` (
    \`_order\` integer NOT NULL,
    \`_parent_id\` text NOT NULL,
    \`id\` text PRIMARY KEY NOT NULL,
    \`name\` text,
    \`role\` text,
    \`bio\` text,
    \`image_url\` text,
    FOREIGN KEY (\`_parent_id\`) REFERENCES \`dental_sites_blocks_team\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`dental_sites_blocks_team_members_order_idx\` ON \`dental_sites_blocks_team_members\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`dental_sites_blocks_team_members_parent_id_idx\` ON \`dental_sites_blocks_team_members\` (\`_parent_id\`);`)

  // ── ReviewsBlock ───────────────────────────────────────────────────────────
  await db.run(sql`CREATE TABLE IF NOT EXISTS \`dental_sites_blocks_reviews\` (
    \`_order\` integer NOT NULL,
    \`_parent_id\` integer NOT NULL,
    \`_path\` text NOT NULL,
    \`id\` text PRIMARY KEY NOT NULL,
    \`title\` text,
    \`subtitle\` text,
    \`block_name\` text,
    FOREIGN KEY (\`_parent_id\`) REFERENCES \`dental_sites\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`dental_sites_blocks_reviews_order_idx\` ON \`dental_sites_blocks_reviews\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`dental_sites_blocks_reviews_parent_id_idx\` ON \`dental_sites_blocks_reviews\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`dental_sites_blocks_reviews_path_idx\` ON \`dental_sites_blocks_reviews\` (\`_path\`);`)

  await db.run(sql`CREATE TABLE IF NOT EXISTS \`dental_sites_blocks_reviews_items\` (
    \`_order\` integer NOT NULL,
    \`_parent_id\` text NOT NULL,
    \`id\` text PRIMARY KEY NOT NULL,
    \`name\` text,
    \`stars\` integer,
    \`date\` text,
    \`text\` text,
    FOREIGN KEY (\`_parent_id\`) REFERENCES \`dental_sites_blocks_reviews\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`dental_sites_blocks_reviews_items_order_idx\` ON \`dental_sites_blocks_reviews_items\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`dental_sites_blocks_reviews_items_parent_id_idx\` ON \`dental_sites_blocks_reviews_items\` (\`_parent_id\`);`)

  // ── HoursBlock ─────────────────────────────────────────────────────────────
  await db.run(sql`CREATE TABLE IF NOT EXISTS \`dental_sites_blocks_hours\` (
    \`_order\` integer NOT NULL,
    \`_parent_id\` integer NOT NULL,
    \`_path\` text NOT NULL,
    \`id\` text PRIMARY KEY NOT NULL,
    \`block_name\` text,
    FOREIGN KEY (\`_parent_id\`) REFERENCES \`dental_sites\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`dental_sites_blocks_hours_order_idx\` ON \`dental_sites_blocks_hours\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`dental_sites_blocks_hours_parent_id_idx\` ON \`dental_sites_blocks_hours\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`dental_sites_blocks_hours_path_idx\` ON \`dental_sites_blocks_hours\` (\`_path\`);`)

  await db.run(sql`CREATE TABLE IF NOT EXISTS \`dental_sites_blocks_hours_items\` (
    \`_order\` integer NOT NULL,
    \`_parent_id\` text NOT NULL,
    \`id\` text PRIMARY KEY NOT NULL,
    \`day\` text,
    \`time\` text,
    \`open\` integer DEFAULT 1,
    FOREIGN KEY (\`_parent_id\`) REFERENCES \`dental_sites_blocks_hours\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`dental_sites_blocks_hours_items_order_idx\` ON \`dental_sites_blocks_hours_items\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`dental_sites_blocks_hours_items_parent_id_idx\` ON \`dental_sites_blocks_hours_items\` (\`_parent_id\`);`)

  // ── VergoedingBlock ────────────────────────────────────────────────────────
  await db.run(sql`CREATE TABLE IF NOT EXISTS \`dental_sites_blocks_vergoeding\` (
    \`_order\` integer NOT NULL,
    \`_parent_id\` integer NOT NULL,
    \`_path\` text NOT NULL,
    \`id\` text PRIMARY KEY NOT NULL,
    \`eyebrow\` text,
    \`title\` text,
    \`intro\` text,
    \`cta\` text,
    \`block_name\` text,
    FOREIGN KEY (\`_parent_id\`) REFERENCES \`dental_sites\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`dental_sites_blocks_vergoeding_order_idx\` ON \`dental_sites_blocks_vergoeding\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`dental_sites_blocks_vergoeding_parent_id_idx\` ON \`dental_sites_blocks_vergoeding\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`dental_sites_blocks_vergoeding_path_idx\` ON \`dental_sites_blocks_vergoeding\` (\`_path\`);`)

  await db.run(sql`CREATE TABLE IF NOT EXISTS \`dental_sites_blocks_vergoeding_info_blocks\` (
    \`_order\` integer NOT NULL,
    \`_parent_id\` text NOT NULL,
    \`id\` text PRIMARY KEY NOT NULL,
    \`title\` text,
    \`text\` text,
    FOREIGN KEY (\`_parent_id\`) REFERENCES \`dental_sites_blocks_vergoeding\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`dental_sites_blocks_vergoeding_info_blocks_order_idx\` ON \`dental_sites_blocks_vergoeding_info_blocks\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`dental_sites_blocks_vergoeding_info_blocks_parent_id_idx\` ON \`dental_sites_blocks_vergoeding_info_blocks\` (\`_parent_id\`);`)

  await db.run(sql`CREATE TABLE IF NOT EXISTS \`dental_sites_blocks_vergoeding_insurers\` (
    \`_order\` integer NOT NULL,
    \`_parent_id\` text NOT NULL,
    \`id\` text PRIMARY KEY NOT NULL,
    \`name\` text,
    FOREIGN KEY (\`_parent_id\`) REFERENCES \`dental_sites_blocks_vergoeding\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`dental_sites_blocks_vergoeding_insurers_order_idx\` ON \`dental_sites_blocks_vergoeding_insurers\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`dental_sites_blocks_vergoeding_insurers_parent_id_idx\` ON \`dental_sites_blocks_vergoeding_insurers\` (\`_parent_id\`);`)

  // ── ContactBlock ───────────────────────────────────────────────────────────
  await db.run(sql`CREATE TABLE IF NOT EXISTS \`dental_sites_blocks_contact\` (
    \`_order\` integer NOT NULL,
    \`_parent_id\` integer NOT NULL,
    \`_path\` text NOT NULL,
    \`id\` text PRIMARY KEY NOT NULL,
    \`eyebrow\` text,
    \`title\` text,
    \`intro\` text,
    \`block_name\` text,
    FOREIGN KEY (\`_parent_id\`) REFERENCES \`dental_sites\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`dental_sites_blocks_contact_order_idx\` ON \`dental_sites_blocks_contact\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`dental_sites_blocks_contact_parent_id_idx\` ON \`dental_sites_blocks_contact\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`dental_sites_blocks_contact_path_idx\` ON \`dental_sites_blocks_contact\` (\`_path\`);`)

  // ── Drop old incorrectly-named tables (sections → blocks) ──────────────────
  await db.run(sql`DROP TABLE IF EXISTS \`dental_sites_sections_contact\`;`)
  await db.run(sql`DROP TABLE IF EXISTS \`dental_sites_sections_vergoeding_insurers\`;`)
  await db.run(sql`DROP TABLE IF EXISTS \`dental_sites_sections_vergoeding_info_blocks\`;`)
  await db.run(sql`DROP TABLE IF EXISTS \`dental_sites_sections_vergoeding\`;`)
  await db.run(sql`DROP TABLE IF EXISTS \`dental_sites_sections_hours_items\`;`)
  await db.run(sql`DROP TABLE IF EXISTS \`dental_sites_sections_hours\`;`)
  await db.run(sql`DROP TABLE IF EXISTS \`dental_sites_sections_reviews_items\`;`)
  await db.run(sql`DROP TABLE IF EXISTS \`dental_sites_sections_reviews\`;`)
  await db.run(sql`DROP TABLE IF EXISTS \`dental_sites_sections_team_members\`;`)
  await db.run(sql`DROP TABLE IF EXISTS \`dental_sites_sections_team\`;`)
  await db.run(sql`DROP TABLE IF EXISTS \`dental_sites_sections_services_items_bullets\`;`)
  await db.run(sql`DROP TABLE IF EXISTS \`dental_sites_sections_services_items\`;`)
  await db.run(sql`DROP TABLE IF EXISTS \`dental_sites_sections_services\`;`)
  await db.run(sql`DROP TABLE IF EXISTS \`dental_sites_sections_features_items\`;`)
  await db.run(sql`DROP TABLE IF EXISTS \`dental_sites_sections_features\`;`)
  await db.run(sql`DROP TABLE IF EXISTS \`dental_sites_sections_quote\`;`)
  await db.run(sql`DROP TABLE IF EXISTS \`dental_sites_sections_hero\`;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.run(sql`DROP TABLE IF EXISTS \`dental_sites_blocks_contact\`;`)
  await db.run(sql`DROP TABLE IF EXISTS \`dental_sites_blocks_vergoeding_insurers\`;`)
  await db.run(sql`DROP TABLE IF EXISTS \`dental_sites_blocks_vergoeding_info_blocks\`;`)
  await db.run(sql`DROP TABLE IF EXISTS \`dental_sites_blocks_vergoeding\`;`)
  await db.run(sql`DROP TABLE IF EXISTS \`dental_sites_blocks_hours_items\`;`)
  await db.run(sql`DROP TABLE IF EXISTS \`dental_sites_blocks_hours\`;`)
  await db.run(sql`DROP TABLE IF EXISTS \`dental_sites_blocks_reviews_items\`;`)
  await db.run(sql`DROP TABLE IF EXISTS \`dental_sites_blocks_reviews\`;`)
  await db.run(sql`DROP TABLE IF EXISTS \`dental_sites_blocks_team_members\`;`)
  await db.run(sql`DROP TABLE IF EXISTS \`dental_sites_blocks_team\`;`)
  await db.run(sql`DROP TABLE IF EXISTS \`dental_sites_blocks_services_items_bullets\`;`)
  await db.run(sql`DROP TABLE IF EXISTS \`dental_sites_blocks_services_items\`;`)
  await db.run(sql`DROP TABLE IF EXISTS \`dental_sites_blocks_services\`;`)
  await db.run(sql`DROP TABLE IF EXISTS \`dental_sites_blocks_features_items\`;`)
  await db.run(sql`DROP TABLE IF EXISTS \`dental_sites_blocks_features\`;`)
  await db.run(sql`DROP TABLE IF EXISTS \`dental_sites_blocks_quote\`;`)
  await db.run(sql`DROP TABLE IF EXISTS \`dental_sites_blocks_hero\`;`)
}
