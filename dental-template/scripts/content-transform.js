/**
 * Pure transform functions — no I/O, no side effects, fully testable.
 */

/**
 * Merges Directus site_config business fields into the base site.json.
 * All other sections (hero, services, team, etc.) are preserved unchanged.
 */
export function applyBusinessFields(siteJson, config) {
  return {
    ...siteJson,
    business: {
      ...siteJson.business,
      name:        config.business_name,
      phone:       config.phone,
      email:       config.email,
      address:     config.address,
      city:        config.city,
      postal_code: config.postal_code,
    },
  }
}

/**
 * Reconstructs theme.json from a site_config + a map of preset JSON objects.
 * @param {object} config - Directus site_config record
 * @param {object} presets - Map of preset name → preset JSON (e.g. { 'warm-editorial': {...} })
 */
export function reconstructTheme(config, presets) {
  const preset = presets[config.theme_preset]
  if (!preset) throw new Error(`Unknown theme preset: ${config.theme_preset}`)

  return {
    ...preset,
    colors: {
      ...preset.colors,
      accent:       config.theme_accent_1,
      accent_hover: config.theme_accent_2,
      accent_light: lightenHex(config.theme_accent_1, 0.85),
    },
  }
}

/**
 * Lightens a hex color by mixing it toward white.
 * amount=0.85 means 85% toward white.
 */
export function lightenHex(hex, amount) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  const lr = Math.round(r + (255 - r) * amount)
  const lg = Math.round(g + (255 - g) * amount)
  const lb = Math.round(b + (255 - b) * amount)
  return `#${lr.toString(16).padStart(2, '0')}${lg.toString(16).padStart(2, '0')}${lb.toString(16).padStart(2, '0')}`
}
