import { defineConfig } from "tinacms";

export default defineConfig({
  branch: process.env.GITHUB_BRANCH || "main",
  clientId: process.env.TINA_CLIENT_ID || "",
  token: process.env.TINA_TOKEN || "",

  build: {
    outputFolder: "admin",
    publicFolder: "public",
  },

  media: {
    tina: {
      mediaRoot: "",
      publicFolder: "public",
    },
  },

  schema: {
    collections: [
      {
        name: "siteContent",
        label: "Website inhoud",
        path: "src/data",
        match: { include: "site" },
        format: "json",
        ui: {
          // site.json is a fixed document — clients cannot create or delete it
          allowedActions: { create: false, delete: false },
        },
        fields: [
          // ── meta (hidden — not editable in Phase 1) ─────────────────────
          {
            type: "object",
            name: "meta",
            label: "Meta",
            ui: { component: null },
            fields: [
              { type: "string", name: "title", label: "Paginatitel" },
              { type: "string", name: "description", label: "Meta beschrijving" },
            ],
          },

          // ── business (PHASE 1 — visible) ────────────────────────────────
          {
            type: "object",
            name: "business",
            label: "Bedrijfsinformatie",
            fields: [
              { type: "string", name: "name", label: "Praktijknaam" },
              { type: "string", name: "city", label: "Stad" },
              { type: "string", name: "address", label: "Adres" },
              { type: "string", name: "postal_code", label: "Postcode" },
              { type: "string", name: "phone", label: "Telefoonnummer" },
              { type: "string", name: "email", label: "E-mailadres" },
              {
                type: "string",
                name: "google_reviews_score",
                label: "Google beoordelingsscore",
              },
              {
                type: "number",
                name: "google_reviews_count",
                label: "Aantal Google beoordelingen",
              },
              {
                type: "string",
                name: "google_reviews_url",
                label: "Google beoordelingen URL",
              },
            ],
          },

          // ── hero (PHASE 1 — visible) ─────────────────────────────────────
          {
            type: "object",
            name: "hero",
            label: "Hero sectie",
            fields: [
              { type: "string", name: "eyebrow", label: "Boven kop" },
              { type: "string", name: "headline", label: "Hoofdtitel" },
              { type: "string", name: "description", label: "Beschrijving" },
              { type: "string", name: "cta_primary", label: "Primaire knoptekst" },
              { type: "string", name: "cta_secondary", label: "Secundaire knoptekst" },
              { type: "string", name: "image_url", label: "Afbeelding URL" },
            ],
          },

          // ── quote (hidden) ───────────────────────────────────────────────
          {
            type: "object",
            name: "quote",
            label: "Quote",
            ui: { component: null },
            fields: [
              { type: "string", name: "text", label: "Tekst" },
              { type: "string", name: "author_name", label: "Auteursnaam" },
              { type: "string", name: "author_role", label: "Auteursfunctie" },
            ],
          },

          // ── features (hidden) ────────────────────────────────────────────
          {
            type: "object",
            name: "features",
            label: "Features",
            ui: { component: null },
            fields: [
              { type: "string", name: "eyebrow", label: "Boven kop" },
              { type: "string", name: "title", label: "Titel" },
              { type: "string", name: "subtitle", label: "Subtitel" },
              { type: "string", name: "image_url", label: "Afbeelding URL" },
              {
                type: "object",
                name: "items",
                label: "Items",
                list: true,
                fields: [
                  { type: "string", name: "icon", label: "Icoon" },
                  { type: "string", name: "title", label: "Titel" },
                  { type: "string", name: "desc", label: "Beschrijving" },
                ],
              },
            ],
          },

          // ── services (hidden) ────────────────────────────────────────────
          {
            type: "object",
            name: "services",
            label: "Diensten",
            ui: { component: null },
            fields: [
              { type: "string", name: "eyebrow", label: "Boven kop" },
              { type: "string", name: "title", label: "Titel" },
              { type: "string", name: "subtitle", label: "Subtitel" },
              {
                type: "object",
                name: "items",
                label: "Diensten",
                list: true,
                fields: [
                  { type: "string", name: "tag", label: "Tag" },
                  { type: "string", name: "title", label: "Titel" },
                  { type: "string", name: "desc", label: "Beschrijving" },
                  { type: "string", name: "image_url", label: "Afbeelding URL" },
                  { type: "string", name: "items", label: "Lijst items", list: true },
                  { type: "string", name: "cta", label: "CTA tekst" },
                ],
              },
            ],
          },

          // ── team (hidden) ────────────────────────────────────────────────
          {
            type: "object",
            name: "team",
            label: "Team",
            ui: { component: null },
            fields: [
              { type: "string", name: "eyebrow", label: "Boven kop" },
              { type: "string", name: "title", label: "Titel" },
              { type: "string", name: "subtitle", label: "Subtitel" },
              {
                type: "object",
                name: "members",
                label: "Teamleden",
                list: true,
                fields: [
                  { type: "string", name: "name", label: "Naam" },
                  { type: "string", name: "role", label: "Rol" },
                  { type: "string", name: "bio", label: "Bio" },
                  { type: "string", name: "image_url", label: "Foto URL" },
                ],
              },
            ],
          },

          // ── reviews (hidden) ─────────────────────────────────────────────
          {
            type: "object",
            name: "reviews",
            label: "Beoordelingen",
            ui: { component: null },
            fields: [
              { type: "string", name: "title", label: "Titel" },
              { type: "string", name: "subtitle", label: "Subtitel" },
              {
                type: "object",
                name: "items",
                label: "Beoordelingen",
                list: true,
                fields: [
                  { type: "string", name: "name", label: "Naam" },
                  { type: "number", name: "stars", label: "Sterren" },
                  { type: "string", name: "date", label: "Datum" },
                  { type: "string", name: "text", label: "Tekst" },
                ],
              },
            ],
          },

          // ── hours (hidden) ───────────────────────────────────────────────
          {
            type: "object",
            name: "hours",
            label: "Openingstijden",
            ui: { component: null },
            fields: [
              {
                type: "object",
                name: "items",
                label: "Dagen",
                list: true,
                fields: [
                  { type: "string", name: "day", label: "Dag" },
                  { type: "string", name: "time", label: "Tijd" },
                  { type: "boolean", name: "open", label: "Open" },
                ],
              },
            ],
          },

          // ── vergoeding (hidden) ──────────────────────────────────────────
          {
            type: "object",
            name: "vergoeding",
            label: "Vergoeding",
            ui: { component: null },
            fields: [
              { type: "string", name: "eyebrow", label: "Boven kop" },
              { type: "string", name: "title", label: "Titel" },
              { type: "string", name: "intro", label: "Introductie" },
              {
                type: "object",
                name: "blocks",
                label: "Blokken",
                list: true,
                fields: [
                  { type: "string", name: "title", label: "Titel" },
                  { type: "string", name: "text", label: "Tekst" },
                ],
              },
              { type: "string", name: "insurers", label: "Verzekeraars", list: true },
              { type: "string", name: "cta", label: "CTA tekst" },
            ],
          },

          // ── contact (hidden) ─────────────────────────────────────────────
          {
            type: "object",
            name: "contact",
            label: "Contact",
            ui: { component: null },
            fields: [
              { type: "string", name: "eyebrow", label: "Boven kop" },
              { type: "string", name: "title", label: "Titel" },
              { type: "string", name: "intro", label: "Introductie" },
            ],
          },

          // ── footer (hidden) ──────────────────────────────────────────────
          {
            type: "object",
            name: "footer",
            label: "Footer",
            ui: { component: null },
            fields: [
              { type: "string", name: "tagline", label: "Tagline" },
            ],
          },
        ],
      },
    ],
  },
});
