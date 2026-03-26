import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-d1-sqlite'

/**
 * Delta migration: transforms the old template schema (users + media)
 * into the AutoSite schema (tenants, users+role, dental_sites, multi-tenant).
 *
 * The previous migration (20250929_111647) already ran and created:
 *   users, users_sessions, media, payload_locked_documents,
 *   payload_locked_documents_rels, payload_preferences,
 *   payload_preferences_rels, payload_migrations
 * It also partially created `tenants` (from a previous interrupted attempt).
 */
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  // ── 1. Add `role` column to users ─────────────────────────────────────────
  await db.run(sql`ALTER TABLE \`users\` ADD COLUMN \`role\` text NOT NULL DEFAULT 'user';`)

  // ── 2. Add tenant column to payload_locked_documents_rels ─────────────────
  //    (SQLite doesn't support ADD COLUMN with FK in older versions, so use
  //     a simple column add — the FK is advisory for Payload, not enforced here)
  await db.run(sql`ALTER TABLE \`payload_locked_documents_rels\` ADD COLUMN \`tenants_id\` integer REFERENCES \`tenants\`(\`id\`) ON DELETE cascade;`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_tenants_id_idx\` ON \`payload_locked_documents_rels\` (\`tenants_id\`);`)
  await db.run(sql`ALTER TABLE \`payload_locked_documents_rels\` ADD COLUMN \`dental_sites_id\` integer;`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_dental_sites_id_idx\` ON \`payload_locked_documents_rels\` (\`dental_sites_id\`);`)

  // ── 3. Create users_tenants (multi-tenant array) ──────────────────────────
  await db.run(sql`CREATE TABLE \`users_tenants\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`tenant_id\` integer,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`tenant_id\`) REFERENCES \`tenants\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE INDEX \`users_tenants_order_idx\` ON \`users_tenants\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`users_tenants_parent_id_idx\` ON \`users_tenants\` (\`_parent_id\`);`)

  // ── 4. Create dental_sites_services (array table) ─────────────────────────
  await db.run(sql`CREATE TABLE \`dental_sites_services\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`name\` text NOT NULL,
  	\`description\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`dental_sites\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`dental_sites_services_order_idx\` ON \`dental_sites_services\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`dental_sites_services_parent_id_idx\` ON \`dental_sites_services\` (\`_parent_id\`);`)

  // ── 5. Create dental_sites ────────────────────────────────────────────────
  await db.run(sql`CREATE TABLE \`dental_sites\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`practice_name\` text NOT NULL,
  	\`hero_headline_light\` text,
  	\`hero_headline_heavy\` text,
  	\`hero_subtext\` text,
  	\`hero_cta\` text DEFAULT 'Maak een afspraak',
  	\`contact_phone\` text,
  	\`contact_email\` text,
  	\`contact_hours\` text,
  	\`tenant_id\` integer,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	FOREIGN KEY (\`tenant_id\`) REFERENCES \`tenants\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE INDEX \`dental_sites_updated_at_idx\` ON \`dental_sites\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`dental_sites_created_at_idx\` ON \`dental_sites\` (\`created_at\`);`)
  await db.run(sql`CREATE INDEX \`dental_sites_tenant_idx\` ON \`dental_sites\` (\`tenant_id\`);`)

  // ── 6. Create payload_kv (session/token storage) ─────────────────────────
  await db.run(sql`CREATE TABLE \`payload_kv\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`key\` text NOT NULL,
  	\`value\` text NOT NULL,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`payload_kv_key_idx\` ON \`payload_kv\` (\`key\`);`)
  await db.run(sql`CREATE INDEX \`payload_kv_updated_at_idx\` ON \`payload_kv\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`payload_kv_created_at_idx\` ON \`payload_kv\` (\`created_at\`);`)

  // ── 7. Drop media (not used in AutoSite) ─────────────────────────────────
  await db.run(sql`DROP TABLE IF EXISTS \`media\`;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  // Reverse the delta (restore media, drop new tables/columns)
  await db.run(sql`CREATE TABLE \`media\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`alt\` text NOT NULL,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`url\` text,
  	\`thumbnail_u_r_l\` text,
  	\`filename\` text,
  	\`mime_type\` text,
  	\`filesize\` numeric,
  	\`width\` numeric,
  	\`height\` numeric
  );
  `)
  await db.run(sql`DROP TABLE IF EXISTS \`payload_kv\`;`)
  await db.run(sql`DROP TABLE IF EXISTS \`dental_sites_services\`;`)
  await db.run(sql`DROP TABLE IF EXISTS \`dental_sites\`;`)
  await db.run(sql`DROP TABLE IF EXISTS \`users_tenants\`;`)
  // Note: SQLite does not support DROP COLUMN directly in older versions,
  // but Cloudflare D1 (SQLite 3.37+) does.
  await db.run(sql`ALTER TABLE \`users\` DROP COLUMN \`role\`;`)
  await db.run(sql`ALTER TABLE \`payload_locked_documents_rels\` DROP COLUMN \`tenants_id\`;`)
  await db.run(sql`ALTER TABLE \`payload_locked_documents_rels\` DROP COLUMN \`dental_sites_id\`;`)
}
