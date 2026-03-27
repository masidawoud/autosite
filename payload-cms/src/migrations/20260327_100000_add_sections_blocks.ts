import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-d1-sqlite'

/**
 * Delta migration: adds blocks tables for the `sections` blocks field on DentalSites.
 *
 * One table per block type, plus nested array sub-tables:
 *   dental_sites_sections_hero
 *   dental_sites_sections_quote
 *   dental_sites_sections_features
 *   dental_sites_sections_features_items
 *   dental_sites_sections_services
 *   dental_sites_sections_services_items
 *   dental_sites_sections_services_items_bullets
 *   dental_sites_sections_team
 *   dental_sites_sections_team_members
 *   dental_sites_sections_reviews
 *   dental_sites_sections_reviews_items
 *   dental_sites_sections_hours
 *   dental_sites_sections_hours_items
 *   dental_sites_sections_vergoeding
 *   dental_sites_sections_vergoeding_info_blocks
 *   dental_sites_sections_vergoeding_insurers
 *   dental_sites_sections_contact
 */
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {

  // ── HeroBlock ──────────────────────────────────────────────────────────────
  await db.run(sql`CREATE TABLE IF NOT EXISTS \`dental_sites_sections_hero\` (
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
    FOREIGN KEY (\`_parent_id\`) REFERENCES \`dental_sites\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`dental_sites_sections_hero_order_idx\` ON \`dental_sites_sections_hero\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`dental_sites_sections_hero_parent_id_idx\` ON \`dental_sites_sections_hero\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`dental_sites_sections_hero_path_idx\` ON \`dental_sites_sections_hero\` (\`_path\`);`)

  // ── QuoteBlock ─────────────────────────────────────────────────────────────
  await db.run(sql`CREATE TABLE IF NOT EXISTS \`dental_sites_sections_quote\` (
    \`_order\` integer NOT NULL,
    \`_parent_id\` integer NOT NULL,
    \`_path\` text NOT NULL,
    \`id\` text PRIMARY KEY NOT NULL,
    \`text\` text,
    \`author_name\` text,
    \`author_role\` text,
    FOREIGN KEY (\`_parent_id\`) REFERENCES \`dental_sites\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`dental_sites_sections_quote_order_idx\` ON \`dental_sites_sections_quote\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`dental_sites_sections_quote_parent_id_idx\` ON \`dental_sites_sections_quote\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`dental_sites_sections_quote_path_idx\` ON \`dental_sites_sections_quote\` (\`_path\`);`)

  // ── FeaturesBlock ──────────────────────────────────────────────────────────
  await db.run(sql`CREATE TABLE IF NOT EXISTS \`dental_sites_sections_features\` (
    \`_order\` integer NOT NULL,
    \`_parent_id\` integer NOT NULL,
    \`_path\` text NOT NULL,
    \`id\` text PRIMARY KEY NOT NULL,
    \`eyebrow\` text,
    \`title\` text,
    \`subtitle\` text,
    \`image_url\` text,
    FOREIGN KEY (\`_parent_id\`) REFERENCES \`dental_sites\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`dental_sites_sections_features_order_idx\` ON \`dental_sites_sections_features\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`dental_sites_sections_features_parent_id_idx\` ON \`dental_sites_sections_features\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`dental_sites_sections_features_path_idx\` ON \`dental_sites_sections_features\` (\`_path\`);`)

  await db.run(sql`CREATE TABLE IF NOT EXISTS \`dental_sites_sections_features_items\` (
    \`_order\` integer NOT NULL,
    \`_parent_id\` text NOT NULL,
    \`id\` text PRIMARY KEY NOT NULL,
    \`icon\` text,
    \`title\` text,
    \`desc\` text,
    FOREIGN KEY (\`_parent_id\`) REFERENCES \`dental_sites_sections_features\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`dental_sites_sections_features_items_order_idx\` ON \`dental_sites_sections_features_items\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`dental_sites_sections_features_items_parent_id_idx\` ON \`dental_sites_sections_features_items\` (\`_parent_id\`);`)

  // ── ServicesBlock ──────────────────────────────────────────────────────────
  await db.run(sql`CREATE TABLE IF NOT EXISTS \`dental_sites_sections_services\` (
    \`_order\` integer NOT NULL,
    \`_parent_id\` integer NOT NULL,
    \`_path\` text NOT NULL,
    \`id\` text PRIMARY KEY NOT NULL,
    \`eyebrow\` text,
    \`title\` text,
    \`subtitle\` text,
    FOREIGN KEY (\`_parent_id\`) REFERENCES \`dental_sites\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`dental_sites_sections_services_order_idx\` ON \`dental_sites_sections_services\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`dental_sites_sections_services_parent_id_idx\` ON \`dental_sites_sections_services\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`dental_sites_sections_services_path_idx\` ON \`dental_sites_sections_services\` (\`_path\`);`)

  await db.run(sql`CREATE TABLE IF NOT EXISTS \`dental_sites_sections_services_items\` (
    \`_order\` integer NOT NULL,
    \`_parent_id\` text NOT NULL,
    \`id\` text PRIMARY KEY NOT NULL,
    \`tag\` text,
    \`title\` text,
    \`desc\` text,
    \`image_url\` text,
    \`cta\` text,
    FOREIGN KEY (\`_parent_id\`) REFERENCES \`dental_sites_sections_services\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`dental_sites_sections_services_items_order_idx\` ON \`dental_sites_sections_services_items\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`dental_sites_sections_services_items_parent_id_idx\` ON \`dental_sites_sections_services_items\` (\`_parent_id\`);`)

  await db.run(sql`CREATE TABLE IF NOT EXISTS \`dental_sites_sections_services_items_bullets\` (
    \`_order\` integer NOT NULL,
    \`_parent_id\` text NOT NULL,
    \`id\` text PRIMARY KEY NOT NULL,
    \`text\` text,
    FOREIGN KEY (\`_parent_id\`) REFERENCES \`dental_sites_sections_services_items\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`dental_sites_sections_services_items_bullets_order_idx\` ON \`dental_sites_sections_services_items_bullets\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`dental_sites_sections_services_items_bullets_parent_id_idx\` ON \`dental_sites_sections_services_items_bullets\` (\`_parent_id\`);`)

  // ── TeamBlock ──────────────────────────────────────────────────────────────
  await db.run(sql`CREATE TABLE IF NOT EXISTS \`dental_sites_sections_team\` (
    \`_order\` integer NOT NULL,
    \`_parent_id\` integer NOT NULL,
    \`_path\` text NOT NULL,
    \`id\` text PRIMARY KEY NOT NULL,
    \`eyebrow\` text,
    \`title\` text,
    \`subtitle\` text,
    FOREIGN KEY (\`_parent_id\`) REFERENCES \`dental_sites\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`dental_sites_sections_team_order_idx\` ON \`dental_sites_sections_team\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`dental_sites_sections_team_parent_id_idx\` ON \`dental_sites_sections_team\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`dental_sites_sections_team_path_idx\` ON \`dental_sites_sections_team\` (\`_path\`);`)

  await db.run(sql`CREATE TABLE IF NOT EXISTS \`dental_sites_sections_team_members\` (
    \`_order\` integer NOT NULL,
    \`_parent_id\` text NOT NULL,
    \`id\` text PRIMARY KEY NOT NULL,
    \`name\` text,
    \`role\` text,
    \`bio\` text,
    \`image_url\` text,
    FOREIGN KEY (\`_parent_id\`) REFERENCES \`dental_sites_sections_team\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`dental_sites_sections_team_members_order_idx\` ON \`dental_sites_sections_team_members\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`dental_sites_sections_team_members_parent_id_idx\` ON \`dental_sites_sections_team_members\` (\`_parent_id\`);`)

  // ── ReviewsBlock ───────────────────────────────────────────────────────────
  await db.run(sql`CREATE TABLE IF NOT EXISTS \`dental_sites_sections_reviews\` (
    \`_order\` integer NOT NULL,
    \`_parent_id\` integer NOT NULL,
    \`_path\` text NOT NULL,
    \`id\` text PRIMARY KEY NOT NULL,
    \`title\` text,
    \`subtitle\` text,
    FOREIGN KEY (\`_parent_id\`) REFERENCES \`dental_sites\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`dental_sites_sections_reviews_order_idx\` ON \`dental_sites_sections_reviews\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`dental_sites_sections_reviews_parent_id_idx\` ON \`dental_sites_sections_reviews\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`dental_sites_sections_reviews_path_idx\` ON \`dental_sites_sections_reviews\` (\`_path\`);`)

  await db.run(sql`CREATE TABLE IF NOT EXISTS \`dental_sites_sections_reviews_items\` (
    \`_order\` integer NOT NULL,
    \`_parent_id\` text NOT NULL,
    \`id\` text PRIMARY KEY NOT NULL,
    \`name\` text,
    \`stars\` integer,
    \`date\` text,
    \`text\` text,
    FOREIGN KEY (\`_parent_id\`) REFERENCES \`dental_sites_sections_reviews\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`dental_sites_sections_reviews_items_order_idx\` ON \`dental_sites_sections_reviews_items\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`dental_sites_sections_reviews_items_parent_id_idx\` ON \`dental_sites_sections_reviews_items\` (\`_parent_id\`);`)

  // ── HoursBlock ─────────────────────────────────────────────────────────────
  await db.run(sql`CREATE TABLE IF NOT EXISTS \`dental_sites_sections_hours\` (
    \`_order\` integer NOT NULL,
    \`_parent_id\` integer NOT NULL,
    \`_path\` text NOT NULL,
    \`id\` text PRIMARY KEY NOT NULL,
    FOREIGN KEY (\`_parent_id\`) REFERENCES \`dental_sites\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`dental_sites_sections_hours_order_idx\` ON \`dental_sites_sections_hours\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`dental_sites_sections_hours_parent_id_idx\` ON \`dental_sites_sections_hours\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`dental_sites_sections_hours_path_idx\` ON \`dental_sites_sections_hours\` (\`_path\`);`)

  await db.run(sql`CREATE TABLE IF NOT EXISTS \`dental_sites_sections_hours_items\` (
    \`_order\` integer NOT NULL,
    \`_parent_id\` text NOT NULL,
    \`id\` text PRIMARY KEY NOT NULL,
    \`day\` text,
    \`time\` text,
    \`open\` integer DEFAULT 1,
    FOREIGN KEY (\`_parent_id\`) REFERENCES \`dental_sites_sections_hours\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`dental_sites_sections_hours_items_order_idx\` ON \`dental_sites_sections_hours_items\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`dental_sites_sections_hours_items_parent_id_idx\` ON \`dental_sites_sections_hours_items\` (\`_parent_id\`);`)

  // ── VergoedingBlock ────────────────────────────────────────────────────────
  await db.run(sql`CREATE TABLE IF NOT EXISTS \`dental_sites_sections_vergoeding\` (
    \`_order\` integer NOT NULL,
    \`_parent_id\` integer NOT NULL,
    \`_path\` text NOT NULL,
    \`id\` text PRIMARY KEY NOT NULL,
    \`eyebrow\` text,
    \`title\` text,
    \`intro\` text,
    \`cta\` text,
    FOREIGN KEY (\`_parent_id\`) REFERENCES \`dental_sites\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`dental_sites_sections_vergoeding_order_idx\` ON \`dental_sites_sections_vergoeding\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`dental_sites_sections_vergoeding_parent_id_idx\` ON \`dental_sites_sections_vergoeding\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`dental_sites_sections_vergoeding_path_idx\` ON \`dental_sites_sections_vergoeding\` (\`_path\`);`)

  await db.run(sql`CREATE TABLE IF NOT EXISTS \`dental_sites_sections_vergoeding_info_blocks\` (
    \`_order\` integer NOT NULL,
    \`_parent_id\` text NOT NULL,
    \`id\` text PRIMARY KEY NOT NULL,
    \`title\` text,
    \`text\` text,
    FOREIGN KEY (\`_parent_id\`) REFERENCES \`dental_sites_sections_vergoeding\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`dental_sites_sections_vergoeding_info_blocks_order_idx\` ON \`dental_sites_sections_vergoeding_info_blocks\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`dental_sites_sections_vergoeding_info_blocks_parent_id_idx\` ON \`dental_sites_sections_vergoeding_info_blocks\` (\`_parent_id\`);`)

  await db.run(sql`CREATE TABLE IF NOT EXISTS \`dental_sites_sections_vergoeding_insurers\` (
    \`_order\` integer NOT NULL,
    \`_parent_id\` text NOT NULL,
    \`id\` text PRIMARY KEY NOT NULL,
    \`name\` text,
    FOREIGN KEY (\`_parent_id\`) REFERENCES \`dental_sites_sections_vergoeding\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`dental_sites_sections_vergoeding_insurers_order_idx\` ON \`dental_sites_sections_vergoeding_insurers\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`dental_sites_sections_vergoeding_insurers_parent_id_idx\` ON \`dental_sites_sections_vergoeding_insurers\` (\`_parent_id\`);`)

  // ── ContactBlock ───────────────────────────────────────────────────────────
  await db.run(sql`CREATE TABLE IF NOT EXISTS \`dental_sites_sections_contact\` (
    \`_order\` integer NOT NULL,
    \`_parent_id\` integer NOT NULL,
    \`_path\` text NOT NULL,
    \`id\` text PRIMARY KEY NOT NULL,
    \`eyebrow\` text,
    \`title\` text,
    \`intro\` text,
    FOREIGN KEY (\`_parent_id\`) REFERENCES \`dental_sites\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`dental_sites_sections_contact_order_idx\` ON \`dental_sites_sections_contact\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`dental_sites_sections_contact_parent_id_idx\` ON \`dental_sites_sections_contact\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`dental_sites_sections_contact_path_idx\` ON \`dental_sites_sections_contact\` (\`_path\`);`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
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
