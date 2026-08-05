import { useState, useEffect } from "react";
import { loadAudits, saveAudit, loadSchedules, saveSchedule, deleteSchedule } from "./supabase.js";

// ─────────────────────────── SCORING SCALE (1–4) ───────────────────────────

const SCORES = [
  { val: 4, label: "Exceeds Standard",  color: "#16A34A", bg: "#DCFCE7", text: "#14532D" },
  { val: 3, label: "Great",             color: "#0369A1", bg: "#DBEAFE", text: "#1E3A5F" },
  { val: 2, label: "Good",              color: "#D97706", bg: "#FEF3C7", text: "#78350F" },
  { val: 1, label: "Needs Improvement", color: "#DC2626", bg: "#FEE2E2", text: "#7F1D1D" }
];

// Detailed scoring criteria per item (shown during scoring)
const CRITERIA = {
  "Property Damages/Impacts": { 4:"None in the past 6 months.", 3:"Isolated incidents with full 4SPS follow-up and preventive actions implemented.", 2:"Occasional incidents with follow-up completed; prevention measures partially effective.", 1:"Repeated incidents & no 4SPS follow up." },
  "Injuries/First Aid/Near Miss": { 4:"None in past 6 months.", 3:"Minor injuries only; all fully investigated with corrective actions in place.", 2:"Some injuries occurring; trends monitored and actions initiated.", 1:"Multiple or serious injuries without proper investigation or prevention." },
  "PPE & ICI": { 4:"100% PPE compliance observed across all shifts/areas.", 3:"High compliance; any deviations immediately corrected and documented.", 2:"Generally compliant; occasional lapses noted and corrected promptly.", 1:"Employees observed not wearing PPE." },
  "SSE Programs": { 4:"All SSE programs active, tracked, and delivering measurable safety improvements.", 3:"SSE programs well utilized with regular participation and timely closure of actions.", 2:"SSE programs exist but participation low and action closure inconsistent.", 1:"SSE programs inactive or no documented participation and follow-up." },
  "SOPs Available & Utilized": { 4:"All SOPs current, accessible, and consistently followed by all team members.", 3:"SOPs available and up-to-date; utilization gaps identified and corrected quickly.", 2:"Most SOPs available but some outdated or inconsistently utilized.", 1:"Required SOPs missing, outdated, or not being followed." },
  "Housekeeping": { 4:"All items have a place and are in their place.", 3:"Designated locations clearly marked; minor deviations corrected immediately.", 2:"Basic organization present but some areas show clutter or misplaced items.", 1:"Nothing has a defined location." },
  "Quality Incident": { 4:"Zero quality incidents or escapes to customer.", 3:"Quality incidents minimal and contained internally with quick resolution.", 2:"Recurring quality issues with delayed containment.", 1:"Frequent quality incidents impacting delivery or customer." },
  "Process Audits": { 4:"Proactive process audits conducted with zero deviations from standard.", 3:"Regular process audits completed; any deviations corrected immediately.", 2:"Process audits performed sporadically; recurring deviations noted.", 1:"No process audits performed; repeated process deviations occurring." },
  "SOP/PPO Update Process": { 4:"SOP/PPO update process proactive with all documents current and change-controlled.", 3:"Update process followed; documents reviewed and updated on schedule with minimal backlog.", 2:"Update process in place but reviews delayed and some documents outdated.", 1:"No formal SOP/PPO update process; documents outdated with large backlog." },
  "Training Records Audit": { 4:"100% of training records complete, current, and verified through regular audits.", 3:"Training records accurate and up to date; minor gaps closed promptly.", 2:"Training records mostly complete but some gaps or overdue training identified.", 1:"Training records incomplete or not maintained; no regular audits performed." },
  "HRxHR Boards": { 4:"Boards updated in real time with accurate data; all metrics green and actions closed.", 3:"Boards updated regularly; most metrics on target with visible action plans.", 2:"Boards present but updates delayed or incomplete; some metrics off track.", 1:"Boards outdated or not maintained; no visibility into performance." },
  "Downtime Charges": { 4:"Zero downtime charges; all events logged, analyzed, and reduced proactively.", 3:"Downtime charges minimal; events tracked and improvement plans active.", 2:"Some unplanned downtime leading to charges; analysis started but actions pending.", 1:"High or repeated downtime charges with no root cause analysis or mitigation." },
  "Product Rework/Rejected": { 4:"Zero rework and zero rejected product; first-pass quality at target.", 3:"Rework and rejects minimal; root causes identified and eliminated rapidly.", 2:"Moderate rework/reject levels; some analysis performed but actions incomplete.", 1:"High rework or reject rates with no effective root cause or corrective actions." },
  "Operations Audits": { 4:"Proactive audits & zero customer errors.", 3:"Scheduled audits completed; customer errors minimal and resolved rapidly.", 2:"Audits performed sporadically; some recurring customer errors noted.", 1:"No audits available. Repeated errors." },
  "Billable Hours/Profit": { 4:"Controllable profit is green month over month for the past quarter.", 3:"Profit targets achieved or exceeded in most months; variances analyzed and corrected.", 2:"Profit occasionally below target but recovered within the quarter.", 1:"Multiple months of profit misses without effective recovery actions." },
  "Staffing/Attrition Impact": { 4:"Fully staffed with zero coverage gaps. Minimum 30 days.", 3:"Adequate staffing levels; gaps identified early and covered with minimal overtime.", 2:"Some short-term coverage gaps managed through overtime or temporary measures.", 1:"Coverage gaps impacting customer operations." },
  "Teamwork": { 4:"Excellent cross-functional teamwork driving results with proactive collaboration.", 3:"Strong teamwork; issues resolved collaboratively and efficiently.", 2:"Teamwork inconsistent; some silos affecting communication and problem-solving.", 1:"Poor teamwork and collaboration impacting performance and results." },
  "Morale": { 4:"High morale with engaged employees and positive feedback culture.", 3:"Good morale; employee concerns addressed quickly through open dialogue.", 2:"Average morale; some disengagement noted with improvement initiatives started.", 1:"Low morale with visible disengagement, complaints, or high turnover." }
};

// ─────────────────────────── AUDIT TEMPLATES ───────────────────────────

const OA_TEMPLATE = {
  label: "Operations Audit", short: "OA", color: "#0369A1",
  sections: [
    { id: "safety",   name: "Safety",           weight: 0.30, items: ["Property Damages/Impacts","Injuries/First Aid/Near Miss","PPE & ICI","SSE Programs","SOPs Available & Utilized"] },
    { id: "quality",  name: "Quality",           weight: 0.25, items: ["Housekeeping","Quality Incident","Process Audits","SOP/PPO Update Process","Training Records Audit"] },
    { id: "delivery", name: "Delivery",          weight: 0.25, items: ["HRxHR Boards","Downtime Charges","Product Rework/Rejected","Operations Audits"] },
    { id: "cost",     name: "Cost & Engagement", weight: 0.20, items: ["Billable Hours/Profit","Staffing/Attrition Impact","Teamwork","Morale"] }
  ]
};

const SA_TEMPLATE = {
  label: "Safety Audit", short: "SA", color: "#7C3AED",
  sections: [
    { id: "emp_eng", name: "Employee Engagement",     weight: 0, items: ["Associate knows evacuation gathering point","Associate can explain fire/weather alarm differences","Associate knows spill control protocol","Associate knows how to access a SDS"] },
    { id: "injury",  name: "Injury / Illness",         weight: 0, items: ["Review last injury/illness – process followed & root cause addressed","Review last incident – did we follow the Flow Chart?","Review last incident – did we follow all protocols?","Deadlines for actions from last injury met"] },
    { id: "ppe",     name: "PPE",                      weight: 0, items: ["PPE Audits","PPE Expenses being tracked","PPE Usage on the floor","PPE consumption being tracked"] },
    { id: "hazard",  name: "Hazard Prevention",        weight: 0, items: ["JSA completed","JSA Effective","PPE effectiveness reviewed","Gemba walks being performed"] },
    { id: "inc_rec", name: "Incident & Records Review",weight: 0, items: ["Review OSHA training records","BBS Observations up to date","Review training records for last 5 associates hired","Review last 3 incidents / Protocols met"] }
  ]
};

const TEMPLATES = { OA: OA_TEMPLATE, SA: SA_TEMPLATE };
const SITES = ["US1","US2","US5","US7","US8","US10","Prime","Tweel"];

// ─────────────────────────── UTILITIES ───────────────────────────

const getScoreInfo = (v) => SCORES.find(s => s.val === v) || { color: "#94A3B8", bg: "#F1F5F9", label: "Not scored", text: "#475569" };

const calcScore = (audit) => {
  const sections = audit.sections || [];
  const isWeighted = sections.some(s => s.weight > 0);
  let failing = 0;
  if (isWeighted) {
    let weightedSum = 0, totalWeight = 0;
    sections.forEach(sec => {
      const scored = sec.items.filter(i => i.score !== null && i.score !== undefined && i.score !== "na");
      if (!scored.length) return;
      const avg = scored.reduce((s, i) => s + i.score, 0) / scored.length;
      weightedSum += avg * sec.weight; totalWeight += sec.weight;
      scored.forEach(i => { if (i.score === 1) failing++; });
    });
    const ws = totalWeight > 0 ? weightedSum / totalWeight : 0;
    return { total: ws.toFixed(2), max: 4, pct: Math.round((ws / 4) * 100), failing, weighted: true };
  }
  let total = 0, max = 0;
  sections.forEach(sec => sec.items.forEach(item => {
    if (item.score === null || item.score === undefined || item.score === "na") return;
    total += item.score; max += 4;
    if (item.score === 1) failing++;
  }));
  return { total, max, pct: max > 0 ? Math.round((total / max) * 100) : 0, failing, weighted: false };
};

const calcSectionScore = (sec) => {
  const scored = sec.items.filter(i => i.score !== null && i.score !== undefined);
  if (!scored.length) return { avg: "—", pct: 0 };
  const avg = scored.reduce((s, i) => s + i.score, 0) / scored.length;
  return { avg: avg.toFixed(1), pct: Math.round((avg / 4) * 100) };
};

const gradeColor = (pct) => pct >= 80 ? "#16A34A" : pct >= 60 ? "#D97706" : pct >= 40 ? "#EA580C" : "#DC2626";
const gradeLabel = (pct) => pct >= 80 ? "Good" : pct >= 60 ? "Acceptable" : pct >= 40 ? "Needs Work" : "Critical";
const fmt = (d) => d ? new Date(d + (d.includes("T") ? "" : "T12:00:00")).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";

const createEmpty = (type) => ({
  id: Date.now().toString(), type, site: "", auditorName: "", auditorSite: "",
  date: new Date().toISOString().split("T")[0], actionItemDueDate: "",
  sections: TEMPLATES[type].sections.map(sec => ({ ...sec, items: sec.items.map(name => ({ name, score: null, comment: "", actionItem: "", actionDue: "" })) }))
});

// ─────────────────────────── SMALL COMPONENTS ───────────────────────────

const Pill = ({ val }) => {
  const s = getScoreInfo(val);
  return <span style={{ background: s.bg, color: s.text, borderRadius: 99, fontSize: 11, fontWeight: 600, padding: "2px 8px", whiteSpace: "nowrap" }}>{val !== null && val !== undefined ? `${val} – ${s.label}` : "Not scored"}</span>;
};

const Ring = ({ pct, size = 72 }) => {
  const r = (size - 10) / 2, c = 2 * Math.PI * r, col = gradeColor(pct);
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#E2E8F0" strokeWidth={8} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={col} strokeWidth={8} strokeDasharray={`${(pct/100)*c} ${c}`} strokeLinecap="round" />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontWeight: 700, fontSize: size > 60 ? 18 : 14, color: col, lineHeight: 1 }}>{pct}%</span>
        {size > 60 && <span style={{ fontSize: 10, color: "#64748B", lineHeight: 1.4 }}>{gradeLabel(pct)}</span>}
      </div>
    </div>
  );
};

const Delta = ({ d }) => {
  if (d === null || d === undefined) return null;
  if (d > 0) return <span style={{ color: "#16A34A", fontSize: 12, fontWeight: 600 }}>↑ +{d}%</span>;
  if (d < 0) return <span style={{ color: "#DC2626", fontSize: 12, fontWeight: 600 }}>↓ {d}%</span>;
  return <span style={{ color: "#64748B", fontSize: 12 }}>→ No change</span>;
};

const TypeBadge = ({ type }) => (
  <span style={{ background: type === "OA" ? "#DBEAFE" : "#EDE9FE", color: type === "OA" ? "#1D4ED8" : "#7C3AED", fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 4, flexShrink: 0 }}>{type}</span>
);

// ─────────────────────────── SITE FOLDERS ───────────────────────────

const SiteFolders = ({ audits, onView, prevFor }) => {
  const [openSites, setOpenSites] = useState({});

  const toggleSite = (site) => setOpenSites(prev => ({ ...prev, [site]: !prev[site] }));

  // Group audits by site, sorted by most recent first within each site
  const bySite = {};
  [...audits].sort((a, b) => b.submittedAt - a.submittedAt).forEach(audit => {
    if (!bySite[audit.site]) bySite[audit.site] = [];
    bySite[audit.site].push(audit);
  });

  // Use the same SITES order as the dropdown, only show sites that have audits
  const siteList = SITES.filter(s => bySite[s]).map(s => [s, bySite[s]]);

  if (siteList.length === 0) return (
    <div style={{ background: "white", borderRadius: 12, border: "0.5px solid #E2E8F0", padding: "36px 20px", textAlign: "center" }}>
      <i className="ti ti-clipboard" style={{ fontSize: 40, color: "#CBD5E1", display: "block", marginBottom: 10 }} />
      <div style={{ color: "#94A3B8", fontSize: 14 }}>No audits yet. Start your first one above.</div>
    </div>
  );

  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 600, color: "#94A3B8", letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 12 }}>Audits by site</div>
      {siteList.map(([site, siteAudits]) => {
        const isOpen = !!openSites[site];
        const latest = calcScore(siteAudits[0]);
        const siteFailingCount = siteAudits.reduce((sum, a) => sum + calcScore(a).failing, 0);
        const oaCount = siteAudits.filter(a => a.type === "OA").length;
        const saCount = siteAudits.filter(a => a.type === "SA").length;

        return (
          <div key={site} style={{ marginBottom: 10 }}>
            {/* Site folder header */}
            <button onClick={() => toggleSite(site)} style={{
              width: "100%", background: "white", border: "0.5px solid #E2E8F0",
              borderRadius: isOpen ? "12px 12px 0 0" : 12,
              borderBottom: isOpen ? "0.5px solid #F1F5F9" : "0.5px solid #E2E8F0",
              padding: "12px 14px", textAlign: "left", cursor: "pointer",
              display: "flex", alignItems: "center", gap: 12
            }}>
              {/* Site color dot + name */}
              <div style={{ width: 36, height: 36, borderRadius: 8, background: gradeColor(latest.pct) + "18", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <i className="ti ti-building" style={{ fontSize: 16, color: gradeColor(latest.pct) }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                  <span style={{ fontWeight: 700, fontSize: 15, color: "#0F172A" }}>{site}</span>
                  {siteFailingCount > 0 && <span style={{ fontSize: 10, color: "#DC2626", fontWeight: 700, background: "#FEE2E2", padding: "1px 5px", borderRadius: 4 }}>⚠ {siteFailingCount}</span>}
                </div>
                <div style={{ fontSize: 12, color: "#64748B" }}>
                  {siteAudits.length} audit{siteAudits.length !== 1 ? "s" : ""}
                  {oaCount > 0 && ` · ${oaCount} OA`}
                  {saCount > 0 && ` · ${saCount} SA`}
                  {" · Latest: "}{fmt(siteAudits[0].date)}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                <span style={{ fontWeight: 700, fontSize: 15, color: gradeColor(latest.pct) }}>{latest.pct}%</span>
                <i className={`ti ${isOpen ? "ti-chevron-up" : "ti-chevron-down"}`} style={{ fontSize: 16, color: "#CBD5E1" }} />
              </div>
            </button>

            {/* Expanded audit list */}
            {isOpen && (
              <div style={{ background: "#FAFBFC", border: "0.5px solid #E2E8F0", borderTop: "none", borderRadius: "0 0 12px 12px", overflow: "hidden" }}>
                {siteAudits.map((audit, idx) => {
                  const s = calcScore(audit);
                  const prev = prevFor(audit);
                  const delta = prev ? s.pct - calcScore(prev).pct : null;
                  return (
                    <button key={audit.id} onClick={() => onView(audit)} style={{
                      width: "100%", background: "white", border: "none",
                      borderBottom: idx < siteAudits.length - 1 ? "0.5px solid #F1F5F9" : "none",
                      padding: "12px 14px 12px 20px", textAlign: "left", cursor: "pointer",
                      display: "flex", alignItems: "center", gap: 12
                    }}>
                      {/* Left accent line */}
                      <div style={{ width: 3, height: 36, borderRadius: 2, background: gradeColor(s.pct), flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                          <TypeBadge type={audit.type} />
                          <span style={{ fontSize: 13, color: "#64748B" }}>{fmt(audit.date)}</span>
                          {s.failing > 0 && <span style={{ fontSize: 10, color: "#DC2626", fontWeight: 700 }}>⚠ {s.failing}</span>}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 12, color: "#94A3B8" }}>By {audit.auditorName || "—"}</span>
                          {s.weighted ? <span style={{ fontSize: 12, color: "#94A3B8" }}>{s.total}/4.00</span> : <span style={{ fontSize: 12, color: "#94A3B8" }}>{s.total}/{s.max} pts</span>}
                          <Delta d={delta} />
                        </div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                        <span style={{ fontWeight: 700, fontSize: 14, color: gradeColor(s.pct) }}>{s.pct}%</span>
                        <i className="ti ti-chevron-right" style={{ fontSize: 14, color: "#CBD5E1" }} />
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

// ─────────────────────────── DASHBOARD ───────────────────────────

const Dashboard = ({ audits, schedules, onNew, onView, onResumeDraft }) => {
  const today = new Date();
  // Check for saved draft
  const draft = (() => { try { return JSON.parse(localStorage.getItem(DRAFT_KEY)); } catch { return null; } })();
  const hasDraft = !!draft?.audit?.type;
  // Only count audits that have a site assigned
  const siteAudits = audits.filter(a => a.site && SITES.includes(a.site));
  const avg = siteAudits.length ? Math.round(siteAudits.reduce((s, a) => s + calcScore(a).pct, 0) / siteAudits.length) : 0;
  const sites = new Set(siteAudits.map(a => a.site)).size;
  const overdueCount = schedules.filter(s => {
    const due = new Date(s.dueDate + "T12:00:00");
    if (due >= today) return false;
    return !audits.some(a => a.site === s.site && a.type === s.type && Math.abs(new Date(a.date + "T12:00:00") - due) / 86400000 <= 3);
  }).length;
  const upcomingCount = schedules.filter(s => new Date(s.dueDate + "T12:00:00") >= today).length;
  const prevFor = (audit) => audits.filter(a => a.site === audit.site && a.type === audit.type && a.submittedAt < audit.submittedAt).sort((a, b) => b.submittedAt - a.submittedAt)[0];

  return (
    <div style={{ padding: 16 }}>
      {/* Resume draft banner */}
      {hasDraft && (
        <div style={{ background: "#FFF7ED", border: "0.5px solid #FED7AA", borderRadius: 10, padding: "10px 14px", marginBottom: 16, display: "flex", alignItems: "center", gap: 10 }}>
          <i className="ti ti-device-floppy" style={{ fontSize: 20, color: "#EA580C", flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: 14, color: "#7C2D12" }}>Unsaved audit draft</div>
            <div style={{ fontSize: 12, color: "#9A3412" }}>{draft.audit.type} · {draft.audit.site || "No site selected"} · Auto-saved</div>
          </div>
          <button onClick={() => onResumeDraft(draft.audit.type)} style={{ background: "#EA580C", color: "white", border: "none", borderRadius: 8, padding: "6px 12px", fontSize: 13, fontWeight: 600, cursor: "pointer", flexShrink: 0 }}>Resume</button>
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 18 }}>
        {[
          { label: "Audits", val: siteAudits.length, icon: "ti-clipboard-check", color: "#003A6B" },
          { label: "Avg score", val: `${avg}%`, icon: "ti-chart-line", color: gradeColor(avg) },
          { label: "Sites", val: sites, icon: "ti-building", color: "#003A6B" }
        ].map(st => (
          <div key={st.label} style={{ background: "white", borderRadius: 12, padding: "12px 10px", border: "0.5px solid #E2E8F0", textAlign: "center" }}>
            <i className={`ti ${st.icon}`} style={{ fontSize: 20, color: st.color }} />
            <div style={{ fontWeight: 700, fontSize: 20, color: "#0F172A", lineHeight: 1.1, marginTop: 4 }}>{st.val}</div>
            <div style={{ fontSize: 11, color: "#64748B", marginTop: 2 }}>{st.label}</div>
          </div>
        ))}
      </div>

      {overdueCount > 0 && (
        <div style={{ background: "#FEE2E2", border: "0.5px solid #FECACA", borderRadius: 10, padding: "10px 14px", marginBottom: 12, display: "flex", gap: 10 }}>
          <i className="ti ti-alert-triangle" style={{ fontSize: 20, color: "#DC2626", flexShrink: 0, marginTop: 1 }} />
          <div style={{ fontWeight: 600, fontSize: 14, color: "#7F1D1D" }}>{overdueCount} overdue audit{overdueCount !== 1 ? "s" : ""} — check the calendar</div>
        </div>
      )}
      {upcomingCount > 0 && (
        <div style={{ background: "#EFF6FF", border: "0.5px solid #BFDBFE", borderRadius: 10, padding: "10px 14px", marginBottom: 18, display: "flex", alignItems: "center", gap: 10 }}>
          <i className="ti ti-calendar" style={{ fontSize: 20, color: "#0369A1" }} />
          <div style={{ fontWeight: 500, fontSize: 14, color: "#1E3A5F" }}>{upcomingCount} audit{upcomingCount !== 1 ? "s" : ""} scheduled upcoming</div>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 18 }}>
        <button onClick={() => onNew("OA")} style={{ background: "#003A6B", color: "white", border: "none", borderRadius: 12, padding: "15px 12px", fontSize: 14, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          <i className="ti ti-clipboard-plus" style={{ fontSize: 18 }} />New OA
        </button>
        <button onClick={() => onNew("SA")} style={{ background: "#7C3AED", color: "white", border: "none", borderRadius: 12, padding: "15px 12px", fontSize: 14, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          <i className="ti ti-shield-check" style={{ fontSize: 18 }} />New SA
        </button>
      </div>

      {/* Score key */}
      <div style={{ background: "white", borderRadius: 12, border: "0.5px solid #E2E8F0", padding: "12px 14px", marginBottom: 18 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#94A3B8", letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 8 }}>Score key (1–4)</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
          {SCORES.map(sc => (
            <div key={sc.val} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ background: sc.bg, color: sc.text, borderRadius: 4, fontWeight: 700, fontSize: 12, padding: "1px 6px", flexShrink: 0 }}>{sc.val}</span>
              <span style={{ fontSize: 12, color: "#374151" }}>{sc.label}</span>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 8 }}>OA weighted: Safety 30% · Quality 25% · Delivery 25% · Cost 20%</div>
      </div>

    </div>
  );
};

// ─────────────────────────── CALENDAR VIEW ───────────────────────────

const CalendarView = ({ audits, schedules, onAddSchedule, onDeleteSchedule }) => {
  const today = new Date();
  const [viewDate, setViewDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDay, setSelectedDay] = useState(today.getDate());
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ site: "", type: "OA", assignedTo: "", dueDate: "", frequency: "monthly", notes: "" });

  const year = viewDate.getFullYear(), month = viewDate.getMonth();
  const monthName = viewDate.toLocaleString("en-US", { month: "long" });
  const firstDOW = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const isCurMonth = year === today.getFullYear() && month === today.getMonth();

  const dayStr = (d) => `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

  const completedByDate = {};
  audits.forEach(a => { if (!completedByDate[a.date]) completedByDate[a.date] = []; completedByDate[a.date].push(a); });
  const scheduledByDate = {};
  schedules.forEach(s => { if (!scheduledByDate[s.dueDate]) scheduledByDate[s.dueDate] = []; scheduledByDate[s.dueDate].push(s); });

  const isOverdue = (s) => {
    const due = new Date(s.dueDate + "T12:00:00");
    if (due >= today) return false;
    return !audits.some(a => a.site === s.site && a.type === s.type && Math.abs(new Date(a.date + "T12:00:00") - due) / 86400000 <= 3);
  };

  const overdueSchedules = schedules.filter(isOverdue);
  const getDayStatus = (day) => {
    const d = dayStr(day), scheduled = scheduledByDate[d] || [];
    return { hasCompleted: !!(completedByDate[d]?.length), hasOverdue: scheduled.some(s => isOverdue(s)), hasScheduled: scheduled.length > 0 && !scheduled.some(s => isOverdue(s)) };
  };

  const selStr = selectedDay ? dayStr(selectedDay) : null;
  const selCompleted = selStr ? (completedByDate[selStr] || []) : [];
  const selScheduled = selStr ? (scheduledByDate[selStr] || []) : [];

  const upcomingSorted = [...schedules].filter(s => new Date(s.dueDate + "T12:00:00") >= new Date(today.getFullYear(), today.getMonth(), today.getDate())).sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));

  const generateMonthlySchedule = () => {
    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const yr = nextMonth.getFullYear();
    const mo = nextMonth.getMonth();
    const daysInNextMonth = new Date(yr, mo + 1, 0).getDate();

    // Get unique auditors from existing audits (name + site pairs)
    const auditorMap = {};
    audits.forEach(a => {
      if (a.auditorName && a.auditorSite) auditorMap[a.auditorSite] = a.auditorName;
    });

    // Shuffle sites so assignment is random
    const shuffledSites = [...SITES].sort(() => Math.random() - 0.5);
    const auditorSites = Object.keys(auditorMap);

    const newSchedules = SITES.map((site, i) => {
      // Pick a random weekday in next month
      let day;
      let attempts = 0;
      do {
        day = Math.floor(Math.random() * daysInNextMonth) + 1;
        const dow = new Date(yr, mo, day).getDay();
        if (dow !== 0 && dow !== 6) break;
        attempts++;
      } while (attempts < 20);

      const dueDate = `${yr}-${String(mo + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

      // Assign auditor from a different site (rotate through available auditors)
      let assignedTo = "";
      if (auditorSites.length > 0) {
        // Pick an auditor not from this site
        const others = auditorSites.filter(s => s !== site);
        if (others.length > 0) {
          const pick = others[i % others.length];
          assignedTo = auditorMap[pick];
        } else {
          assignedTo = auditorMap[auditorSites[0]];
        }
      }

      return {
        id: `gen-${Date.now()}-${i}`,
        site,
        type: "OA",
        assignedTo,
        dueDate,
        frequency: "monthly",
        notes: `Auto-generated — ${nextMonth.toLocaleString("en-US", { month: "long", year: "numeric" })}`,
        createdAt: Date.now()
      };
    });

    newSchedules.forEach(s => onAddSchedule(s));
    // Jump calendar to next month
    setViewDate(nextMonth);
  };
    if (!form.site || !form.dueDate) return;
    onAddSchedule({ ...form, id: Date.now().toString(), createdAt: Date.now() });
    setForm({ site: "", type: "OA", assignedTo: "", dueDate: "", frequency: "monthly", notes: "" });
    setShowForm(false);
  };

  const inp = { width: "100%", padding: "10px 12px", border: "1px solid #D1D5DB", borderRadius: 8, fontSize: 14, boxSizing: "border-box", fontFamily: "inherit" };
  const lbl = { display: "block", fontSize: 13, fontWeight: 500, color: "#374151", marginBottom: 5 };

  return (
    <div style={{ padding: 16 }}>
      {overdueSchedules.length > 0 && (
        <div style={{ background: "#FEE2E2", border: "0.5px solid #FECACA", borderRadius: 10, padding: "10px 14px", marginBottom: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: "#7F1D1D", marginBottom: 6 }}>⚠ {overdueSchedules.length} overdue audit{overdueSchedules.length !== 1 ? "s" : ""}</div>
          {overdueSchedules.map((s, i) => (<div key={i} style={{ fontSize: 13, color: "#991B1B", marginBottom: 2, display: "flex", alignItems: "center", gap: 6 }}><TypeBadge type={s.type} />{s.site} · was due {fmt(s.dueDate)}</div>))}
        </div>
      )}

      <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
        {/* Sidebar */}
        <div style={{ width: 108, flexShrink: 0, background: "white", borderRadius: 12, border: "0.5px solid #E2E8F0", padding: 10, maxHeight: 360, overflowY: "auto" }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#94A3B8", letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 8 }}>Scheduled</div>
          {upcomingSorted.length === 0 ? <div style={{ fontSize: 11, color: "#CBD5E1", lineHeight: 1.4 }}>None upcoming</div>
          : upcomingSorted.map((s, i) => (
            <button key={i} onClick={() => { setViewDate(new Date(new Date(s.dueDate).getFullYear(), new Date(s.dueDate).getMonth(), 1)); setSelectedDay(new Date(s.dueDate + "T12:00:00").getDate()); }}
              style={{ width: "100%", textAlign: "left", background: "none", border: "none", borderBottom: i < upcomingSorted.length - 1 ? "0.5px solid #F1F5F9" : "none", padding: "7px 0", cursor: "pointer" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 2 }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#0369A1", flexShrink: 0 }} />
                <span style={{ fontSize: 11, fontWeight: 700, color: "#1E293B" }}>{s.type}</span>
              </div>
              <div style={{ fontSize: 11, color: "#374151", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.site}</div>
              <div style={{ fontSize: 10, color: "#94A3B8" }}>{fmt(s.dueDate)}</div>
            </button>
          ))}
        </div>

        {/* Calendar */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <button onClick={() => setViewDate(new Date(year, month - 1, 1))} style={{ background: "none", border: "none", cursor: "pointer", padding: "4px 6px", fontSize: 20, color: "#64748B" }}>‹</button>
            <span style={{ fontWeight: 700, fontSize: 15, color: "#0F172A" }}>{monthName} {year}</span>
            <button onClick={() => setViewDate(new Date(year, month + 1, 1))} style={{ background: "none", border: "none", cursor: "pointer", padding: "4px 6px", fontSize: 20, color: "#64748B" }}>›</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", marginBottom: 4 }}>
            {["S","M","T","W","T","F","S"].map((d, i) => <div key={i} style={{ textAlign: "center", fontSize: 10, fontWeight: 700, color: "#94A3B8", padding: "4px 0" }}>{d}</div>)}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 1, background: "white", borderRadius: 12, border: "0.5px solid #E2E8F0", padding: 6 }}>
            {Array.from({ length: firstDOW }).map((_, i) => <div key={`e${i}`} />)}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1, isToday = isCurMonth && day === today.getDate(), isSel = day === selectedDay;
              const { hasCompleted, hasScheduled, hasOverdue } = getDayStatus(day);
              return (
                <div key={day} onClick={() => setSelectedDay(day)} style={{ textAlign: "center", padding: "4px 1px", borderRadius: 6, cursor: "pointer", background: isSel ? "#003A6B" : isToday ? "#EFF6FF" : "transparent", border: isToday && !isSel ? "1px solid #BFDBFE" : "1px solid transparent" }}>
                  <div style={{ fontSize: 12, fontWeight: isToday || isSel ? 700 : 400, color: isSel ? "white" : isToday ? "#003A6B" : "#374151", lineHeight: 1.3 }}>{day}</div>
                  <div style={{ display: "flex", justifyContent: "center", gap: 2, marginTop: 2 }}>
                    {hasOverdue   && <div style={{ width: 4, height: 4, borderRadius: "50%", background: "#DC2626" }} />}
                    {hasScheduled && <div style={{ width: 4, height: 4, borderRadius: "50%", background: "#0369A1" }} />}
                    {hasCompleted && <div style={{ width: 4, height: 4, borderRadius: "50%", background: "#16A34A" }} />}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 14, marginTop: 12, marginBottom: 16 }}>
        {[["#DC2626","Overdue"],["#0369A1","Scheduled"],["#16A34A","Completed"]].map(([c,l]) => (
          <div key={l} style={{ display: "flex", alignItems: "center", gap: 4 }}><div style={{ width: 8, height: 8, borderRadius: "50%", background: c }} /><span style={{ fontSize: 11, color: "#64748B" }}>{l}</span></div>
        ))}
      </div>

      {selectedDay && (selCompleted.length > 0 || selScheduled.length > 0) && (
        <div style={{ background: "white", borderRadius: 12, border: "0.5px solid #E2E8F0", padding: 14, marginBottom: 14 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: "#0F172A", marginBottom: 10 }}>{monthName} {selectedDay}</div>
          {selScheduled.map((s, i) => (
            <div key={i} style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", padding: "8px 0", borderBottom: "0.5px solid #F1F5F9" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: isOverdue(s) ? "#DC2626" : "#0369A1", flexShrink: 0 }} />
                  <span style={{ fontSize: 14, fontWeight: 600, color: "#1E293B" }}>{s.site}</span>
                  <TypeBadge type={s.type} />
                  {isOverdue(s) && <span style={{ fontSize: 11, color: "#DC2626", fontWeight: 600 }}>OVERDUE</span>}
                </div>
                <div style={{ fontSize: 12, color: "#64748B", marginLeft: 14 }}>{s.assignedTo ? `Assigned to: ${s.assignedTo}` : "No assignee"} · {s.frequency}</div>
                {s.notes && <div style={{ fontSize: 12, color: "#94A3B8", marginLeft: 14, fontStyle: "italic" }}>{s.notes}</div>}
              </div>
              <button onClick={() => onDeleteSchedule(s.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#CBD5E1", padding: 4 }}><i className="ti ti-trash" style={{ fontSize: 16 }} /></button>
            </div>
          ))}
          {selCompleted.map((a, i) => {
            const sc = calcScore(a);
            return (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "0.5px solid #F1F5F9" }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#16A34A", flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: "#1E293B" }}>{a.site}</span>
                    <TypeBadge type={a.type} />
                    <span style={{ fontSize: 13, fontWeight: 700, color: gradeColor(sc.pct) }}>{sc.pct}%</span>
                  </div>
                  <div style={{ fontSize: 12, color: "#64748B" }}>By {a.auditorName}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selectedDay && selCompleted.length === 0 && selScheduled.length === 0 && (
        <div style={{ textAlign: "center", color: "#94A3B8", fontSize: 13, marginBottom: 14, padding: "12px 0" }}>Nothing scheduled for {monthName} {selectedDay}</div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <button onClick={() => setShowForm(!showForm)} style={{ background: showForm ? "#64748B" : "#003A6B", color: "white", border: "none", borderRadius: 12, padding: 14, fontSize: 14, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          <i className={`ti ${showForm ? "ti-x" : "ti-calendar-plus"}`} style={{ fontSize: 18 }} />
          {showForm ? "Cancel" : "Schedule audit"}
        </button>
        <button onClick={generateMonthlySchedule} style={{ background: "#7C3AED", color: "white", border: "none", borderRadius: 12, padding: 14, fontSize: 14, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          <i className="ti ti-calendar-stats" style={{ fontSize: 18 }} />
          Auto-schedule
        </button>
      </div>

      {showForm && (
        <div style={{ background: "white", borderRadius: 12, border: "0.5px solid #E2E8F0", padding: 16, marginTop: 12 }}>
          <h3 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 700, color: "#0F172A" }}>Schedule an audit</h3>
          <label style={lbl}>Site *</label>
          <select value={form.site} onChange={e => setForm(f => ({ ...f, site: e.target.value }))} style={{ ...inp, marginBottom: 12 }}>
            <option value="">Select a site...</option>
            {SITES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <label style={lbl}>Audit type *</label>
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            {["OA","SA"].map(t => (<button key={t} onClick={() => setForm(f => ({ ...f, type: t }))} style={{ flex: 1, padding: 10, border: `2px solid ${form.type === t ? "#003A6B" : "#E2E8F0"}`, borderRadius: 8, background: form.type === t ? "#EFF6FF" : "white", color: form.type === t ? "#003A6B" : "#64748B", fontWeight: 700, cursor: "pointer" }}>{t}</button>))}
          </div>
          <label style={lbl}>Assigned to</label>
          <input value={form.assignedTo} onChange={e => setForm(f => ({ ...f, assignedTo: e.target.value }))} placeholder="Auditor name" style={{ ...inp, marginBottom: 12 }} />
          <label style={lbl}>Due date *</label>
          <input type="date" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} style={{ ...inp, marginBottom: 12 }} />
          <label style={lbl}>Frequency</label>
          <select value={form.frequency} onChange={e => setForm(f => ({ ...f, frequency: e.target.value }))} style={{ ...inp, marginBottom: 12 }}>
            <option value="once">One-time</option>
            <option value="weekly">Weekly</option>
            <option value="biweekly">Bi-weekly</option>
            <option value="monthly">Monthly</option>
            <option value="quarterly">Quarterly</option>
          </select>
          <label style={lbl}>Notes</label>
          <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional notes..." style={{ ...inp, marginBottom: 16 }} />
          <button onClick={handleSave} disabled={!form.site || !form.dueDate} style={{ width: "100%", background: form.site && form.dueDate ? "#003A6B" : "#CBD5E1", color: "white", border: "none", borderRadius: 10, padding: 13, fontSize: 15, fontWeight: 600, cursor: form.site && form.dueDate ? "pointer" : "default" }}>Save schedule</button>
        </div>
      )}
    </div>
  );
};

// ─────────────────────────── NEW AUDIT WIZARD ───────────────────────────

const DRAFT_KEY = "mau-audit-draft";

const NewAudit = ({ type, onDone, onCancel }) => {
  const [step, setStep] = useState(0);
  const [audit, setAudit] = useState(() => {
    // Restore draft if same type
    try {
      const saved = JSON.parse(localStorage.getItem(DRAFT_KEY));
      if (saved?.audit?.type === type) return saved.audit;
    } catch {}
    return createEmpty(type);
  });
  const [expandedCriteria, setExpandedCriteria] = useState(null);
  const tmpl = TEMPLATES[type];
  const numSec = audit.sections.length;
  const upd = (f, v) => setAudit(a => ({ ...a, [f]: v }));
  const updItem = (si, ii, f, v) => setAudit(a => ({ ...a, sections: a.sections.map((sec, s) => s !== si ? sec : { ...sec, items: sec.items.map((item, i) => i !== ii ? item : { ...item, [f]: v }) }) }));
  const canGo = step === 0 ? audit.site.trim() && audit.auditorName.trim() && audit.auditorSite.trim() : true;
  const secIdx = step - 1;
  const inSection = step > 0 && secIdx < numSec;
  const inReview = step === numSec + 1;
  const progress = Math.round((step / (numSec + 2)) * 100);
  const inp = { width: "100%", padding: "11px 12px", border: "1px solid #D1D5DB", borderRadius: 8, fontSize: 15, boxSizing: "border-box", fontFamily: "inherit" };
  const lbl = { display: "block", fontSize: 13, fontWeight: 500, color: "#374151", marginBottom: 6 };

  // Auto-save draft on every change
  useEffect(() => {
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ audit, savedAt: Date.now() })); } catch {}
  }, [audit]);

  const handleCancel = () => {
    localStorage.removeItem(DRAFT_KEY);
    onCancel();
  };

  const handleSubmit = () => {
    localStorage.removeItem(DRAFT_KEY);
    // Apply the single due date to all items scored 1
    const finalAudit = {
      ...audit,
      submittedAt: Date.now(),
      sections: audit.sections.map(sec => ({
        ...sec,
        items: sec.items.map(item => ({
          ...item,
          actionDue: item.score === 1 ? audit.actionItemDueDate : item.actionDue
        }))
      }))
    };
    onDone(finalAudit);
  };

  if (step === 0) return (
    <div style={{ padding: 16 }}>
      <button onClick={handleCancel} style={{ background: "none", border: "none", color: "#64748B", cursor: "pointer", padding: 0, marginBottom: 20, display: "flex", alignItems: "center", gap: 4, fontSize: 14 }}><i className="ti ti-arrow-left" /> Cancel</button>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}><TypeBadge type={type} /><h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#0F172A" }}>{tmpl.label}</h2></div>
      <p style={{ color: "#64748B", fontSize: 14, margin: "0 0 24px" }}>Enter audit details to begin scoring</p>
      <label style={lbl}>Site being audited *</label>
      <select value={audit.site} onChange={e => upd("site", e.target.value)} style={{ ...inp, marginBottom: 16 }}>
        <option value="">Select a site...</option>
        {SITES.map(s => <option key={s} value={s}>{s}</option>)}
      </select>
      <label style={lbl}>Auditor name *</label>
      <input value={audit.auditorName} onChange={e => upd("auditorName", e.target.value)} placeholder="Your full name" style={{ ...inp, marginBottom: 16 }} />
      <label style={lbl}>Auditor's home site *</label>
      <select value={audit.auditorSite} onChange={e => upd("auditorSite", e.target.value)} style={{ ...inp, marginBottom: 16 }}>
        <option value="">Select your site...</option>
        {SITES.map(s => <option key={s} value={s}>{s}</option>)}
      </select>
      <div style={{ marginBottom: 28 }}>
        <label style={lbl}>Audit date</label>
        <input type="date" value={audit.date} onChange={e => upd("date", e.target.value)} style={inp} />
      </div>
      <button onClick={() => setStep(1)} disabled={!canGo} style={{ width: "100%", background: canGo ? "#003A6B" : "#CBD5E1", color: "white", border: "none", borderRadius: 12, padding: 15, fontSize: 16, fontWeight: 600, cursor: canGo ? "pointer" : "default" }}>Start scoring →</button>
    </div>
  );

  if (inSection) {
    const sec = audit.sections[secIdx];
    const ss = calcSectionScore(sec);
    return (
      <div>
        <div style={{ background: "#E2E8F0", height: 4 }}><div style={{ background: "#003A6B", height: 4, width: `${progress}%`, transition: "width 0.3s" }} /></div>
        <div style={{ padding: 16 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <button onClick={() => setStep(s => s - 1)} style={{ background: "none", border: "none", color: "#64748B", cursor: "pointer", padding: 0 }}><i className="ti ti-arrow-left" style={{ fontSize: 22 }} /></button>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 12, color: "#64748B" }}>Section {secIdx + 1} of {numSec}</div>
              <div style={{ fontWeight: 700, fontSize: 16, color: "#0F172A" }}>{sec.name}</div>
              {sec.weight > 0 && <div style={{ fontSize: 11, color: "#94A3B8" }}>Weight: {Math.round(sec.weight * 100)}%</div>}
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 12, color: "#64748B" }}>Avg</div>
              <div style={{ fontWeight: 700, fontSize: 16, color: gradeColor(ss.pct) }}>{ss.avg}/4</div>
            </div>
          </div>

          {sec.items.map((item, ii) => {
            const criteria = CRITERIA[item.name];
            const isExpanded = expandedCriteria === `${secIdx}-${ii}`;
            const isNA = item.score === "na";
            const needsAction = item.score === null || (item.score !== "na" && item.score <= 2);
            const missingAction = item.score === 1 && !item.actionItem?.trim();
            const borderCol = item.score === 1 ? "#DC2626" : item.score === "na" ? "#CBD5E1" : item.score === null ? "#E2E8F0" : item.score === 4 ? "#16A34A" : item.score === 3 ? "#0369A1" : "#D97706";
            return (
              <div key={ii} style={{ background: "white", borderRadius: 12, border: "0.5px solid #E2E8F0", borderLeft: `3px solid ${borderCol}`, padding: 14, marginBottom: 12 }}>
                <p style={{ margin: "0 0 10px", fontWeight: 600, fontSize: 14, color: "#1E293B", lineHeight: 1.4 }}>{item.name}</p>
                {/* Score buttons: 4, 3, 2, 1, N/A */}
                <div style={{ display: "flex", gap: 5, marginBottom: 8 }}>
                  {SCORES.map(sc => (
                    <button key={sc.val} onClick={() => { updItem(secIdx, ii, "score", item.score === sc.val ? null : sc.val); setExpandedCriteria(null); }}
                      style={{ flex: 1, padding: "8px 0", border: `2px solid ${item.score === sc.val ? sc.color : "#E2E8F0"}`, borderRadius: 8, background: item.score === sc.val ? sc.bg : "white", color: item.score === sc.val ? sc.text : "#94A3B8", fontWeight: 700, fontSize: 15, cursor: "pointer" }}>{sc.val}</button>
                  ))}
                  <button onClick={() => { updItem(secIdx, ii, "score", isNA ? null : "na"); setExpandedCriteria(null); }}
                    style={{ flex: 1, padding: "8px 0", border: `2px solid ${isNA ? "#64748B" : "#E2E8F0"}`, borderRadius: 8, background: isNA ? "#F1F5F9" : "white", color: isNA ? "#374151" : "#CBD5E1", fontWeight: 700, fontSize: 11, cursor: "pointer" }}>N/A</button>
                </div>
                {item.score !== null && item.score !== "na" && <div style={{ fontSize: 12, color: getScoreInfo(item.score).color, marginBottom: 6, fontWeight: 500 }}>{getScoreInfo(item.score).label}</div>}
                {isNA && <div style={{ fontSize: 12, color: "#94A3B8", marginBottom: 6 }}>Not applicable — excluded from score</div>}
                {missingAction && <div style={{ fontSize: 12, color: "#DC2626", fontWeight: 600, marginBottom: 6 }}>⚠ Action item required for score of 1</div>}
                {criteria && !isNA && (
                  <button onClick={() => setExpandedCriteria(isExpanded ? null : `${secIdx}-${ii}`)}
                    style={{ background: "none", border: "none", color: "#0369A1", fontSize: 12, cursor: "pointer", padding: 0, marginBottom: 8, display: "flex", alignItems: "center", gap: 4 }}>
                    <i className={`ti ${isExpanded ? "ti-chevron-up" : "ti-chevron-down"}`} style={{ fontSize: 12 }} />
                    {isExpanded ? "Hide" : "View"} scoring criteria
                  </button>
                )}
                {isExpanded && criteria && (
                  <div style={{ background: "#F8FAFC", borderRadius: 8, padding: 10, marginBottom: 8 }}>
                    {SCORES.map(sc => (
                      <div key={sc.val} style={{ display: "flex", gap: 8, marginBottom: 6, alignItems: "flex-start" }}>
                        <span style={{ background: sc.bg, color: sc.text, borderRadius: 4, fontWeight: 700, fontSize: 11, padding: "1px 5px", flexShrink: 0 }}>{sc.val}</span>
                        <span style={{ fontSize: 12, color: "#374151", lineHeight: 1.4 }}>{criteria[sc.val]}</span>
                      </div>
                    ))}
                  </div>
                )}
                {!isNA && (
                  <textarea placeholder="Comments (optional)..." value={item.comment} onChange={e => updItem(secIdx, ii, "comment", e.target.value)} rows={2}
                    style={{ width: "100%", padding: "8px 10px", border: "1px solid #E2E8F0", borderRadius: 8, fontSize: 13, resize: "none", boxSizing: "border-box", fontFamily: "inherit", marginBottom: needsAction ? 8 : 0 }} />
                )}
                {needsAction && !isNA && (
                  <>
                    <input placeholder={item.score === 1 ? "Action item (required)..." : "Action item (optional)..."} value={item.actionItem}
                      onChange={e => updItem(secIdx, ii, "actionItem", e.target.value)}
                      style={{ width: "100%", padding: "8px 10px", border: `1px solid ${missingAction ? "#DC2626" : "#E2E8F0"}`, borderRadius: 8, fontSize: 13, boxSizing: "border-box", fontFamily: "inherit" }} />
                  </>
                )}
              </div>
            );
          })}
          {/* Validate score 1 items have action items before advancing */}
          {(() => {
            const missingItems = sec.items.filter(i => i.score === 1 && !i.actionItem?.trim());
            const canAdvance = missingItems.length === 0;
            return (
              <button onClick={() => canAdvance && setStep(s => s + 1)} style={{ width: "100%", background: canAdvance ? "#003A6B" : "#CBD5E1", color: "white", border: "none", borderRadius: 12, padding: 15, fontSize: 16, fontWeight: 600, cursor: canAdvance ? "pointer" : "default", marginTop: 4 }}>
                {!canAdvance ? `Add action item${missingItems.length > 1 ? "s" : ""} for ${missingItems.length} item${missingItems.length > 1 ? "s" : ""} scored 1` : secIdx + 1 === numSec ? "Review audit →" : "Next section →"}
              </button>
            );
          })()}
        </div>
      </div>
    );
  }

  if (inReview) {
    const fs = calcScore(audit);
    return (
      <div style={{ padding: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
          <button onClick={() => setStep(s => s - 1)} style={{ background: "none", border: "none", color: "#64748B", cursor: "pointer", padding: 0 }}><i className="ti ti-arrow-left" style={{ fontSize: 22 }} /></button>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#0F172A" }}>Review & Submit</h2>
        </div>
        <div style={{ background: "white", borderRadius: 16, border: "0.5px solid #E2E8F0", padding: 20, marginBottom: 20, display: "flex", alignItems: "center", gap: 20 }}>
          <Ring pct={fs.pct} size={80} />
          <div>
            <div style={{ fontWeight: 700, fontSize: 20, color: "#0F172A" }}>{audit.site}</div>
            <div style={{ fontSize: 13, color: "#64748B" }}>{tmpl.label} · {fmt(audit.date)}</div>
            <div style={{ fontSize: 13, color: "#64748B" }}>By {audit.auditorName} ({audit.auditorSite})</div>
            {fs.weighted && <div style={{ fontSize: 13, color: "#64748B" }}>Weighted score: {fs.total}/4.00</div>}
            {fs.failing > 0 && <div style={{ fontSize: 13, color: "#DC2626", fontWeight: 600, marginTop: 6 }}>⚠ {fs.failing} item{fs.failing !== 1 ? "s" : ""} need improvement — requires team discussion</div>}
          </div>
        </div>
        {audit.sections.map((sec, si) => {
          const ss = calcSectionScore(sec);
          return (
            <div key={si} style={{ background: "white", borderRadius: 12, border: "0.5px solid #E2E8F0", padding: "12px 14px", marginBottom: 8, display: "flex", alignItems: "center" }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 500, fontSize: 14, color: "#1E293B" }}>{sec.name}</div>
                <div style={{ fontSize: 12, color: "#64748B" }}>Avg {ss.avg}/4.00 {sec.weight > 0 ? `· ${Math.round(sec.weight * 100)}% weight` : ""}</div>
              </div>
              <div style={{ width: 46, height: 46, borderRadius: "50%", background: gradeColor(ss.pct) + "18", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 13, color: gradeColor(ss.pct) }}>{ss.pct}%</div>
            </div>
          );
        })}
        {fs.failing > 0 && (
          <div style={{ background: "white", borderRadius: 12, border: "0.5px solid #E2E8F0", padding: 14, marginTop: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#DC2626", marginBottom: 8 }}>
              <i className="ti ti-calendar-due" style={{ marginRight: 6 }} />
              Action items due date ({fs.failing} item{fs.failing !== 1 ? "s" : ""} scored 1)
            </div>
            <div style={{ fontSize: 12, color: "#64748B", marginBottom: 8 }}>Set a due date for all action items requiring improvement:</div>
            <input type="date" value={audit.actionItemDueDate}
              onChange={e => upd("actionItemDueDate", e.target.value)}
              style={{ width: "100%", padding: "10px 12px", border: "1.5px solid #DC2626", borderRadius: 8, fontSize: 15, boxSizing: "border-box", fontFamily: "inherit" }} />
          </div>
        )}
        <button onClick={handleSubmit} style={{ width: "100%", background: "#003A6B", color: "white", border: "none", borderRadius: 12, padding: 16, fontSize: 16, fontWeight: 700, cursor: "pointer", marginTop: 10 }}>Submit audit ✓</button>
      </div>
    );
  }
  return null;
};

// ─────────────────────────── DETAIL VIEW ───────────────────────────

const Detail = ({ audit, prevAudit, onBack }) => {
  const [activeTab, setActiveTab] = useState("scores");
  const s = calcScore(audit), ps = prevAudit ? calcScore(prevAudit) : null, delta = ps ? s.pct - ps.pct : null;
  const allActions = audit.sections.flatMap(sec => sec.items.filter(i => i.actionItem).map(i => ({ ...i, sectionName: sec.name })));
  return (
    <div>
      <div style={{ background: "#003A6B", padding: "14px 16px 20px" }}>
        <button onClick={onBack} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.65)", cursor: "pointer", padding: 0, marginBottom: 14, display: "flex", alignItems: "center", gap: 4, fontSize: 14 }}><i className="ti ti-arrow-left" /> Back</button>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 18 }}>
          <Ring pct={s.pct} size={76} />
          <div style={{ color: "white" }}>
            <div style={{ fontWeight: 700, fontSize: 20, marginBottom: 2 }}>{audit.site}</div>
            <TypeBadge type={audit.type} />
            <div style={{ fontSize: 13, opacity: 0.8, marginTop: 4 }}>{fmt(audit.date)}</div>
            <div style={{ fontSize: 13, opacity: 0.8 }}>By {audit.auditorName} ({audit.auditorSite})</div>
            {s.weighted ? <div style={{ fontSize: 13, opacity: 0.8 }}>Weighted: {s.total}/4.00</div> : <div style={{ fontSize: 13, opacity: 0.8 }}>{s.total}/{s.max} pts</div>}
            {ps && <div style={{ marginTop: 8, fontSize: 12, color: delta >= 0 ? "#86EFAC" : "#FCA5A5" }}>vs previous {ps.pct}% → {delta >= 0 ? `+${delta}% ↑ improved` : `${delta}% ↓ declined`}</div>}
          </div>
        </div>
      </div>
      <div style={{ display: "flex", borderBottom: "1px solid #E2E8F0", background: "white" }}>
        {[["scores","Scores"],["actions",`Actions (${allActions.length})`]].map(([id, label]) => (
          <button key={id} onClick={() => setActiveTab(id)} style={{ flex: 1, padding: "12px 8px", background: "white", border: "none", borderBottom: activeTab === id ? "2px solid #003A6B" : "2px solid transparent", color: activeTab === id ? "#003A6B" : "#64748B", fontWeight: 600, fontSize: 14, cursor: "pointer" }}>{label}</button>
        ))}
      </div>
      <div style={{ padding: 16 }}>
        {activeTab === "scores" && (<>
          {s.failing > 0 && (<div style={{ background: "#FEE2E2", border: "0.5px solid #FECACA", borderRadius: 10, padding: "10px 14px", marginBottom: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: "#7F1D1D", marginBottom: 4 }}>⚠ Items scored 1 (Needs Improvement) — must be discussed as a team</div>
            <div style={{ fontSize: 12, color: "#991B1B" }}>{audit.sections.flatMap(sec => sec.items.filter(i => i.score === 1).map(i => i.name)).join(" · ")}</div>
          </div>)}
          {audit.sections.map((sec, si) => {
            const ss = calcSectionScore(sec), prevSec = prevAudit?.sections?.[si], prevSs = prevSec ? calcSectionScore(prevSec) : null;
            return (<div key={si} style={{ marginBottom: 18 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#1E293B" }}>{sec.name}</h3>
                  {sec.weight > 0 && <span style={{ fontSize: 11, color: "#94A3B8" }}>{Math.round(sec.weight * 100)}% weight</span>}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {prevSs && <Delta d={ss.pct - prevSs.pct} />}
                  <span style={{ fontSize: 14, fontWeight: 700, color: gradeColor(ss.pct) }}>{ss.avg}/4</span>
                </div>
              </div>
              {sec.items.map((item, ii) => {
                const borderCol = item.score === 1 ? "#DC2626" : item.score === null ? "#CBD5E1" : item.score === 4 ? "#16A34A" : item.score === 3 ? "#0369A1" : "#D97706";
                return (
                  <div key={ii} style={{ background: "white", borderRadius: 10, border: "0.5px solid #E2E8F0", borderLeft: `3px solid ${borderCol}`, padding: "10px 12px", marginBottom: 8 }}>
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: item.comment || item.actionItem ? 6 : 0 }}>
                      <span style={{ fontSize: 13, color: "#374151", lineHeight: 1.4 }}>{item.name}</span>
                      <Pill val={item.score} />
                    </div>
                    {item.comment && <div style={{ fontSize: 12, color: "#64748B", fontStyle: "italic" }}>"{item.comment}"</div>}
                    {item.actionItem && <div style={{ fontSize: 12, color: "#EA580C", marginTop: 4 }}><i className="ti ti-arrow-right" style={{ fontSize: 11 }} /> {item.actionItem}</div>}
                  </div>
                );
              })}
            </div>);
          })}
        </>)}
        {activeTab === "actions" && (allActions.length === 0 ? <div style={{ textAlign: "center", padding: "40px 16px", color: "#94A3B8" }}>No action items recorded.</div>
        : allActions.map((item, i) => (
          <div key={i} style={{ background: "white", borderRadius: 12, border: "0.5px solid #E2E8F0", padding: 14, marginBottom: 10 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#94A3B8", letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 4 }}>{item.sectionName}</div>
            <div style={{ fontSize: 14, color: "#1E293B", fontWeight: 600, marginBottom: 6 }}>{item.name}</div>
            <div style={{ fontSize: 13, color: "#EA580C", marginBottom: item.actionDue ? 4 : 6 }}><i className="ti ti-arrow-right" style={{ fontSize: 12 }} /> {item.actionItem}</div>
            {item.actionDue && <div style={{ fontSize: 12, color: "#DC2626", fontWeight: 600, marginBottom: 6 }}><i className="ti ti-calendar" style={{ fontSize: 12 }} /> Action due: {fmt(item.actionDue)}</div>}
            <Pill val={item.score} />
          </div>
        )))}
      </div>
    </div>
  );
};

// ─────────────────────────── HISTORY ───────────────────────────

const History = ({ audits, onView }) => {
  const [filter, setFilter] = useState("all");
  const [view, setView] = useState("site"); // "site" | "list"

  const prevFor = (audit) => audits
    .filter(a => a.site === audit.site && a.type === audit.type && a.id !== audit.id && a.submittedAt < audit.submittedAt)
    .sort((a, b) => b.submittedAt - a.submittedAt)[0];

  const filtered = [...audits].filter(a => filter === "all" || a.type === filter);
  const sorted = filtered.sort((a, b) => b.submittedAt - a.submittedAt);

  return (
    <div style={{ padding: 16 }}>
      {/* Resume draft banner */}
      {hasDraft && (
        <div style={{ background: "#FFF7ED", border: "0.5px solid #FED7AA", borderRadius: 10, padding: "10px 14px", marginBottom: 16, display: "flex", alignItems: "center", gap: 10 }}>
          <i className="ti ti-device-floppy" style={{ fontSize: 20, color: "#EA580C", flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: 14, color: "#7C2D12" }}>Unsaved audit draft</div>
            <div style={{ fontSize: 12, color: "#9A3412" }}>{draft.audit.type} · {draft.audit.site || "No site selected"} · Auto-saved</div>
          </div>
          <button onClick={() => onResumeDraft(draft.audit.type)} style={{ background: "#EA580C", color: "white", border: "none", borderRadius: 8, padding: "6px 12px", fontSize: 13, fontWeight: 600, cursor: "pointer", flexShrink: 0 }}>Resume</button>
        </div>
      )}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
        <div style={{ display: "flex", gap: 8 }}>
          {[["all","All"],["OA","OA"],["SA","SA"]].map(([v, l]) => (
            <button key={v} onClick={() => setFilter(v)} style={{ padding: "7px 14px", borderRadius: 20, background: filter === v ? "#003A6B" : "white", color: filter === v ? "white" : "#374151", border: "0.5px solid #D1D5DB", fontSize: 13, fontWeight: 500, cursor: "pointer" }}>{l}</button>
          ))}
        </div>
        <div style={{ display: "flex", background: "#F1F5F9", borderRadius: 8, padding: 2 }}>
          {[["site", "ti-folder"],["list", "ti-list"]].map(([v, icon]) => (
            <button key={v} onClick={() => setView(v)} style={{ padding: "5px 10px", borderRadius: 6, border: "none", background: view === v ? "white" : "transparent", color: view === v ? "#003A6B" : "#94A3B8", cursor: "pointer", boxShadow: view === v ? "0 1px 3px rgba(0,0,0,0.1)" : "none" }}>
              <i className={`ti ${icon}`} style={{ fontSize: 16 }} />
            </button>
          ))}
        </div>
      </div>

      {sorted.length === 0 ? (
        <div style={{ textAlign: "center", padding: "48px 16px", color: "#94A3B8" }}>No audits found.</div>
      ) : view === "site" ? (
        <SiteFolders audits={filtered} onView={onView} prevFor={prevFor} />
      ) : (
        sorted.map(audit => {
          const s = calcScore(audit);
          return (
            <button key={audit.id} onClick={() => onView(audit)} style={{ width: "100%", background: "white", border: "0.5px solid #E2E8F0", borderRadius: 12, padding: 14, marginBottom: 10, textAlign: "left", cursor: "pointer", display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 50, height: 50, borderRadius: "50%", background: gradeColor(s.pct) + "18", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 14, color: gradeColor(s.pct), flexShrink: 0 }}>{s.pct}%</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}><span style={{ fontWeight: 600, fontSize: 14, color: "#0F172A", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{audit.site || "—"}</span><TypeBadge type={audit.type} /></div>
                <div style={{ fontSize: 12, color: "#64748B" }}>{fmt(audit.date)} · {audit.auditorName}</div>
                {s.failing > 0 && <div style={{ fontSize: 11, color: "#DC2626", fontWeight: 600, marginTop: 2 }}>⚠ {s.failing} need improvement</div>}
              </div>
              <i className="ti ti-chevron-right" style={{ fontSize: 16, color: "#CBD5E1", flexShrink: 0 }} />
            </button>
          );
        })
      )}
    </div>
  );
};

// ─────────────────────────── SITE DASHBOARD ───────────────────────────

const Benchmark = ({ audits }) => {
  const [expanded, setExpanded] = useState({});
  const toggle = (site) => setExpanded(p => ({ ...p, [site]: !p[site] }));

  // Build per-site data
  const siteData = SITES.map(site => {
    const siteAudits = audits.filter(a => a.site === site);
    const oaAudits = [...siteAudits.filter(a => a.type === "OA")].sort((a, b) => b.submittedAt - a.submittedAt);
    const saAudits = [...siteAudits.filter(a => a.type === "SA")].sort((a, b) => b.submittedAt - a.submittedAt);
    const latestOA = oaAudits[0] || null;
    const prevOA = oaAudits[1] || null;
    const latestSA = saAudits[0] || null;
    const oaScore = latestOA ? calcScore(latestOA) : null;
    const saScore = latestSA ? calcScore(latestSA) : null;
    const oaDelta = latestOA && prevOA ? oaScore.pct - calcScore(prevOA).pct : null;
    // Section breakdown for latest OA
    const oaSections = latestOA ? latestOA.sections.map(sec => ({ ...calcSectionScore(sec), name: sec.name, weight: sec.weight })) : [];
    return { site, siteAudits, latestOA, latestSA, oaScore, saScore, oaDelta, oaSections };
  });

  const totalAudits = audits.length;
  const sitesWithAudits = siteData.filter(s => s.siteAudits.length > 0).length;
  const overallAvg = audits.length ? Math.round(audits.reduce((s, a) => s + calcScore(a).pct, 0) / audits.length) : 0;

  return (
    <div style={{ padding: 16 }}>
      {/* Header stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 20 }}>
        {[
          { label: "Total audits", val: totalAudits, color: "#003A6B" },
          { label: "Overall avg", val: `${overallAvg}%`, color: gradeColor(overallAvg) },
          { label: "Sites active", val: `${sitesWithAudits}/${SITES.length}`, color: "#003A6B" }
        ].map(st => (
          <div key={st.label} style={{ background: "white", borderRadius: 12, padding: "12px 10px", border: "0.5px solid #E2E8F0", textAlign: "center" }}>
            <div style={{ fontWeight: 700, fontSize: 20, color: st.color, lineHeight: 1.1 }}>{st.val}</div>
            <div style={{ fontSize: 11, color: "#64748B", marginTop: 3 }}>{st.label}</div>
          </div>
        ))}
      </div>

      <div style={{ fontSize: 11, fontWeight: 700, color: "#94A3B8", letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 12 }}>All sites</div>

      {siteData.map(({ site, siteAudits, latestOA, latestSA, oaScore, saScore, oaDelta, oaSections }) => {
        const hasData = siteAudits.length > 0;
        const isOpen = !!expanded[site];

        return (
          <div key={site} style={{ marginBottom: 10 }}>
            {/* Site header card */}
            <button onClick={() => hasData && toggle(site)} style={{
              width: "100%", background: "white", border: "0.5px solid #E2E8F0",
              borderRadius: isOpen ? "12px 12px 0 0" : 12, padding: "12px 14px",
              textAlign: "left", cursor: hasData ? "pointer" : "default",
              display: "flex", alignItems: "center", gap: 12,
              borderBottom: isOpen ? "0.5px solid #F1F5F9" : "0.5px solid #E2E8F0"
            }}>
              {/* Site name */}
              <div style={{ width: 40, height: 40, borderRadius: 10, background: hasData ? gradeColor(oaScore?.pct || saScore?.pct || 0) + "15" : "#F1F5F9", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <span style={{ fontWeight: 800, fontSize: 13, color: hasData ? gradeColor(oaScore?.pct || saScore?.pct || 0) : "#CBD5E1" }}>{site}</span>
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                {!hasData ? (
                  <div style={{ fontSize: 13, color: "#CBD5E1" }}>No audits yet</div>
                ) : (
                  <>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      {oaScore && (
                        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          <TypeBadge type="OA" />
                          <span style={{ fontWeight: 700, fontSize: 14, color: gradeColor(oaScore.pct) }}>{oaScore.pct}%</span>
                          {oaDelta !== null && <Delta d={oaDelta} />}
                        </div>
                      )}
                      {saScore && (
                        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          <TypeBadge type="SA" />
                          <span style={{ fontWeight: 700, fontSize: 14, color: gradeColor(saScore.pct) }}>{saScore.pct}%</span>
                        </div>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: "#94A3B8" }}>{siteAudits.length} audit{siteAudits.length !== 1 ? "s" : ""} total · Latest: {fmt(siteAudits.sort((a,b) => b.submittedAt - a.submittedAt)[0]?.date)}</div>
                  </>
                )}
              </div>

              {hasData && <i className={`ti ${isOpen ? "ti-chevron-up" : "ti-chevron-down"}`} style={{ fontSize: 16, color: "#CBD5E1", flexShrink: 0 }} />}
            </button>

            {/* Expanded detail */}
            {isOpen && hasData && (
              <div style={{ background: "#FAFBFC", border: "0.5px solid #E2E8F0", borderTop: "none", borderRadius: "0 0 12px 12px", padding: 14 }}>

                {/* OA Section breakdown */}
                {latestOA && oaSections.length > 0 && (
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#1D4ED8", marginBottom: 8 }}>OA — {fmt(latestOA.date)} · Weighted score: {calcScore(latestOA).total}/4.00</div>
                    {oaSections.map((sec, i) => (
                      <div key={i} style={{ marginBottom: 8 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                          <span style={{ fontSize: 12, color: "#374151", fontWeight: 500 }}>{sec.name} <span style={{ color: "#94A3B8", fontWeight: 400 }}>({Math.round(sec.weight * 100)}%)</span></span>
                          <span style={{ fontSize: 12, fontWeight: 700, color: gradeColor(sec.pct) }}>{sec.avg}/4</span>
                        </div>
                        <div style={{ background: "#E2E8F0", borderRadius: 4, height: 7, overflow: "hidden" }}>
                          <div style={{ height: 7, borderRadius: 4, background: gradeColor(sec.pct), width: `${sec.pct}%` }} />
                        </div>
                      </div>
                    ))}
                    {calcScore(latestOA).failing > 0 && (
                      <div style={{ fontSize: 12, color: "#DC2626", fontWeight: 600, marginTop: 6 }}>
                        ⚠ {calcScore(latestOA).failing} item{calcScore(latestOA).failing !== 1 ? "s" : ""} need improvement
                      </div>
                    )}
                  </div>
                )}

                {/* SA summary */}
                {latestSA && (
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#7C3AED", marginBottom: 8 }}>SA — {fmt(latestSA.date)}</div>
                    {latestSA.sections.map((sec, i) => {
                      const ss = calcSectionScore(sec);
                      return (
                        <div key={i} style={{ marginBottom: 8 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                            <span style={{ fontSize: 12, color: "#374151", fontWeight: 500 }}>{sec.name}</span>
                            <span style={{ fontSize: 12, fontWeight: 700, color: gradeColor(ss.pct) }}>{ss.avg}/4</span>
                          </div>
                          <div style={{ background: "#E2E8F0", borderRadius: 4, height: 7, overflow: "hidden" }}>
                            <div style={{ height: 7, borderRadius: 4, background: gradeColor(ss.pct), width: `${ss.pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Score guide */}
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 6 }}>
                  {[["#16A34A","≥80% Good"],["#D97706","60–79% OK"],["#EA580C","40–59% Work"],["#DC2626","<40% Critical"]].map(([c,l]) => (
                    <div key={l} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: c }} />
                      <span style={{ fontSize: 10, color: "#64748B" }}>{l}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

// ─────────────────────────── TEAM ───────────────────────────

const Team = ({ audits }) => {
  const people = {};
  audits.forEach(a => { const key = `${a.auditorName}||${a.auditorSite}`; if (!people[key]) people[key] = { name: a.auditorName, site: a.auditorSite, audits: [] }; people[key].audits.push(a); });
  const list = Object.values(people).sort((a, b) => b.audits.length - a.audits.length);
  const colors = ["#003A6B","#7C3AED","#0D9488","#DC2626","#D97706","#16A34A","#0369A1","#BE185D"];
  const initials = (n) => (n || "?").split(" ").map(x => x[0]).join("").substring(0, 2).toUpperCase();
  return (
    <div style={{ padding: 16 }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0F172A", marginBottom: 4 }}>MAU team</h2>
      <p style={{ fontSize: 13, color: "#64748B", margin: "0 0 20px" }}>Auditors across all sites</p>
      {list.length === 0 ? <div style={{ textAlign: "center", padding: "48px 16px", color: "#94A3B8" }}>No auditors yet.</div>
      : list.map((person, i) => {
        const avg = Math.round(person.audits.reduce((s, a) => s + calcScore(a).pct, 0) / person.audits.length);
        const siteCount = new Set(person.audits.map(a => a.site)).size;
        return (
          <div key={i} style={{ background: "white", borderRadius: 12, border: "0.5px solid #E2E8F0", padding: 14, marginBottom: 10, display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 48, height: 48, borderRadius: "50%", background: colors[i % colors.length], display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: 700, fontSize: 15, flexShrink: 0 }}>{initials(person.name)}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 15, color: "#0F172A", marginBottom: 2 }}>{person.name || "—"}</div>
              <div style={{ fontSize: 13, color: "#64748B", marginBottom: 3 }}>{person.site}</div>
              <div style={{ fontSize: 12, color: "#94A3B8" }}>{person.audits.length} audit{person.audits.length !== 1 ? "s" : ""} · {siteCount} site{siteCount !== 1 ? "s" : ""} visited</div>
            </div>
            <div style={{ padding: "6px 12px", borderRadius: 10, background: gradeColor(avg) + "18", color: gradeColor(avg), fontWeight: 700, fontSize: 16 }}>{avg}%</div>
          </div>
        );
      })}
    </div>
  );
};

// ─────────────────────────── TRAINING ───────────────────────────

const OA_PPO = {
  title: "Operations Audit PPO",
  type: "OA",
  purpose: "Evaluate workplace operations performance and ensure compliance.",
  inputs: "Operations Audit conducted using the audit template, operational data, and site observations.",
  output: "Audit completed with findings documented, corrective actions assigned.",
  sections: [
    {
      name: "Safety Performance",
      who: "Auditor", timing: "During Audit",
      why: "Verify that MAU is meeting safety, housekeeping and performance expectations while working on the production floor.",
      steps: [
        { label: "Accountabilities / KPIs", detail: "Refer to KPI on the M: Drive to break down the safety performance for the site." },
        { label: "Maintain Performance Standards", detail: "Refer to the KPI to ensure targets are being met and maintained." },
        { label: "Accountability", detail: "Confirm with SM that STD works are being completed." },
        { label: "Housekeeping", detail: "Check while on SFT to ensure it is kept to standard." }
      ]
    },
    {
      name: "Process Discipline",
      who: "Auditor", timing: "During Audit",
      why: "Confirm MAU follows site procedures, permit requirements, PPE rules, and standard work to reduce risk around production equipment and plant operations.",
      steps: [
        { label: "Process Compliance", detail: "Verify that MAU process aligns with the process the customer set in place." },
        { label: "Process Checks", detail: "Check SOPs to ensure the proper work is being performed." },
        { label: "Action Registries", detail: "Check MAU action registers to ensure actions are being taken and closed." },
        { label: "Connected Checking", detail: "Check in with the customer to see if there are any concerns." },
        { label: "Deadlines", detail: "Ensure all deadlines are met with MAU and/or the customer." }
      ]
    },
    {
      name: "Process Improvement",
      who: "Auditor", timing: "During Audit on the floor",
      why: "Identify improvement opportunities before they become safety, quality, downtime, or compliance issues, and support proactive corrective actions.",
      steps: [
        { label: "4 SPS", detail: "Audit the most previous 4SPS to verify that each step is completed correctly." },
        { label: "Process Improvements", detail: "Verify that process improvements are being made and what processes have been improved." },
        { label: "Proactive Improvements", detail: "Check KPIs and action registers to ensure proactive measures are taking place." }
      ]
    },
    {
      name: "Relationships",
      who: "Auditor", timing: "During Audit on the floor",
      why: "Ensure that MAU communicates effectively with Michelin contacts, production teams, and site leadership.",
      steps: [
        { label: "Customer Engagement", detail: "During SFT check to see how customer engagement amongst MAU leadership." },
        { label: "Site Growth", detail: "Check KPIs to see if site progression aligns." },
        { label: "Associate Engagement", detail: "During SFT check to see if employee/manager engagement aligns." },
        { label: "FTR Relationships", detail: "Converse with and observe FTRs." }
      ]
    },
    {
      name: "Records",
      who: "Auditor", timing: "During Audit in the Operations office",
      why: "Maintain accurate proof of training, work hours, expenses, meetings, and action closure to support traceability, accountability, and audit readiness.",
      steps: [
        { label: "Training Records", detail: "Check to make sure the proper training records are up to date and correct." },
        { label: "Hours Tracker", detail: "Check on the M Drive to see if the tracker is up to date." },
        { label: "Expense Tracker", detail: "Check on M Drive if the expense tracker is being updated monthly." },
        { label: "KPI Meeting", detail: "Check previous KPIs to see what progression is being made month after month." }
      ]
    }
  ]
};

const SA_PPO = {
  title: "Safety Audit PPO",
  type: "SA",
  purpose: "Evaluate workplace safety performance and ensure compliance.",
  inputs: "Safety Audit conducted using the audit template, safety data, and site observations.",
  output: "Audit completed with findings documented, corrective actions assigned.",
  sections: [
    {
      name: "Employee Engagement",
      who: "Auditor", timing: "During Audit on the floor",
      why: "Ensure associates know evacuation points, understand alarm types, follow spill response procedures, and can access the SDS book when needed.",
      steps: [
        { label: "Evacuation gathering point", detail: "Associate knows exterior and interior meeting points." },
        { label: "Fire/weather alarm differences", detail: "Associate can explain the difference — including the length of the alarms." },
        { label: "Spill control protocol", detail: "Associate knows where to find felt to control the spill and who needs to be notified." },
        { label: "How to access a SDS", detail: "Associate knows where the SDS book is located." }
      ]
    },
    {
      name: "Injury / Illness",
      who: "Auditor", timing: "During Audit on the floor and Operations Office",
      why: "Ensure the process is still updated and to try to prevent the same injury from happening again.",
      steps: [
        { label: "Review last injury/illness", detail: "Review 4 Step from the incident to verify the correct actions were given to address the root cause." },
        { label: "Follow the Flow Chart?", detail: "Review last incident — did we follow the Incident Response Flowchart?" },
        { label: "Follow all protocols?", detail: "Review last incident against the Incident Investigation Checklist." },
        { label: "Deadlines met?", detail: "Check ICI to see if all actions from last injury are completed." }
      ]
    },
    {
      name: "PPE",
      who: "Auditor", timing: "During Audit on the floor",
      why: "Ensure correct PPE is being ordered and ensure associates are using the correct PPE.",
      steps: [
        { label: "PPE Audits", detail: "Verify PPE audits are being conducted regularly." },
        { label: "PPE Expenses being tracked", detail: "If being tracked, check the M Drive to view the PPE expense tracker." },
        { label: "PPE Usage on the floor", detail: "Associates are wearing the correct PPE on the production floor." },
        { label: "PPE consumption being tracked", detail: "Review weekly inventory tracker." }
      ]
    },
    {
      name: "Hazard Prevention",
      who: "Auditor", timing: "During Audit",
      why: "Ensure safety procedures in place are effective, still pertain to the job being performed, and correct PPE requirements are up to date and effective.",
      steps: [
        { label: "JSA completed", detail: "Check M Drive for updated JSA for each position." },
        { label: "JSA effective", detail: "Pull a random JSA and go to the floor to see if it is effective." },
        { label: "PPE effectiveness reviewed", detail: "While doing your Gemba, observe associates wearing PPE." },
        { label: "Gemba walks being performed", detail: "Check observations and findings log." }
      ]
    },
    {
      name: "Incident & Records Review",
      who: "Auditor", timing: "During Audit — Login to ICI Live",
      why: "Ensure complete and accurate training records and protocols are being kept up to date, and ensure observations are occurring so any issues are caught and corrected before they become a problem.",
      steps: [
        { label: "OSHA training records", detail: "Review OSHA training records for completeness." },
        { label: "BBS Observations up to date", detail: "Check observation tracker." },
        { label: "Training records for last 5 associates hired", detail: "Check for onboarding documents, validations, drug screen, HV (if required)." },
        { label: "Review last 3 incidents", detail: "Login into ICI and check that all sections are completed on the incident investigation checklist." }
      ]
    }
  ]
};

const Training = () => {
  const [openDoc, setOpenDoc] = useState(null);
  const [openSections, setOpenSections] = useState({});

  const toggleSection = (key) => setOpenSections(p => ({ ...p, [key]: !p[key] }));

  const PPO = ({ doc }) => (
    <div style={{ marginBottom: 16 }}>
      {/* Doc header */}
      <button onClick={() => setOpenDoc(openDoc === doc.type ? null : doc.type)} style={{
        width: "100%", background: "white", border: "0.5px solid #E2E8F0",
        borderRadius: openDoc === doc.type ? "12px 12px 0 0" : 12,
        borderBottom: openDoc === doc.type ? "0.5px solid #F1F5F9" : "0.5px solid #E2E8F0",
        padding: "14px 16px", textAlign: "left", cursor: "pointer",
        display: "flex", alignItems: "center", gap: 14
      }}>
        <div style={{ width: 44, height: 44, borderRadius: 10, background: doc.type === "OA" ? "#DBEAFE" : "#EDE9FE", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <i className={`ti ${doc.type === "OA" ? "ti-clipboard-list" : "ti-shield-check"}`} style={{ fontSize: 22, color: doc.type === "OA" ? "#1D4ED8" : "#7C3AED" }} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: "#0F172A", marginBottom: 2 }}>{doc.title}</div>
          <div style={{ fontSize: 12, color: "#64748B" }}>{doc.sections.length} sections · Tap to read</div>
        </div>
        <TypeBadge type={doc.type} />
        <i className={`ti ${openDoc === doc.type ? "ti-chevron-up" : "ti-chevron-down"}`} style={{ fontSize: 16, color: "#CBD5E1" }} />
      </button>

      {openDoc === doc.type && (
        <div style={{ background: "#FAFBFC", border: "0.5px solid #E2E8F0", borderTop: "none", borderRadius: "0 0 12px 12px" }}>
          {/* Purpose & Inputs */}
          <div style={{ padding: "14px 16px", borderBottom: "0.5px solid #F1F5F9" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>Purpose</div>
            <div style={{ fontSize: 13, color: "#374151", lineHeight: 1.5, marginBottom: 10 }}>{doc.purpose}</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>Inputs</div>
            <div style={{ fontSize: 13, color: "#374151", lineHeight: 1.5 }}>{doc.inputs}</div>
          </div>

          {/* Sections */}
          {doc.sections.map((sec, si) => {
            const key = `${doc.type}-${si}`;
            const isOpen = !!openSections[key];
            return (
              <div key={si} style={{ borderBottom: si < doc.sections.length - 1 ? "0.5px solid #F1F5F9" : "none" }}>
                <button onClick={() => toggleSection(key)} style={{
                  width: "100%", background: "none", border: "none", padding: "12px 16px",
                  textAlign: "left", cursor: "pointer", display: "flex", alignItems: "center", gap: 10
                }}>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: doc.type === "OA" ? "#1D4ED8" : "#7C3AED", flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 14, color: "#1E293B" }}>{sec.name}</div>
                    <div style={{ fontSize: 11, color: "#94A3B8" }}>{sec.who} · {sec.timing}</div>
                  </div>
                  <i className={`ti ${isOpen ? "ti-chevron-up" : "ti-chevron-down"}`} style={{ fontSize: 14, color: "#CBD5E1", flexShrink: 0 }} />
                </button>

                {isOpen && (
                  <div style={{ padding: "0 16px 14px 16px" }}>
                    <div style={{ background: doc.type === "OA" ? "#EFF6FF" : "#F5F3FF", borderRadius: 8, padding: "8px 12px", marginBottom: 12 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: doc.type === "OA" ? "#1D4ED8" : "#7C3AED", marginBottom: 3 }}>WHY</div>
                      <div style={{ fontSize: 12, color: "#374151", lineHeight: 1.5 }}>{sec.why}</div>
                    </div>
                    {sec.steps.map((step, i) => (
                      <div key={i} style={{ display: "flex", gap: 10, marginBottom: 10 }}>
                        <div style={{ width: 22, height: 22, borderRadius: "50%", background: doc.type === "OA" ? "#DBEAFE" : "#EDE9FE", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
                          <span style={{ fontSize: 10, fontWeight: 700, color: doc.type === "OA" ? "#1D4ED8" : "#7C3AED" }}>{i + 1}</span>
                        </div>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: "#1E293B", marginBottom: 2 }}>{step.label}</div>
                          <div style={{ fontSize: 12, color: "#64748B", lineHeight: 1.4 }}>{step.detail}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {/* Output */}
          <div style={{ padding: "12px 16px", background: "#F0FDF4", borderRadius: "0 0 12px 12px" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#16A34A", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 4 }}>Output</div>
            <div style={{ fontSize: 13, color: "#374151" }}>{doc.output}</div>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div style={{ padding: 16 }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0F172A", marginBottom: 4 }}>Training</h2>
      <p style={{ fontSize: 13, color: "#64748B", margin: "0 0 20px" }}>Process & Procedure documents for conducting site audits</p>
      <PPO doc={OA_PPO} />
      <PPO doc={SA_PPO} />
    </div>
  );
};

// ─────────────────────────── APP SHELL ───────────────────────────

const TABS = [
  { id: "dashboard", label: "Home",     icon: "ti-home" },
  { id: "calendar",  label: "Calendar", icon: "ti-calendar" },
  { id: "benchmark", label: "Compare",  icon: "ti-chart-bar" },
  { id: "team",      label: "Team",     icon: "ti-users" },
  { id: "training",  label: "Training", icon: "ti-book" }
];

export default function App() {
  const [tab, setTab] = useState("dashboard");
  const [audits, setAudits] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newType, setNewType] = useState(null);
  const [detailAudit, setDetailAudit] = useState(null);

  useEffect(() => {
    Promise.all([loadAudits(), loadSchedules()]).then(([a, s]) => { setAudits(a); setSchedules(s); setLoading(false); });
  }, []);

  const handleNew = (type) => { setNewType(type); setTab("new"); };
  const handleResumeDraft = (type) => { setNewType(type); setTab("new"); };
  const handleDone = async (audit) => {
    setSaving(true);
    await saveAudit(audit);
    setAudits(prev => [...prev.filter(a => a.id !== audit.id), audit]);
    setSaving(false); setDetailAudit(audit); setTab("detail"); setNewType(null);
  };
  const handleView = (audit) => { setDetailAudit(audit); setTab("detail"); };
  const handleBack = () => { setDetailAudit(null); setTab("history"); };
  const handleAddSchedule = async (s) => { await saveSchedule(s); setSchedules(prev => [...prev, s]); };
  const handleDeleteSchedule = async (id) => { await deleteSchedule(id); setSchedules(prev => prev.filter(s => s.id !== id)); };
  const prevAudit = (audit) => audits.filter(a => a.site === audit.site && a.type === audit.type && a.id !== audit.id && a.submittedAt < audit.submittedAt).sort((a, b) => b.submittedAt - a.submittedAt)[0] || null;
  const inWizard = tab === "new" || tab === "detail";

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ textAlign: "center", color: "#64748B" }}>
        <div style={{ width: 40, height: 40, border: "3px solid #E2E8F0", borderTopColor: "#003A6B", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 12px" }} />
        Loading...
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );

  return (
    <div style={{ maxWidth: 430, margin: "0 auto", fontFamily: "system-ui, -apple-system, sans-serif", background: "#F8FAFC", minHeight: "100dvh" }}>
      {!inWizard && (
        <div style={{ background: "#003A6B", padding: "14px 16px 16px", position: "sticky", top: 0, zIndex: 10 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ color: "rgba(255,255,255,0.55)", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 2 }}>MAU Workforce Solutions</div>
              <div style={{ color: "white", fontWeight: 700, fontSize: 18 }}>Site Audit System</div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => handleNew("OA")} style={{ background: "rgba(255,255,255,0.15)", border: "none", borderRadius: 8, padding: "7px 12px", color: "white", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>+ OA</button>
              <button onClick={() => handleNew("SA")} style={{ background: "rgba(255,255,255,0.15)", border: "none", borderRadius: 8, padding: "7px 12px", color: "white", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>+ SA</button>
            </div>
          </div>
        </div>
      )}
      {saving && <div style={{ background: "#003A6B", color: "white", fontSize: 12, textAlign: "center", padding: 6 }}>Saving...</div>}
      <div style={{ paddingBottom: inWizard ? 0 : 68 }}>
        {tab === "dashboard" && <Dashboard audits={audits} schedules={schedules} onNew={handleNew} onView={handleView} onResumeDraft={handleResumeDraft} />}
        {tab === "calendar"  && <CalendarView audits={audits} schedules={schedules} onAddSchedule={handleAddSchedule} onDeleteSchedule={handleDeleteSchedule} />}
        {tab === "new"       && newType && <NewAudit type={newType} onDone={handleDone} onCancel={() => { setNewType(null); setTab("dashboard"); }} />}
        {tab === "history"   && <History audits={audits} onView={handleView} />}
        {tab === "benchmark" && <Benchmark audits={audits} />}
        {tab === "team"      && <Team audits={audits} />}
        {tab === "training"  && <Training />}
        {tab === "detail"    && detailAudit && <Detail audit={detailAudit} prevAudit={prevAudit(detailAudit)} onBack={handleBack} />}
      </div>
      {!inWizard && (
        <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 430, background: "white", borderTop: "0.5px solid #E2E8F0", display: "flex", zIndex: 20 }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{ flex: 1, padding: "10px 0 8px", background: "none", border: "none", color: tab === t.id ? "#003A6B" : "#94A3B8", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
              <i className={`ti ${t.icon}`} style={{ fontSize: 20 }} />
              <span style={{ fontSize: 9, fontWeight: tab === t.id ? 700 : 400 }}>{t.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
