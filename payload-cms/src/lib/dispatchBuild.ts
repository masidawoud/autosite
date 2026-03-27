const GITHUB_REPO = 'masidawoud/autosite'
const WORKFLOW_FILE = 'build-from-payload.yml'

export async function dispatchBuild(slug: string, cfPagesProject: string): Promise<void> {
  const token = process.env.GITHUB_TOKEN
  if (!token) {
    console.warn('[dispatchBuild] GITHUB_TOKEN is not set — skipping build dispatch')
    return
  }

  const url = `https://api.github.com/repos/${GITHUB_REPO}/actions/workflows/${WORKFLOW_FILE}/dispatches`
  const body = JSON.stringify({
    ref: 'master',
    inputs: { client_id: slug, cf_project_name: cfPagesProject },
  })

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'autosite-payload-cms',
      },
      body,
    })
    if (res.ok || res.status === 204) {
      console.log(`[dispatchBuild] Build dispatched for tenant="${slug}" cf_project="${cfPagesProject}"`)
    } else {
      const text = await res.text()
      console.error(`[dispatchBuild] GitHub dispatch failed — status=${res.status} body=${text}`)
    }
  } catch (err) {
    console.error('[dispatchBuild] fetch threw:', err)
  }
}

export async function dispatchBuildForDoc(doc: any, req: any): Promise<void> {
  try {
    let slug: string | undefined
    let cfPagesProject: string | undefined

    if (doc.tenant && typeof doc.tenant === 'object') {
      slug = doc.tenant.slug
      cfPagesProject = doc.tenant.cfPagesProject
    } else if (doc.tenant) {
      const tenant = await req.payload.findByID({
        collection: 'tenants',
        id: doc.tenant,
        overrideAccess: true,
      })
      slug = (tenant as any)?.slug
      cfPagesProject = (tenant as any)?.cfPagesProject
    }

    if (!slug || !cfPagesProject) {
      console.warn('[dispatchBuild] tenant slug or cfPagesProject missing — skipping', {
        docId: doc.id,
        tenant: doc.tenant,
      })
      return
    }

    await dispatchBuild(slug, cfPagesProject)
  } catch (err) {
    console.error('[dispatchBuild] dispatchBuildForDoc error:', err)
  }
}
