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
      const scored = sec.items.filter(i => i.score !== null && i.score !== undefined);
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
    if (item.score === null || item.score === undefined) return;
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

const Dashboard = ({ audits, schedules, onNew, onView }) => {
  const today = new Date();
  const recent = [...audits].sort((a, b) => b.submittedAt - a.submittedAt).slice(0, 6);
  const avg = audits.length ? Math.round(audits.reduce((s, a) => s + calcScore(a).pct, 0) / audits.length) : 0;
  const totalFailing = audits.reduce((s, a) => s + calcScore(a).failing, 0);
  const sites = new Set(audits.map(a => a.site)).size;
  const overdueCount = schedules.filter(s => {
    const due = new Date(s.dueDate + "T12:00:00");
    if (due >= today) return false;
    return !audits.some(a => a.site === s.site && a.type === s.type && Math.abs(new Date(a.date + "T12:00:00") - due) / 86400000 <= 3);
  }).length;
  const upcomingCount = schedules.filter(s => new Date(s.dueDate + "T12:00:00") >= today).length;
  const prevFor = (audit) => audits.filter(a => a.site === audit.site && a.type === audit.type && a.submittedAt < audit.submittedAt).sort((a, b) => b.submittedAt - a.submittedAt)[0];

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 18 }}>
        {[
          { label: "Audits", val: audits.length, icon: "ti-clipboard-check", color: "#003A6B" },
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
      {totalFailing > 0 && (
        <div style={{ background: "#FEF3C7", border: "0.5px solid #FDE68A", borderRadius: 10, padding: "10px 14px", marginBottom: 12, display: "flex", gap: 10 }}>
          <i className="ti ti-alert-triangle" style={{ fontSize: 20, color: "#D97706", flexShrink: 0, marginTop: 1 }} />
          <div style={{ fontWeight: 600, fontSize: 14, color: "#78350F" }}>{totalFailing} item{totalFailing !== 1 ? "s" : ""} scored 1 — Needs Improvement, require team discussion</div>
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

      <div style={{ fontSize: 11, fontWeight: 600, color: "#94A3B8", letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 12 }}>Recent audits</div>
      {recent.length === 0 ? (
        <div style={{ background: "white", borderRadius: 12, border: "0.5px solid #E2E8F0", padding: "36px 20px", textAlign: "center" }}>
          <i className="ti ti-clipboard" style={{ fontSize: 40, color: "#CBD5E1", display: "block", marginBottom: 10 }} />
          <div style={{ color: "#94A3B8", fontSize: 14 }}>No audits yet. Start your first one above.</div>
        </div>
      ) : recent.map(audit => {
        const s = calcScore(audit);
        const prev = prevFor(audit);
        const delta = prev ? s.pct - calcScore(prev).pct : null;
        return (
          <button key={audit.id} onClick={() => onView(audit)} style={{ width: "100%", background: "white", border: "0.5px solid #E2E8F0", borderRadius: 12, padding: 14, marginBottom: 10, textAlign: "left", cursor: "pointer", display: "flex", alignItems: "center", gap: 14 }}>
            <Ring pct={s.pct} size={58} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                <span style={{ fontWeight: 600, fontSize: 15, color: "#0F172A", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{audit.site || "—"}</span>
                <TypeBadge type={audit.type} />
              </div>
              <div style={{ fontSize: 12, color: "#64748B", marginBottom: 4 }}>{fmt(audit.date)} · {audit.auditorName || "—"}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {s.weighted ? <span style={{ fontSize: 12, color: "#64748B" }}>Weighted: {s.total}/4.00</span> : <span style={{ fontSize: 12, color: "#64748B" }}>{s.total}/{s.max} pts</span>}
                {s.failing > 0 && <span style={{ fontSize: 11, color: "#DC2626", fontWeight: 600 }}>⚠ {s.failing} need improvement</span>}
                <Delta d={delta} />
              </div>
            </div>
            <i className="ti ti-chevron-right" style={{ fontSize: 16, color: "#CBD5E1", flexShrink: 0 }} />
          </button>
        );
      })}
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

  const handleSave = () => {
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

      <button onClick={() => setShowForm(!showForm)} style={{ width: "100%", background: showForm ? "#64748B" : "#003A6B", color: "white", border: "none", borderRadius: 12, padding: 14, fontSize: 15, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
        <i className={`ti ${showForm ? "ti-x" : "ti-calendar-plus"}`} style={{ fontSize: 18 }} />
        {showForm ? "Cancel" : "Schedule an audit"}
      </button>

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

const NewAudit = ({ type, onDone, onCancel }) => {
  const [step, setStep] = useState(0);
  const [audit, setAudit] = useState(() => createEmpty(type));
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

  if (step === 0) return (
    <div style={{ padding: 16 }}>
      <button onClick={onCancel} style={{ background: "none", border: "none", color: "#64748B", cursor: "pointer", padding: 0, marginBottom: 20, display: "flex", alignItems: "center", gap: 4, fontSize: 14 }}><i className="ti ti-arrow-left" /> Cancel</button>
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
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 28 }}>
        <div><label style={lbl}>Audit date</label><input type="date" value={audit.date} onChange={e => upd("date", e.target.value)} style={inp} /></div>
        <div><label style={lbl}>Action items due</label><input type="date" value={audit.actionItemDueDate} onChange={e => upd("actionItemDueDate", e.target.value)} style={inp} /></div>
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
            const borderCol = item.score === 1 ? "#DC2626" : item.score === null ? "#E2E8F0" : item.score === 4 ? "#16A34A" : item.score === 3 ? "#0369A1" : "#D97706";
            return (
              <div key={ii} style={{ background: "white", borderRadius: 12, border: "0.5px solid #E2E8F0", borderLeft: `3px solid ${borderCol}`, padding: 14, marginBottom: 12 }}>
                <p style={{ margin: "0 0 10px", fontWeight: 600, fontSize: 14, color: "#1E293B", lineHeight: 1.4 }}>{item.name}</p>
                <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                  {SCORES.map(sc => (
                    <button key={sc.val} onClick={() => { updItem(secIdx, ii, "score", item.score === sc.val ? null : sc.val); setExpandedCriteria(null); }}
                      style={{ flex: 1, padding: "8px 0", border: `2px solid ${item.score === sc.val ? sc.color : "#E2E8F0"}`, borderRadius: 8, background: item.score === sc.val ? sc.bg : "white", color: item.score === sc.val ? sc.text : "#94A3B8", fontWeight: 700, fontSize: 16, cursor: "pointer" }}>{sc.val}</button>
                  ))}
                </div>
                {item.score !== null && <div style={{ fontSize: 12, color: getScoreInfo(item.score).color, marginBottom: 6, fontWeight: 500 }}>{getScoreInfo(item.score).label}</div>}
                {criteria && (
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
                <textarea placeholder="Comments (optional)..." value={item.comment} onChange={e => updItem(secIdx, ii, "comment", e.target.value)} rows={2}
                  style={{ width: "100%", padding: "8px 10px", border: "1px solid #E2E8F0", borderRadius: 8, fontSize: 13, resize: "none", boxSizing: "border-box", fontFamily: "inherit", marginBottom: (item.score === null || item.score <= 2) ? 8 : 0 }} />
                {(item.score === null || item.score <= 2) && (
                  <input placeholder="Action item..." value={item.actionItem} onChange={e => updItem(secIdx, ii, "actionItem", e.target.value)}
                    style={{ width: "100%", padding: "8px 10px", border: "1px solid #E2E8F0", borderRadius: 8, fontSize: 13, boxSizing: "border-box", fontFamily: "inherit" }} />
                )}
              </div>
            );
          })}
          <button onClick={() => setStep(s => s + 1)} style={{ width: "100%", background: "#003A6B", color: "white", border: "none", borderRadius: 12, padding: 15, fontSize: 16, fontWeight: 600, cursor: "pointer", marginTop: 4 }}>
            {secIdx + 1 === numSec ? "Review audit →" : "Next section →"}
          </button>
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
        <button onClick={() => onDone({ ...audit, submittedAt: Date.now() })} style={{ width: "100%", background: "#003A6B", color: "white", border: "none", borderRadius: 12, padding: 16, fontSize: 16, fontWeight: 700, cursor: "pointer", marginTop: 10 }}>Submit audit ✓</button>
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
            <div style={{ fontSize: 13, color: "#EA580C", marginBottom: 6 }}><i className="ti ti-arrow-right" style={{ fontSize: 12 }} /> {item.actionItem}</div>
            {item.actionDue && <div style={{ fontSize: 12, color: "#64748B", marginBottom: 6 }}><i className="ti ti-calendar" style={{ fontSize: 12 }} /> Due: {fmt(item.actionDue)}</div>}
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
      {/* Filter row + view toggle */}
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

// ─────────────────────────── BENCHMARK ───────────────────────────

const Benchmark = ({ audits }) => {
  const sites = {};
  audits.forEach(a => { if (!sites[a.site]) sites[a.site] = []; sites[a.site].push(a); });
  const siteList = Object.entries(sites).map(([site, list]) => {
    const sorted = list.sort((a, b) => b.submittedAt - a.submittedAt);
    const latest = calcScore(sorted[0]), avg = Math.round(list.reduce((s, a) => s + calcScore(a).pct, 0) / list.length), prev = sorted[1] ? calcScore(sorted[1]) : null;
    return { site, latest: latest.pct, latestFailing: latest.failing, avg, count: list.length, delta: prev ? latest.pct - prev.pct : null };
  }).sort((a, b) => b.latest - a.latest);
  return (
    <div style={{ padding: 16 }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0F172A", marginBottom: 4 }}>Site benchmarking</h2>
      <p style={{ fontSize: 13, color: "#64748B", margin: "0 0 20px" }}>Latest audit scores across all sites</p>
      {siteList.length === 0 ? <div style={{ textAlign: "center", padding: "48px 16px", color: "#94A3B8" }}>Submit audits from multiple sites to compare.</div>
      : siteList.map((s, i) => (
        <div key={s.site} style={{ background: "white", borderRadius: 12, border: "0.5px solid #E2E8F0", padding: 14, marginBottom: 10 }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 10 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                <span style={{ width: 22, height: 22, borderRadius: "50%", background: i === 0 ? "#FEF3C7" : "#F1F5F9", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: i === 0 ? "#92400E" : "#64748B" }}>#{i+1}</span>
                <span style={{ fontWeight: 700, fontSize: 15, color: "#0F172A" }}>{s.site}</span>
              </div>
              <div style={{ fontSize: 12, color: "#64748B" }}>{s.count} audit{s.count !== 1 ? "s" : ""} · avg {s.avg}%</div>
              {s.latestFailing > 0 && <div style={{ fontSize: 12, color: "#DC2626", fontWeight: 600, marginTop: 2 }}>⚠ {s.latestFailing} need improvement in latest</div>}
            </div>
            <div style={{ textAlign: "right" }}><div style={{ fontWeight: 700, fontSize: 24, color: gradeColor(s.latest), lineHeight: 1 }}>{s.latest}%</div><Delta d={s.delta} /></div>
          </div>
          <div style={{ background: "#F1F5F9", borderRadius: 4, height: 8, overflow: "hidden" }}><div style={{ height: 8, borderRadius: 4, background: gradeColor(s.latest), width: `${s.latest}%`, transition: "width 0.5s" }} /></div>
        </div>
      ))}
      <div style={{ background: "white", borderRadius: 12, border: "0.5px solid #E2E8F0", padding: 14, marginTop: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#64748B", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>Score guide</div>
        {[["80–100%","Good","#16A34A"],["60–79%","Acceptable","#D97706"],["40–59%","Needs Work","#EA580C"],["0–39%","Critical","#DC2626"]].map(([r,l,c]) => (
          <div key={r} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}><div style={{ width: 10, height: 10, borderRadius: "50%", background: c, flexShrink: 0 }} /><span style={{ fontSize: 13, color: "#1E293B" }}><strong>{r}</strong> — {l}</span></div>
        ))}
      </div>
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

// ─────────────────────────── APP SHELL ───────────────────────────

const TABS = [
  { id: "dashboard", label: "Home",     icon: "ti-home" },
  { id: "calendar",  label: "Calendar", icon: "ti-calendar" },
  { id: "history",   label: "History",  icon: "ti-history" },
  { id: "benchmark", label: "Compare",  icon: "ti-chart-bar" },
  { id: "team",      label: "Team",     icon: "ti-users" }
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
        {tab === "dashboard" && <Dashboard audits={audits} schedules={schedules} onNew={handleNew} onView={handleView} />}
        {tab === "calendar"  && <CalendarView audits={audits} schedules={schedules} onAddSchedule={handleAddSchedule} onDeleteSchedule={handleDeleteSchedule} />}
        {tab === "new"       && newType && <NewAudit type={newType} onDone={handleDone} onCancel={() => { setNewType(null); setTab("dashboard"); }} />}
        {tab === "history"   && <History audits={audits} onView={handleView} />}
        {tab === "benchmark" && <Benchmark audits={audits} />}
        {tab === "team"      && <Team audits={audits} />}
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
