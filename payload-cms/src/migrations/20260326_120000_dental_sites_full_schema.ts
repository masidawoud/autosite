import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-d1-sqlite'

/**
 * Delta migration: extends dental_sites to the full dental practice content model.
 *
 * Adds scalar columns for all new groups (business, hero revamp, quote, features,
 * services header, team, reviews, hours header, vergoeding, contact, footer, theme)
 * and creates 7 new array tables.
 *
 * The old dental_sites_services table (name + description) is replaced by
 * dental_sites_services_items (tag, title, desc, image_url, bullets_json, cta).
 */
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  // ── 1. ADD scalar columns to dental_sites ───────────────────────────────────

  // business group
  await db.run(sql`ALTER TABLE \`dental_sites\` ADD COLUMN \`business_city\` text;`)
  await db.run(sql`ALTER TABLE \`dental_sites\` ADD COLUMN \`business_address\` text;`)
  await db.run(sql`ALTER TABLE \`dental_sites\` ADD COLUMN \`business_postal_code\` text;`)
  await db.run(sql`ALTER TABLE \`dental_sites\` ADD COLUMN \`business_google_reviews_score\` text;`)
  await db.run(sql`ALTER TABLE \`dental_sites\` ADD COLUMN \`business_google_reviews_count\` integer;`)
  await db.run(sql`ALTER TABLE \`dental_sites\` ADD COLUMN \`business_google_reviews_url\` text;`)

  // hero group (new fields — old hero_headline_light, hero_headline_heavy, hero_subtext, hero_cta kept for compat)
  await db.run(sql`ALTER TABLE \`dental_sites\` ADD COLUMN \`hero_eyebrow\` text;`)
  await db.run(sql`ALTER TABLE \`dental_sites\` ADD COLUMN \`hero_headline\` text;`)
  await db.run(sql`ALTER TABLE \`dental_sites\` ADD COLUMN \`hero_description\` text;`)
  await db.run(sql`ALTER TABLE \`dental_sites\` ADD COLUMN \`hero_cta_primary\` text DEFAULT 'Maak een afspraak';`)
  await db.run(sql`ALTER TABLE \`dental_sites\` ADD COLUMN \`hero_cta_secondary\` text DEFAULT 'Bel ons';`)
  await db.run(sql`ALTER TABLE \`dental_sites\` ADD COLUMN \`hero_image_url\` text;`)

  // quote group
  await db.run(sql`ALTER TABLE \`dental_sites\` ADD COLUMN \`quote_text\` text;`)
  await db.run(sql`ALTER TABLE \`dental_sites\` ADD COLUMN \`quote_author_name\` text;`)
  await db.run(sql`ALTER TABLE \`dental_sites\` ADD COLUMN \`quote_author_role\` text;`)

  // features group (scalar fields; items live in dental_sites_features_items)
  await db.run(sql`ALTER TABLE \`dental_sites\` ADD COLUMN \`features_eyebrow\` text;`)
  await db.run(sql`ALTER TABLE \`dental_sites\` ADD COLUMN \`features_title\` text;`)
  await db.run(sql`ALTER TABLE \`dental_sites\` ADD COLUMN \`features_subtitle\` text;`)
  await db.run(sql`ALTER TABLE \`dental_sites\` ADD COLUMN \`features_image_url\` text;`)

  // services group (scalar header fields; items live in dental_sites_services_items)
  await db.run(sql`ALTER TABLE \`dental_sites\` ADD COLUMN \`services_eyebrow\` text;`)
  await db.run(sql`ALTER TABLE \`dental_sites\` ADD COLUMN \`services_title\` text;`)
  await db.run(sql`ALTER TABLE \`dental_sites\` ADD COLUMN \`services_subtitle\` text;`)

  // team group (scalar header fields; members live in dental_sites_team_members)
  await db.run(sql`ALTER TABLE \`dental_sites\` ADD COLUMN \`team_eyebrow\` text;`)
  await db.run(sql`ALTER TABLE \`dental_sites\` ADD COLUMN \`team_title\` text;`)
  await db.run(sql`ALTER TABLE \`dental_sites\` ADD COLUMN \`team_subtitle\` text;`)

  // reviews group (scalar header fields; items live in dental_sites_reviews_items)
  await db.run(sql`ALTER TABLE \`dental_sites\` ADD COLUMN \`reviews_title\` text;`)
  await db.run(sql`ALTER TABLE \`dental_sites\` ADD COLUMN \`reviews_subtitle\` text;`)

  // vergoeding group (scalar fields; blocks + insurers have their own tables)
  await db.run(sql`ALTER TABLE \`dental_sites\` ADD COLUMN \`vergoeding_eyebrow\` text;`)
  await db.run(sql`ALTER TABLE \`dental_sites\` ADD COLUMN \`vergoeding_title\` text;`)
  await db.run(sql`ALTER TABLE \`dental_sites\` ADD COLUMN \`vergoeding_intro\` text;`)
  await db.run(sql`ALTER TABLE \`dental_sites\` ADD COLUMN \`vergoeding_cta\` text;`)

  // contact group (new fields — contact_phone, contact_email, contact_hours kept for compat)
  await db.run(sql`ALTER TABLE \`dental_sites\` ADD COLUMN \`contact_eyebrow\` text;`)
  await db.run(sql`ALTER TABLE \`dental_sites\` ADD COLUMN \`contact_title\` text;`)
  await db.run(sql`ALTER TABLE \`dental_sites\` ADD COLUMN \`contact_intro\` text;`)

  // footer group
  await db.run(sql`ALTER TABLE \`dental_sites\` ADD COLUMN \`footer_meta_title\` text;`)
  await db.run(sql`ALTER TABLE \`dental_sites\` ADD COLUMN \`footer_meta_description\` text;`)
  await db.run(sql`ALTER TABLE \`dental_sites\` ADD COLUMN \`footer_tagline\` text;`)

  // theme group
  await db.run(sql`ALTER TABLE \`dental_sites\` ADD COLUMN \`theme_style_preset\` text;`)
  await db.run(sql`ALTER TABLE \`dental_sites\` ADD COLUMN \`theme_accent_color\` text;`)
  await db.run(sql`ALTER TABLE \`dental_sites\` ADD COLUMN \`theme_accent_hover_color\` text;`)

  // ── 2. DROP old services array table ────────────────────────────────────────
  await db.run(sql`DROP TABLE IF EXISTS \`dental_sites_services\`;`)

  // ── 3. CREATE new array tables ───────────────────────────────────────────────

  // features > items
  await db.run(sql`CREATE TABLE \`dental_sites_features_items\` (
    \`_order\` integer NOT NULL,
    \`_parent_id\` integer NOT NULL,
    \`id\` text PRIMARY KEY NOT NULL,
    \`icon\` text,
    \`title\` text,
    \`desc\` text,
    FOREIGN KEY (\`_parent_id\`) REFERENCES \`dental_sites\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );`)
  await db.run(sql`CREATE INDEX \`dental_sites_features_items_order_idx\` ON \`dental_sites_features_items\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`dental_sites_features_items_parent_id_idx\` ON \`dental_sites_features_items\` (\`_parent_id\`);`)

  // services > items (bullets stored as JSON text)
  await db.run(sql`CREATE TABLE \`dental_sites_services_items\` (
    \`_order\` integer NOT NULL,
    \`_parent_id\` integer NOT NULL,
    \`id\` text PRIMARY KEY NOT NULL,
    \`tag\` text,
    \`title\` text,
    \`desc\` text,
    \`image_url\` text,
    \`bullets_json\` text,
    \`cta\` text,
    FOREIGN KEY (\`_parent_id\`) REFERENCES \`dental_sites\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );`)
  await db.run(sql`CREATE INDEX \`dental_sites_services_items_order_idx\` ON \`dental_sites_services_items\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`dental_sites_services_items_parent_id_idx\` ON \`dental_sites_services_items\` (\`_parent_id\`);`)

  // team > members
  await db.run(sql`CREATE TABLE \`dental_sites_team_members\` (
    \`_order\` integer NOT NULL,
    \`_parent_id\` integer NOT NULL,
    \`id\` text PRIMARY KEY NOT NULL,
    \`name\` text,
    \`role\` text,
    \`bio\` text,
    \`image_url\` text,
    FOREIGN KEY (\`_parent_id\`) REFERENCES \`dental_sites\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );`)
  await db.run(sql`CREATE INDEX \`dental_sites_team_members_order_idx\` ON \`dental_sites_team_members\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`dental_sites_team_members_parent_id_idx\` ON \`dental_sites_team_members\` (\`_parent_id\`);`)

  // reviews > items
  await db.run(sql`CREATE TABLE \`dental_sites_reviews_items\` (
    \`_order\` integer NOT NULL,
    \`_parent_id\` integer NOT NULL,
    \`id\` text PRIMARY KEY NOT NULL,
    \`name\` text,
    \`stars\` integer,
    \`date\` text,
    \`text\` text,
    FOREIGN KEY (\`_parent_id\`) REFERENCES \`dental_sites\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );`)
  await db.run(sql`CREATE INDEX \`dental_sites_reviews_items_order_idx\` ON \`dental_sites_reviews_items\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`dental_sites_reviews_items_parent_id_idx\` ON \`dental_sites_reviews_items\` (\`_parent_id\`);`)

  // hours > items
  await db.run(sql`CREATE TABLE \`dental_sites_hours_items\` (
    \`_order\` integer NOT NULL,
    \`_parent_id\` integer NOT NULL,
    \`id\` text PRIMARY KEY NOT NULL,
    \`day\` text,
    \`time\` text,
    \`open\` integer DEFAULT 1,
    FOREIGN KEY (\`_parent_id\`) REFERENCES \`dental_sites\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );`)
  await db.run(sql`CREATE INDEX \`dental_sites_hours_items_order_idx\` ON \`dental_sites_hours_items\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`dental_sites_hours_items_parent_id_idx\` ON \`dental_sites_hours_items\` (\`_parent_id\`);`)

  // vergoeding > blocks
  await db.run(sql`CREATE TABLE \`dental_sites_vergoeding_blocks\` (
    \`_order\` integer NOT NULL,
    \`_parent_id\` integer NOT NULL,
    \`id\` text PRIMARY KEY NOT NULL,
    \`title\` text,
    \`text\` text,
    FOREIGN KEY (\`_parent_id\`) REFERENCES \`dental_sites\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );`)
  await db.run(sql`CREATE INDEX \`dental_sites_vergoeding_blocks_order_idx\` ON \`dental_sites_vergoeding_blocks\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`dental_sites_vergoeding_blocks_parent_id_idx\` ON \`dental_sites_vergoeding_blocks\` (\`_parent_id\`);`)

  // vergoeding > insurers
  await db.run(sql`CREATE TABLE \`dental_sites_vergoeding_insurers\` (
    \`_order\` integer NOT NULL,
    \`_parent_id\` integer NOT NULL,
    \`id\` text PRIMARY KEY NOT NULL,
    \`name\` text,
    FOREIGN KEY (\`_parent_id\`) REFERENCES \`dental_sites\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );`)
  await db.run(sql`CREATE INDEX \`dental_sites_vergoeding_insurers_order_idx\` ON \`dental_sites_vergoeding_insurers\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`dental_sites_vergoeding_insurers_parent_id_idx\` ON \`dental_sites_vergoeding_insurers\` (\`_parent_id\`);`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  // Drop new array tables
  await db.run(sql`DROP TABLE IF EXISTS \`dental_sites_vergoeding_insurers\`;`)
  await db.run(sql`DROP TABLE IF EXISTS \`dental_sites_vergoeding_blocks\`;`)
  await db.run(sql`DROP TABLE IF EXISTS \`dental_sites_hours_items\`;`)
  await db.run(sql`DROP TABLE IF EXISTS \`dental_sites_reviews_items\`;`)
  await db.run(sql`DROP TABLE IF EXISTS \`dental_sites_team_members\`;`)
  await db.run(sql`DROP TABLE IF EXISTS \`dental_sites_services_items\`;`)
  await db.run(sql`DROP TABLE IF EXISTS \`dental_sites_features_items\`;`)

  // Restore old services array table
  await db.run(sql`CREATE TABLE \`dental_sites_services\` (
    \`_order\` integer NOT NULL,
    \`_parent_id\` integer NOT NULL,
    \`id\` text PRIMARY KEY NOT NULL,
    \`name\` text NOT NULL,
    \`description\` text,
    FOREIGN KEY (\`_parent_id\`) REFERENCES \`dental_sites\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );`)
  await db.run(sql`CREATE INDEX \`dental_sites_services_order_idx\` ON \`dental_sites_services\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`dental_sites_services_parent_id_idx\` ON \`dental_sites_services\` (\`_parent_id\`);`)

  // Note: SQLite does not support DROP COLUMN for all columns easily, but D1 (SQLite 3.37+) does.
  // Drop all newly added scalar columns
  await db.run(sql`ALTER TABLE \`dental_sites\` DROP COLUMN \`theme_accent_hover_color\`;`)
  await db.run(sql`ALTER TABLE \`dental_sites\` DROP COLUMN \`theme_accent_color\`;`)
  await db.run(sql`ALTER TABLE \`dental_sites\` DROP COLUMN \`theme_style_preset\`;`)
  await db.run(sql`ALTER TABLE \`dental_sites\` DROP COLUMN \`footer_tagline\`;`)
  await db.run(sql`ALTER TABLE \`dental_sites\` DROP COLUMN \`footer_meta_description\`;`)
  await db.run(sql`ALTER TABLE \`dental_sites\` DROP COLUMN \`footer_meta_title\`;`)
  await db.run(sql`ALTER TABLE \`dental_sites\` DROP COLUMN \`contact_intro\`;`)
  await db.run(sql`ALTER TABLE \`dental_sites\` DROP COLUMN \`contact_title\`;`)
  await db.run(sql`ALTER TABLE \`dental_sites\` DROP COLUMN \`contact_eyebrow\`;`)
  await db.run(sql`ALTER TABLE \`dental_sites\` DROP COLUMN \`vergoeding_cta\`;`)
  await db.run(sql`ALTER TABLE \`dental_sites\` DROP COLUMN \`vergoeding_intro\`;`)
  await db.run(sql`ALTER TABLE \`dental_sites\` DROP COLUMN \`vergoeding_title\`;`)
  await db.run(sql`ALTER TABLE \`dental_sites\` DROP COLUMN \`vergoeding_eyebrow\`;`)
  await db.run(sql`ALTER TABLE \`dental_sites\` DROP COLUMN \`reviews_subtitle\`;`)
  await db.run(sql`ALTER TABLE \`dental_sites\` DROP COLUMN \`reviews_title\`;`)
  await db.run(sql`ALTER TABLE \`dental_sites\` DROP COLUMN \`team_subtitle\`;`)
  await db.run(sql`ALTER TABLE \`dental_sites\` DROP COLUMN \`team_title\`;`)
  await db.run(sql`ALTER TABLE \`dental_sites\` DROP COLUMN \`team_eyebrow\`;`)
  await db.run(sql`ALTER TABLE \`dental_sites\` DROP COLUMN \`services_subtitle\`;`)
  await db.run(sql`ALTER TABLE \`dental_sites\` DROP COLUMN \`services_title\`;`)
  await db.run(sql`ALTER TABLE \`dental_sites\` DROP COLUMN \`services_eyebrow\`;`)
  await db.run(sql`ALTER TABLE \`dental_sites\` DROP COLUMN \`features_image_url\`;`)
  await db.run(sql`ALTER TABLE \`dental_sites\` DROP COLUMN \`features_subtitle\`;`)
  await db.run(sql`ALTER TABLE \`dental_sites\` DROP COLUMN \`features_title\`;`)
  await db.run(sql`ALTER TABLE \`dental_sites\` DROP COLUMN \`features_eyebrow\`;`)
  await db.run(sql`ALTER TABLE \`dental_sites\` DROP COLUMN \`quote_author_role\`;`)
  await db.run(sql`ALTER TABLE \`dental_sites\` DROP COLUMN \`quote_author_name\`;`)
  await db.run(sql`ALTER TABLE \`dental_sites\` DROP COLUMN \`quote_text\`;`)
  await db.run(sql`ALTER TABLE \`dental_sites\` DROP COLUMN \`hero_image_url\`;`)
  await db.run(sql`ALTER TABLE \`dental_sites\` DROP COLUMN \`hero_cta_secondary\`;`)
  await db.run(sql`ALTER TABLE \`dental_sites\` DROP COLUMN \`hero_cta_primary\`;`)
  await db.run(sql`ALTER TABLE \`dental_sites\` DROP COLUMN \`hero_description\`;`)
  await db.run(sql`ALTER TABLE \`dental_sites\` DROP COLUMN \`hero_headline\`;`)
  await db.run(sql`ALTER TABLE \`dental_sites\` DROP COLUMN \`hero_eyebrow\`;`)
  await db.run(sql`ALTER TABLE \`dental_sites\` DROP COLUMN \`business_google_reviews_url\`;`)
  await db.run(sql`ALTER TABLE \`dental_sites\` DROP COLUMN \`business_google_reviews_count\`;`)
  await db.run(sql`ALTER TABLE \`dental_sites\` DROP COLUMN \`business_google_reviews_score\`;`)
  await db.run(sql`ALTER TABLE \`dental_sites\` DROP COLUMN \`business_postal_code\`;`)
  await db.run(sql`ALTER TABLE \`dental_sites\` DROP COLUMN \`business_address\`;`)
  await db.run(sql`ALTER TABLE \`dental_sites\` DROP COLUMN \`business_city\`;`)
}
