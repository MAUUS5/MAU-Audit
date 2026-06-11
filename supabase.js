import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

const LOCAL_KEY = 'mau-audits-cache'

// Load all audits — tries Supabase first, falls back to localStorage cache
export const loadAudits = async () => {
  try {
    const { data, error } = await supabase
      .from('audits')
      .select('audit_data')
      .order('submitted_at', { ascending: false })
    if (error) throw error
    const audits = data.map(row => row.audit_data)
    localStorage.setItem(LOCAL_KEY, JSON.stringify(audits))
    return audits
  } catch (e) {
    console.warn('Supabase unavailable, using local cache:', e.message)
    try { return JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]') } catch { return [] }
  }
}

// Save a single audit (upsert by id)
export const saveAudit = async (audit) => {
  // Always write to local cache immediately
  try {
    const cached = JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]')
    const updated = [...cached.filter(a => a.id !== audit.id), audit]
    localStorage.setItem(LOCAL_KEY, JSON.stringify(updated))
  } catch { /* ignore */ }

  // Then sync to Supabase
  try {
    const { error } = await supabase.from('audits').upsert({
      id: audit.id,
      audit_data: audit,
      submitted_at: new Date(audit.submittedAt).toISOString(),
      site: audit.site,
      audit_type: audit.type,
      auditor_name: audit.auditorName,
      score_pct: Math.round(
        audit.sections.reduce((tot, sec) =>
          tot + sec.items.reduce((s, i) => s + (i.score ?? 0), 0), 0) /
        Math.max(1, audit.sections.reduce((tot, sec) =>
          tot + sec.items.filter(i => i.score !== null && i.score !== undefined).length * 3, 0)) * 100
      )
    })
    if (error) throw error
  } catch (e) {
    console.warn('Could not sync to Supabase (will retry next load):', e.message)
  }
}
