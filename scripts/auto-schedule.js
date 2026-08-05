// MAU Site Audit — Monthly Auto-Scheduler
// Runs via GitHub Actions on the 1st of every month
// Picks 2 random sites, assigns 2 auditors each (OA + SA), saves to Supabase, sends emails

const { createClient } = require('@supabase/supabase-js');

const SITES = ["US1","US2","US5","US7","US8","US10","Prime","Tweel"];

const AUDITORS = [
  { name: "Brandon Waller",    email: "brandon.waller@mau.com" },
  { name: "Amanda Boger",      email: "amanda.boger@mau.com" },
  { name: "Ann Hays",          email: "ann.hays@mau.com" },
  { name: "Cierra Rodriguez",  email: "cierra.rodriguez@mau.com" },
  { name: "Danielle Thompson", email: "danielle.thompson@mau.com" },
  { name: "Ivan Page",         email: "ivan.page@mau.com" },
  { name: "Jeremy Patterson",  email: "jeremy.patterson@mau.com" },
  { name: "Joshua Truesdale",  email: "joshua.truesdale@mau.com" },
  { name: "Lei Goodman",       email: "lei.goodman@mau.com" },
  { name: "Rozelon Bell",      email: "rozelon.bell@mau.com" },
  { name: "Steven Johnson",    email: "steven.johnson@mau.com" },
  { name: "Terran Young",      email: "terran.young@mau.com" },
  { name: "Ty Wentworth",      email: "ty.wentworth@mau.com" }
];

const fmtDate = (d) => new Date(d + 'T12:00:00').toLocaleDateString('en-US', {
  weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
});

async function run() {
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

  // Target: next calendar month
  const now = new Date();
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const yr = nextMonth.getFullYear();
  const mo = nextMonth.getMonth();
  const daysInMonth = new Date(yr, mo + 1, 0).getDate();
  const monthLabel = nextMonth.toLocaleString('en-US', { month: 'long', year: 'numeric' });
  const monthPrefix = `${yr}-${String(mo + 1).padStart(2, '0')}`;

  console.log(`\n=== MAU Auto-Scheduler: ${monthLabel} ===\n`);

  // 1. Delete any existing schedules for next month
  const { data: existing } = await supabase.from('schedules').select('id, schedule_data');
  const toDelete = (existing || []).filter(r => r.schedule_data?.dueDate?.startsWith(monthPrefix));
  for (const s of toDelete) {
    await supabase.from('schedules').delete().eq('id', s.id);
    console.log(`Removed old schedule: ${s.schedule_data?.site} ${s.schedule_data?.type} on ${s.schedule_data?.dueDate}`);
  }

  // 2. Pick 2 random sites
  const shuffledSites = [...SITES].sort(() => Math.random() - 0.5).slice(0, 2);

  // 3. Pick 4 random auditors (2 per site — one OA, one SA — all different)
  const shuffledAuditors = [...AUDITORS].sort(() => Math.random() - 0.5);

  // 4. Pick a random weekday for each site
  const getRandomWeekday = () => {
    let day, attempts = 0;
    do {
      day = Math.floor(Math.random() * daysInMonth) + 1;
      const dow = new Date(yr, mo, day).getDay();
      if (dow !== 0 && dow !== 6) break;
    } while (++attempts < 30);
    return day;
  };

  // 5. Build schedule entries
  const newSchedules = shuffledSites.flatMap((site, i) => {
    const day = getRandomWeekday();
    const dueDate = `${yr}-${String(mo + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const auditorOA = shuffledAuditors[(i * 2) % shuffledAuditors.length];
    const auditorSA = shuffledAuditors[(i * 2 + 1) % shuffledAuditors.length];
    return [
      { type: 'OA', auditor: auditorOA },
      { type: 'SA', auditor: auditorSA }
    ].map(({ type, auditor }) => ({
      id: `auto-${Date.now()}-${i}-${type}`,
      site, type,
      assignedTo: auditor.name,
      auditorEmail: auditor.email,
      dueDate,
      frequency: 'monthly',
      notes: `Auto-generated — ${monthLabel}`,
      createdAt: Date.now()
    }));
  });

  // 6. Save to Supabase
  for (const s of newSchedules) {
    const { error } = await supabase.from('schedules').upsert({
      id: s.id,
      schedule_data: s,
      created_at: new Date(s.createdAt).toISOString(),
      site: s.site,
      audit_type: s.type,
      due_date: s.dueDate
    });
    if (error) {
      console.error(`Failed to save ${s.type} at ${s.site}:`, error.message);
    } else {
      console.log(`Scheduled: ${s.type} at ${s.site} on ${s.dueDate} — ${s.assignedTo}`);
    }
  }

  // 7. Send email notifications via Resend (optional — only if RESEND_API_KEY is set)
  if (process.env.RESEND_API_KEY) {
    const { Resend } = require('resend');
    const resend = new Resend(process.env.RESEND_API_KEY);

    for (const s of newSchedules) {
      const auditLabel = s.type === 'OA' ? 'Operations Audit (OA)' : 'Safety Audit (SA)';
      const subject = `MAU Site Audit Assignment – ${s.site} – ${fmtDate(s.dueDate)}`;
      const text = [
        `Hi ${s.assignedTo},`,
        ``,
        `You have been assigned to conduct a ${auditLabel} at ${s.site}.`,
        ``,
        `Audit Details:`,
        `  • Site: ${s.site}`,
        `  • Audit Type: ${auditLabel}`,
        `  • Scheduled Date: ${fmtDate(s.dueDate)}`,
        ``,
        `Please use the MAU Site Audit app to complete your audit on the assigned date.`,
        `Open the app, tap + ${s.type}, select ${s.site}, and submit your findings.`,
        ``,
        `If you have any questions, please reach out to your manager.`,
        ``,
        `Thank you,`,
        `MAU Workforce Solutions`
      ].join('\n');

      try {
        await resend.emails.send({
          from: 'MAU Audit <noreply@mau.com>',
          to: s.auditorEmail,
          subject,
          text
        });
        console.log(`Email sent to ${s.auditorEmail}`);
      } catch (e) {
        console.error(`Email failed for ${s.auditorEmail}:`, e.message);
      }
    }
  } else {
    console.log('\nNote: RESEND_API_KEY not set — skipping email notifications.');
  }

  console.log(`\nDone. ${newSchedules.length} audits scheduled for ${monthLabel}.`);
}

run().catch(err => {
  console.error('Scheduler failed:', err);
  process.exit(1);
});
