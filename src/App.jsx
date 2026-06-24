import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

const AUDIT_KEY = 'mau-audits-cache'
const SCHED_KEY = 'mau-schedules-cache'

export const loadAudits = async () => {
  try {
    const { data, error } = await supabase.from('audits').select('audit_data').order('submitted_at', { ascending: false })
    if (error) throw error
    const audits = data.map(r => r.audit_data)
    localStorage.setItem(AUDIT_KEY, JSON.stringify(audits))
    return audits
  } catch (e) {
    console.warn('Supabase unavailable, using local cache:', e.message)
    try { return JSON.parse(localStorage.getItem(AUDIT_KEY) || '[]') } catch { return [] }
  }
}

export const saveAudit = async (audit) => {
  try {
    const cached = JSON.parse(localStorage.getItem(AUDIT_KEY) || '[]')
    localStorage.setItem(AUDIT_KEY, JSON.stringify([...cached.filter(a => a.id !== audit.id), audit]))
  } catch { }
  try {
    const { error } = await supabase.from('audits').upsert({
      id: audit.id, audit_data: audit,
      submitted_at: new Date(audit.submittedAt).toISOString(),
      site: audit.site, audit_type: audit.type, auditor_name: audit.auditorName,
      score_pct: (() => {
        let t = 0, m = 0
        audit.sections.forEach(s => s.items.forEach(i => { if (i.score !== null && i.score !== undefined) { t += i.score; m += 3 } }))
        return m > 0 ? Math.round((t / m) * 100) : 0
      })()
    })
    if (error) throw error
  } catch (e) { console.warn('Supabase sync failed:', e.message) }
}

export const loadSchedules = async () => {
  try {
    const { data, error } = await supabase.from('schedules').select('schedule_data').order('created_at', { ascending: false })
    if (error) throw error
    const schedules = data.map(r => r.schedule_data)
    localStorage.setItem(SCHED_KEY, JSON.stringify(schedules))
    return schedules
  } catch (e) {
    console.warn('Supabase unavailable for schedules:', e.message)
    try { return JSON.parse(localStorage.getItem(SCHED_KEY) || '[]') } catch { return [] }
  }
}

export const saveSchedule = async (schedule) => {
  try {
    const cached = JSON.parse(localStorage.getItem(SCHED_KEY) || '[]')
    localStorage.setItem(SCHED_KEY, JSON.stringify([...cached.filter(s => s.id !== schedule.id), schedule]))
  } catch { }
  try {
    const { error } = await supabase.from('schedules').upsert({
      id: schedule.id, schedule_data: schedule,
      created_at: new Date(schedule.createdAt).toISOString(),
      site: schedule.site, audit_type: schedule.type, due_date: schedule.dueDate
    })
    if (error) throw error
  } catch (e) { console.warn('Schedule sync failed:', e.message) }
}

export const deleteSchedule = async (id) => {
  try {
    const cached = JSON.parse(localStorage.getItem(SCHED_KEY) || '[]')
    localStorage.setItem(SCHED_KEY, JSON.stringify(cached.filter(s => s.id !== id)))
  } catch { }
  try {
    const { error } = await supabase.from('schedules').delete().eq('id', id)
    if (error) throw error
  } catch (e) { console.warn('Schedule delete failed:', e.message) }
}

