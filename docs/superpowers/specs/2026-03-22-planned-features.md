## Planned feature — prospect site analysis

Before generating `site.json`, scrape the prospect's existing website and have an LLM extract its current structure. Feed that analysis into the content generation prompt so the new site mirrors the prospect's existing information architecture while improving design and copy.

**What this requires:**

1. Add `existing_url` column to `prospects.csv`
2. New pipeline step `scrapeProspectSite(url)` — fetch HTML, strip boilerplate, extract readable text (use a headless browser like Playwright for JS-heavy sites, or plain `fetch` + cheerio for simple ones)
3. New step `analyseStructure(client, rawHtml)` — LLM call that returns a structured summary:
   - Which sections exist (hero, about, services list, team, contact, etc.)
   - Key copy snippets (headline, tagline, USPs)
   - Services offered
   - Team members mentioned
4. Inject this analysis into the existing `buildPrompt()` alongside the CSV data — the LLM then generates copy that's informed by the real site rather than just the scraped_text field

**Key prompt instruction to add:**
> "The prospect's current site has the following structure and content. Use this as a reference to ensure we capture everything relevant, but rewrite all copy to be more engaging, modern and patient-focused."

**Feasibility:** Straightforward addition to the pipeline. Cheerio handles most static dental sites. Playwright needed only if the site is React/JS-rendered. The main cost is an extra LLM call per prospect for the analysis step.
