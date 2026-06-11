import { useState, useEffect } from "react";
import { loadAudits, saveAudit } from "./supabase.js";

// ─────────────────────────── AUDIT TEMPLATES ───────────────────────────

const OA_TEMPLATE = {
  label: "Operations Audit", short: "OA", color: "#0369A1",
  sections: [
    { id: "safety", name: "Safety Performance", items: ["Maintain Performance Standards", "Accountability", "Housekeeping"] },
    { id: "proc_disc", name: "Process Discipline", items: ["Process Compliance", "Process Checks", "Action Registries", "Connected Checking", "Deadlines"] },
    { id: "proc_imp", name: "Process Improvement", items: ["4 SPS", "Process Improvements", "Proactive Improvements"] },
    { id: "relations", name: "Relationships", items: ["Customer Engagement", "Site Growth", "Associate Engagement", "FTR Relationships"] },
    { id: "records", name: "Records", items: ["Training Records", "Hours Tracker", "Expense Tracker", "KPI Meeting"] }
  ]
};

const SA_TEMPLATE = {
  label: "Safety Audit", short: "SA", color: "#7C3AED",
  sections: [
    { id: "emp_eng", name: "Employee Engagement", items: ["Associate knows evacuation gathering point", "Associate can explain fire/weather alarm differences", "Associate knows spill control protocol", "Associate knows how to access a SDS"] },
    { id: "injury", name: "Injury / Illness", items: ["Review last injury/illness – process followed & root cause addressed", "Review last incident – did we follow the Flow Chart?", "Review last incident – did we follow all protocols?", "Deadlines for actions from last injury met"] },
    { id: "ppe", name: "PPE", items: ["PPE Audits", "PPE Expenses being tracked", "PPE Usage on the floor", "PPE consumption being tracked"] },
    { id: "hazard", name: "Hazard Prevention", items: ["JSA completed", "JSA Effective", "PPE effectiveness reviewed", "Gemba walks being performed"] },
    { id: "inc_rec", name: "Incident & Records Review", items: ["Review OSHA training records", "BBS Observations up to date", "Review training records for last 5 associates hired", "Review last 3 incidents / Protocols met"] }
  ]
};

const TEMPLATES = { OA: OA_TEMPLATE, SA: SA_TEMPLATE };

const SCORES = [
  { val: 3, label: "Meets / Exceeds", color: "#16A34A", bg: "#DCFCE7", text: "#14532D" },
  { val: 2, label: "Work in Progress", color: "#D97706", bg: "#FEF3C7", text: "#78350F" },
  { val: 1, label: "Needs Improvement", color: "#EA580C", bg: "#FFEDD5", text: "#7C2D12" },
  { val: 0, label: "Not Being Done",   color: "#DC2626", bg: "#FEE2E2", text: "#7F1D1D" }
];

// ─────────────────────────── UTILITIES ───────────────────────────

const getScoreInfo = (v) => SCORES.find(s => s.val === v) || { color: "#94A3B8", bg: "#F1F5F9", label: "Not scored", text: "#475569" };

const calcScore = (audit) => {
  let total = 0, max = 0, failing = 0;
  (audit.sections || []).forEach(sec => sec.items.forEach(item => {
    if (item.score === null || item.score === undefined) return;
    total += item.score; max += 3;
    if (item.score === 0) failing++;
  }));
  return { total, max, pct: max > 0 ? Math.round((total / max) * 100) : 0, failing };
};

const gradeColor = (pct) => pct >= 80 ? "#16A34A" : pct >= 60 ? "#D97706" : pct >= 40 ? "#EA580C" : "#DC2626";
const gradeLabel = (pct) => pct >= 80 ? "Good" : pct >= 60 ? "Acceptable" : pct >= 40 ? "Needs Work" : "Critical";

const fmt = (d) => d ? new Date(d + (d.includes("T") ? "" : "T12:00:00")).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";

const createEmpty = (type) => ({
  id: Date.now().toString(),
  type,
  site: "", auditorName: "", auditorSite: "",
  date: new Date().toISOString().split("T")[0],
  actionItemDueDate: "",
  sections: TEMPLATES[type].sections.map(sec => ({
    ...sec,
    items: sec.items.map(name => ({ name, score: null, comment: "", actionItem: "", actionDue: "" }))
  }))
});

// ─────────────────────────── SMALL COMPONENTS ───────────────────────────

const Pill = ({ val }) => {
  const s = getScoreInfo(val);
  return <span style={{ background: s.bg, color: s.text, borderRadius: 99, fontSize: 11, fontWeight: 600, padding: "2px 8px", whiteSpace: "nowrap" }}>{val !== null && val !== undefined ? `${val} – ${s.label}` : "Not scored"}</span>;
};

const Ring = ({ pct, size = 72 }) => {
  const r = (size - 10) / 2, c = 2 * Math.PI * r;
  const col = gradeColor(pct);
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#E2E8F0" strokeWidth={8} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={col} strokeWidth={8}
          strokeDasharray={`${(pct / 100) * c} ${c}`} strokeLinecap="round" />
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
  <span style={{
    background: type === "OA" ? "#DBEAFE" : "#EDE9FE",
    color: type === "OA" ? "#1D4ED8" : "#7C3AED",
    fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 4, flexShrink: 0
  }}>{type}</span>
);

// ─────────────────────────── DASHBOARD ───────────────────────────

const Dashboard = ({ audits, onNew, onView }) => {
  const recent = [...audits].sort((a, b) => b.submittedAt - a.submittedAt).slice(0, 6);
  const avg = audits.length ? Math.round(audits.reduce((s, a) => s + calcScore(a).pct, 0) / audits.length) : 0;
  const totalFailing = audits.reduce((s, a) => s + calcScore(a).failing, 0);
  const sites = new Set(audits.map(a => a.site)).size;

  const prevFor = (audit) => audits
    .filter(a => a.site === audit.site && a.type === audit.type && a.submittedAt < audit.submittedAt)
    .sort((a, b) => b.submittedAt - a.submittedAt)[0];

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

      {totalFailing > 0 && (
        <div style={{ background: "#FEE2E2", border: "0.5px solid #FECACA", borderRadius: 10, padding: "10px 14px", marginBottom: 16, display: "flex", alignItems: "flex-start", gap: 10 }}>
          <i className="ti ti-alert-triangle" style={{ fontSize: 20, color: "#DC2626", flexShrink: 0, marginTop: 1 }} />
          <div>
            <div style={{ fontWeight: 600, fontSize: 14, color: "#7F1D1D" }}>{totalFailing} item{totalFailing !== 1 ? "s" : ""} scored 0 — require team discussion</div>
            <div style={{ fontSize: 12, color: "#991B1B", marginTop: 2 }}>Red results must be reviewed as a team with action items assigned.</div>
          </div>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 22 }}>
        <button onClick={() => onNew("OA")} style={{ background: "#003A6B", color: "white", border: "none", borderRadius: 12, padding: "15px 12px", fontSize: 14, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          <i className="ti ti-clipboard-plus" style={{ fontSize: 18 }} />New OA Audit
        </button>
        <button onClick={() => onNew("SA")} style={{ background: "#7C3AED", color: "white", border: "none", borderRadius: 12, padding: "15px 12px", fontSize: 14, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          <i className="ti ti-shield-check" style={{ fontSize: 18 }} />New SA Audit
        </button>
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
                <span style={{ fontSize: 12, color: "#64748B" }}>{s.total}/{s.max} pts</span>
                {s.failing > 0 && <span style={{ fontSize: 11, color: "#DC2626", fontWeight: 600 }}>⚠ {s.failing} red</span>}
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

// ─────────────────────────── NEW AUDIT WIZARD ───────────────────────────

const NewAudit = ({ type, onDone, onCancel }) => {
  const [step, setStep] = useState(0);
  const [audit, setAudit] = useState(() => createEmpty(type));
  const tmpl = TEMPLATES[type];
  const numSec = audit.sections.length;

  const upd = (f, v) => setAudit(a => ({ ...a, [f]: v }));
  const updItem = (si, ii, f, v) => setAudit(a => ({
    ...a,
    sections: a.sections.map((sec, s) => s !== si ? sec : {
      ...sec, items: sec.items.map((item, i) => i !== ii ? item : { ...item, [f]: v })
    })
  }));

  const canGo = step === 0 ? audit.site.trim() && audit.auditorName.trim() && audit.auditorSite.trim() : true;
  const secIdx = step - 1;
  const inSection = step > 0 && secIdx < numSec;
  const inReview = step === numSec + 1;
  const progress = Math.round((step / (numSec + 2)) * 100);

  const inputStyle = { width: "100%", padding: "11px 12px", border: "1px solid #D1D5DB", borderRadius: 8, fontSize: 15, boxSizing: "border-box", fontFamily: "inherit" };
  const labelStyle = { display: "block", fontSize: 13, fontWeight: 500, color: "#374151", marginBottom: 6 };

  if (step === 0) return (
    <div style={{ padding: 16 }}>
      <button onClick={onCancel} style={{ background: "none", border: "none", color: "#64748B", cursor: "pointer", padding: 0, marginBottom: 20, display: "flex", alignItems: "center", gap: 4, fontSize: 14 }}>
        <i className="ti ti-arrow-left" /> Cancel
      </button>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
        <TypeBadge type={type} />
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#0F172A" }}>{tmpl.label}</h2>
      </div>
      <p style={{ color: "#64748B", fontSize: 14, margin: "0 0 24px" }}>Enter audit details to begin scoring</p>

      <label style={labelStyle}>Site being audited *</label>
      <input value={audit.site} onChange={e => upd("site", e.target.value)} placeholder="e.g. Atlanta – Plant A" style={{ ...inputStyle, marginBottom: 16 }} />
      <label style={labelStyle}>Auditor name *</label>
      <input value={audit.auditorName} onChange={e => upd("auditorName", e.target.value)} placeholder="Your full name" style={{ ...inputStyle, marginBottom: 16 }} />
      <label style={labelStyle}>Auditor's home site *</label>
      <input value={audit.auditorSite} onChange={e => upd("auditorSite", e.target.value)} placeholder="e.g. Charlotte – HQ" style={{ ...inputStyle, marginBottom: 16 }} />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 28 }}>
        <div>
          <label style={labelStyle}>Audit date</label>
          <input type="date" value={audit.date} onChange={e => upd("date", e.target.value)} style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Action items due</label>
          <input type="date" value={audit.actionItemDueDate} onChange={e => upd("actionItemDueDate", e.target.value)} style={inputStyle} />
        </div>
      </div>

      <button onClick={() => setStep(1)} disabled={!canGo} style={{ width: "100%", background: canGo ? "#003A6B" : "#CBD5E1", color: "white", border: "none", borderRadius: 12, padding: 15, fontSize: 16, fontWeight: 600, cursor: canGo ? "pointer" : "default" }}>
        Start scoring →
      </button>
    </div>
  );

  if (inSection) {
    const sec = audit.sections[secIdx];
    const ss = calcScore({ sections: [sec] });
    return (
      <div>
        <div style={{ background: "#E2E8F0", height: 4 }}>
          <div style={{ background: "#003A6B", height: 4, width: `${progress}%`, transition: "width 0.3s" }} />
        </div>
        <div style={{ padding: 16 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <button onClick={() => setStep(s => s - 1)} style={{ background: "none", border: "none", color: "#64748B", cursor: "pointer", padding: 0 }}>
              <i className="ti ti-arrow-left" style={{ fontSize: 22 }} />
            </button>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 12, color: "#64748B" }}>Section {secIdx + 1} of {numSec}</div>
              <div style={{ fontWeight: 700, fontSize: 16, color: "#0F172A" }}>{sec.name}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 12, color: "#64748B" }}>Score</div>
              <div style={{ fontWeight: 700, fontSize: 16, color: gradeColor(ss.pct) }}>{ss.total}/{ss.max}</div>
            </div>
          </div>

          {sec.items.map((item, ii) => {
            const hasIssue = item.score === null || item.score < 3;
            return (
              <div key={ii} style={{ background: "white", borderRadius: 12, border: "0.5px solid #E2E8F0", borderLeft: `3px solid ${item.score === 0 ? "#DC2626" : item.score === null ? "#E2E8F0" : item.score < 3 ? "#D97706" : "#16A34A"}`, padding: 14, marginBottom: 12 }}>
                <p style={{ margin: "0 0 10px", fontWeight: 600, fontSize: 14, color: "#1E293B", lineHeight: 1.4 }}>{item.name}</p>
                <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                  {SCORES.map(sc => (
                    <button key={sc.val} onClick={() => updItem(secIdx, ii, "score", item.score === sc.val ? null : sc.val)} style={{ flex: 1, padding: "8px 0", border: `2px solid ${item.score === sc.val ? sc.color : "#E2E8F0"}`, borderRadius: 8, background: item.score === sc.val ? sc.bg : "white", color: item.score === sc.val ? sc.text : "#94A3B8", fontWeight: 700, fontSize: 16, cursor: "pointer" }}>{sc.val}</button>
                  ))}
                </div>
                {item.score !== null && <div style={{ fontSize: 12, color: getScoreInfo(item.score).color, marginBottom: 8, fontWeight: 500 }}>{getScoreInfo(item.score).label}</div>}
                <textarea placeholder="Comments (optional)..." value={item.comment} onChange={e => updItem(secIdx, ii, "comment", e.target.value)} rows={2} style={{ width: "100%", padding: "8px 10px", border: "1px solid #E2E8F0", borderRadius: 8, fontSize: 13, resize: "none", boxSizing: "border-box", fontFamily: "inherit", marginBottom: hasIssue ? 8 : 0 }} />
                {hasIssue && <input placeholder="Action item..." value={item.actionItem} onChange={e => updItem(secIdx, ii, "actionItem", e.target.value)} style={{ width: "100%", padding: "8px 10px", border: "1px solid #E2E8F0", borderRadius: 8, fontSize: 13, boxSizing: "border-box", fontFamily: "inherit" }} />}
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
          <button onClick={() => setStep(s => s - 1)} style={{ background: "none", border: "none", color: "#64748B", cursor: "pointer", padding: 0 }}>
            <i className="ti ti-arrow-left" style={{ fontSize: 22 }} />
          </button>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#0F172A" }}>Review & Submit</h2>
        </div>

        <div style={{ background: "white", borderRadius: 16, border: "0.5px solid #E2E8F0", padding: 20, marginBottom: 20, display: "flex", alignItems: "center", gap: 20 }}>
          <Ring pct={fs.pct} size={80} />
          <div>
            <div style={{ fontWeight: 700, fontSize: 20, color: "#0F172A" }}>{audit.site}</div>
            <div style={{ fontSize: 13, color: "#64748B" }}>{tmpl.label} · {fmt(audit.date)}</div>
            <div style={{ fontSize: 13, color: "#64748B" }}>By {audit.auditorName} ({audit.auditorSite})</div>
            <div style={{ fontSize: 13, color: "#64748B" }}>{fs.total}/{fs.max} pts</div>
            {fs.failing > 0 && <div style={{ fontSize: 13, color: "#DC2626", fontWeight: 600, marginTop: 6 }}>⚠ {fs.failing} item{fs.failing !== 1 ? "s" : ""} scored 0 — requires team discussion</div>}
          </div>
        </div>

        {audit.sections.map((sec, si) => {
          const ss = calcScore({ sections: [sec] });
          return (
            <div key={si} style={{ background: "white", borderRadius: 12, border: "0.5px solid #E2E8F0", padding: "12px 14px", marginBottom: 8, display: "flex", alignItems: "center" }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 500, fontSize: 14, color: "#1E293B" }}>{sec.name}</div>
                <div style={{ fontSize: 12, color: "#64748B" }}>{ss.total}/{ss.max} pts</div>
              </div>
              <div style={{ width: 46, height: 46, borderRadius: "50%", background: gradeColor(ss.pct) + "18", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 13, color: gradeColor(ss.pct) }}>{ss.pct}%</div>
            </div>
          );
        })}

        <button onClick={() => onDone({ ...audit, submittedAt: Date.now() })} style={{ width: "100%", background: "#003A6B", color: "white", border: "none", borderRadius: 12, padding: 16, fontSize: 16, fontWeight: 700, cursor: "pointer", marginTop: 10 }}>
          Submit audit ✓
        </button>
      </div>
    );
  }

  return null;
};

// ─────────────────────────── DETAIL VIEW ───────────────────────────

const Detail = ({ audit, prevAudit, onBack }) => {
  const [activeTab, setActiveTab] = useState("scores");
  const s = calcScore(audit);
  const ps = prevAudit ? calcScore(prevAudit) : null;
  const delta = ps ? s.pct - ps.pct : null;
  const allActions = audit.sections.flatMap(sec => sec.items.filter(i => i.actionItem).map(i => ({ ...i, sectionName: sec.name })));

  return (
    <div>
      <div style={{ background: "#003A6B", padding: "14px 16px 20px" }}>
        <button onClick={onBack} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.65)", cursor: "pointer", padding: 0, marginBottom: 14, display: "flex", alignItems: "center", gap: 4, fontSize: 14 }}>
          <i className="ti ti-arrow-left" /> Back
        </button>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 18 }}>
          <Ring pct={s.pct} size={76} />
          <div style={{ color: "white" }}>
            <div style={{ fontWeight: 700, fontSize: 20, marginBottom: 2 }}>{audit.site}</div>
            <TypeBadge type={audit.type} />
            <div style={{ fontSize: 13, opacity: 0.8, marginTop: 4 }}>{fmt(audit.date)}</div>
            <div style={{ fontSize: 13, opacity: 0.8 }}>By {audit.auditorName} ({audit.auditorSite})</div>
            <div style={{ fontSize: 13, opacity: 0.8 }}>{s.total}/{s.max} pts</div>
            {ps && <div style={{ marginTop: 8, fontSize: 12, color: delta >= 0 ? "#86EFAC" : "#FCA5A5" }}>vs previous {ps.pct}% → {delta >= 0 ? `+${delta}% ↑ improved` : `${delta}% ↓ declined`}</div>}
          </div>
        </div>
      </div>

      <div style={{ display: "flex", borderBottom: "1px solid #E2E8F0", background: "white" }}>
        {[["scores", "Scores"], ["actions", `Actions (${allActions.length})`]].map(([id, label]) => (
          <button key={id} onClick={() => setActiveTab(id)} style={{ flex: 1, padding: "12px 8px", background: "white", border: "none", borderBottom: activeTab === id ? "2px solid #003A6B" : "2px solid transparent", color: activeTab === id ? "#003A6B" : "#64748B", fontWeight: 600, fontSize: 14, cursor: "pointer" }}>{label}</button>
        ))}
      </div>

      <div style={{ padding: 16 }}>
        {activeTab === "scores" && (
          <>
            {s.failing > 0 && (
              <div style={{ background: "#FEE2E2", border: "0.5px solid #FECACA", borderRadius: 10, padding: "10px 14px", marginBottom: 16 }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: "#7F1D1D", marginBottom: 4 }}>⚠ Red results — must be discussed as a team</div>
                <div style={{ fontSize: 12, color: "#991B1B" }}>{audit.sections.flatMap(sec => sec.items.filter(i => i.score === 0).map(i => i.name)).join(" · ")}</div>
              </div>
            )}
            {audit.sections.map((sec, si) => {
              const ss = calcScore({ sections: [sec] });
              const prevSec = prevAudit?.sections?.[si];
              const prevSs = prevSec ? calcScore({ sections: [prevSec] }) : null;
              return (
                <div key={si} style={{ marginBottom: 18 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                    <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#1E293B" }}>{sec.name}</h3>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {prevSs && <Delta d={ss.pct - prevSs.pct} />}
                      <span style={{ fontSize: 14, fontWeight: 700, color: gradeColor(ss.pct) }}>{ss.pct}%</span>
                    </div>
                  </div>
                  {sec.items.map((item, ii) => (
                    <div key={ii} style={{ background: "white", borderRadius: 10, border: "0.5px solid #E2E8F0", borderLeft: `3px solid ${item.score === 0 ? "#DC2626" : item.score === null ? "#CBD5E1" : item.score < 3 ? "#D97706" : "#16A34A"}`, padding: "10px 12px", marginBottom: 8 }}>
                      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: item.comment || item.actionItem ? 6 : 0 }}>
                        <span style={{ fontSize: 13, color: "#374151", lineHeight: 1.4 }}>{item.name}</span>
                        <Pill val={item.score} />
                      </div>
                      {item.comment && <div style={{ fontSize: 12, color: "#64748B", fontStyle: "italic" }}>"{item.comment}"</div>}
                      {item.actionItem && <div style={{ fontSize: 12, color: "#EA580C", marginTop: 4 }}><i className="ti ti-arrow-right" style={{ fontSize: 11 }} /> {item.actionItem}</div>}
                    </div>
                  ))}
                </div>
              );
            })}
          </>
        )}

        {activeTab === "actions" && (
          allActions.length === 0
            ? <div style={{ textAlign: "center", padding: "40px 16px", color: "#94A3B8" }}>No action items recorded for this audit.</div>
            : allActions.map((item, i) => (
              <div key={i} style={{ background: "white", borderRadius: 12, border: "0.5px solid #E2E8F0", padding: 14, marginBottom: 10 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#94A3B8", letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 4 }}>{item.sectionName}</div>
                <div style={{ fontSize: 14, color: "#1E293B", fontWeight: 600, marginBottom: 6 }}>{item.name}</div>
                <div style={{ fontSize: 13, color: "#EA580C", marginBottom: 6 }}><i className="ti ti-arrow-right" style={{ fontSize: 12 }} /> {item.actionItem}</div>
                {item.actionDue && <div style={{ fontSize: 12, color: "#64748B", marginBottom: 6 }}><i className="ti ti-calendar" style={{ fontSize: 12 }} /> Due: {fmt(item.actionDue)}</div>}
                <Pill val={item.score} />
              </div>
            ))
        )}
      </div>
    </div>
  );
};

// ─────────────────────────── HISTORY ───────────────────────────

const History = ({ audits, onView }) => {
  const [filter, setFilter] = useState("all");
  const sorted = [...audits].filter(a => filter === "all" || a.type === filter).sort((a, b) => b.submittedAt - a.submittedAt);
  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
        {[["all", "All"], ["OA", "Operations"], ["SA", "Safety"]].map(([v, l]) => (
          <button key={v} onClick={() => setFilter(v)} style={{ padding: "7px 14px", borderRadius: 20, background: filter === v ? "#003A6B" : "white", color: filter === v ? "white" : "#374151", border: "0.5px solid #D1D5DB", fontSize: 13, fontWeight: 500, cursor: "pointer" }}>{l}</button>
        ))}
      </div>
      {sorted.length === 0 ? (
        <div style={{ textAlign: "center", padding: "48px 16px", color: "#94A3B8" }}>No audits found.</div>
      ) : sorted.map(audit => {
        const s = calcScore(audit);
        return (
          <button key={audit.id} onClick={() => onView(audit)} style={{ width: "100%", background: "white", border: "0.5px solid #E2E8F0", borderRadius: 12, padding: 14, marginBottom: 10, textAlign: "left", cursor: "pointer", display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 50, height: 50, borderRadius: "50%", background: gradeColor(s.pct) + "18", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 14, color: gradeColor(s.pct), flexShrink: 0 }}>{s.pct}%</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                <span style={{ fontWeight: 600, fontSize: 14, color: "#0F172A", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{audit.site || "—"}</span>
                <TypeBadge type={audit.type} />
              </div>
              <div style={{ fontSize: 12, color: "#64748B" }}>{fmt(audit.date)} · {audit.auditorName}</div>
              {s.failing > 0 && <div style={{ fontSize: 11, color: "#DC2626", fontWeight: 600, marginTop: 2 }}>⚠ {s.failing} red item{s.failing !== 1 ? "s" : ""} — needs discussion</div>}
            </div>
            <i className="ti ti-chevron-right" style={{ fontSize: 16, color: "#CBD5E1", flexShrink: 0 }} />
          </button>
        );
      })}
    </div>
  );
};

// ─────────────────────────── BENCHMARK ───────────────────────────

const Benchmark = ({ audits }) => {
  const sites = {};
  audits.forEach(a => { if (!sites[a.site]) sites[a.site] = []; sites[a.site].push(a); });
  const siteList = Object.entries(sites).map(([site, list]) => {
    const sorted = list.sort((a, b) => b.submittedAt - a.submittedAt);
    const latest = calcScore(sorted[0]);
    const avg = Math.round(list.reduce((s, a) => s + calcScore(a).pct, 0) / list.length);
    const prev = sorted[1] ? calcScore(sorted[1]) : null;
    return { site, latest: latest.pct, latestFailing: latest.failing, avg, count: list.length, delta: prev ? latest.pct - prev.pct : null };
  }).sort((a, b) => b.latest - a.latest);

  return (
    <div style={{ padding: 16 }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0F172A", marginBottom: 4 }}>Site benchmarking</h2>
      <p style={{ fontSize: 13, color: "#64748B", margin: "0 0 20px" }}>Latest audit scores across all sites</p>
      {siteList.length === 0 ? (
        <div style={{ textAlign: "center", padding: "48px 16px", color: "#94A3B8" }}>Submit audits from multiple sites to compare.</div>
      ) : siteList.map((s, i) => (
        <div key={s.site} style={{ background: "white", borderRadius: 12, border: "0.5px solid #E2E8F0", padding: 14, marginBottom: 10 }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 10 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                <span style={{ width: 22, height: 22, borderRadius: "50%", background: i === 0 ? "#FEF3C7" : "#F1F5F9", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: i === 0 ? "#92400E" : "#64748B" }}>#{i + 1}</span>
                <span style={{ fontWeight: 700, fontSize: 15, color: "#0F172A" }}>{s.site}</span>
              </div>
              <div style={{ fontSize: 12, color: "#64748B" }}>{s.count} audit{s.count !== 1 ? "s" : ""} · avg {s.avg}%</div>
              {s.latestFailing > 0 && <div style={{ fontSize: 12, color: "#DC2626", fontWeight: 600, marginTop: 2 }}>⚠ {s.latestFailing} red in latest</div>}
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontWeight: 700, fontSize: 24, color: gradeColor(s.latest), lineHeight: 1 }}>{s.latest}%</div>
              <Delta d={s.delta} />
            </div>
          </div>
          <div style={{ background: "#F1F5F9", borderRadius: 4, height: 8, overflow: "hidden" }}>
            <div style={{ height: 8, borderRadius: 4, background: gradeColor(s.latest), width: `${s.latest}%`, transition: "width 0.5s" }} />
          </div>
        </div>
      ))}
      <div style={{ background: "white", borderRadius: 12, border: "0.5px solid #E2E8F0", padding: 14, marginTop: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#64748B", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>Score guide</div>
        {[["80–100%", "Good", "#16A34A"], ["60–79%", "Acceptable", "#D97706"], ["40–59%", "Needs Work", "#EA580C"], ["0–39%", "Critical", "#DC2626"]].map(([r, l, c]) => (
          <div key={r} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: c, flexShrink: 0 }} />
            <span style={{ fontSize: 13, color: "#1E293B" }}><strong>{r}</strong> — {l}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─────────────────────────── TEAM ───────────────────────────

const Team = ({ audits }) => {
  const people = {};
  audits.forEach(a => {
    const key = `${a.auditorName}||${a.auditorSite}`;
    if (!people[key]) people[key] = { name: a.auditorName, site: a.auditorSite, audits: [] };
    people[key].audits.push(a);
  });
  const list = Object.values(people).sort((a, b) => b.audits.length - a.audits.length);
  const colors = ["#003A6B", "#7C3AED", "#0D9488", "#DC2626", "#D97706", "#16A34A", "#0369A1", "#BE185D"];
  const initials = (n) => (n || "?").split(" ").map(x => x[0]).join("").substring(0, 2).toUpperCase();

  return (
    <div style={{ padding: 16 }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0F172A", marginBottom: 4 }}>MAU team</h2>
      <p style={{ fontSize: 13, color: "#64748B", margin: "0 0 20px" }}>Auditors across all sites — network & collaborate</p>
      {list.length === 0 ? (
        <div style={{ textAlign: "center", padding: "48px 16px", color: "#94A3B8" }}>No auditors recorded yet.</div>
      ) : list.map((person, i) => {
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
  { id: "dashboard", label: "Home",    icon: "ti-home" },
  { id: "history",   label: "History", icon: "ti-history" },
  { id: "benchmark", label: "Compare", icon: "ti-chart-bar" },
  { id: "team",      label: "Team",    icon: "ti-users" }
];

export default function App() {
  const [tab, setTab] = useState("dashboard");
  const [audits, setAudits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newType, setNewType] = useState(null);
  const [detailAudit, setDetailAudit] = useState(null);

  useEffect(() => {
    loadAudits().then(data => { setAudits(data); setLoading(false); });
  }, []);

  const handleNew = (type) => { setNewType(type); setTab("new"); };

  const handleDone = async (audit) => {
    setSaving(true);
    await saveAudit(audit);
    const updated = [...audits.filter(a => a.id !== audit.id), audit];
    setAudits(updated);
    setSaving(false);
    setDetailAudit(audit);
    setTab("detail");
    setNewType(null);
  };

  const handleView  = (audit) => { setDetailAudit(audit); setTab("detail"); };
  const handleBack  = () => { setDetailAudit(null); setTab("history"); };

  const prevAudit = (audit) => audits
    .filter(a => a.site === audit.site && a.type === audit.type && a.id !== audit.id && a.submittedAt < audit.submittedAt)
    .sort((a, b) => b.submittedAt - a.submittedAt)[0] || null;

  const inWizard = tab === "new" || tab === "detail";

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ textAlign: "center", color: "#64748B" }}>
        <div style={{ width: 40, height: 40, border: "3px solid #E2E8F0", borderTopColor: "#003A6B", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 12px" }} />
        Loading audits...
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );

  return (
    <div style={{ maxWidth: 430, margin: "0 auto", fontFamily: "system-ui, -apple-system, sans-serif", background: "#F8FAFC", minHeight: "100dvh" }}>

      {!inWizard && (
        <div style={{ background: "#003A6B", padding: "env(safe-area-inset-top, 14px) 16px 16px", position: "sticky", top: 0, zIndex: 10 }}>
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

      {saving && (
        <div style={{ background: "#003A6B", color: "white", fontSize: 12, textAlign: "center", padding: "6px" }}>
          Saving audit...
        </div>
      )}

      <div style={{ paddingBottom: inWizard ? 0 : "calc(68px + env(safe-area-inset-bottom, 0px))", minHeight: "80vh" }}>
        {tab === "dashboard" && <Dashboard audits={audits} onNew={handleNew} onView={handleView} />}
        {tab === "new"       && newType && <NewAudit type={newType} onDone={handleDone} onCancel={() => { setNewType(null); setTab("dashboard"); }} />}
        {tab === "history"   && <History audits={audits} onView={handleView} />}
        {tab === "benchmark" && <Benchmark audits={audits} />}
        {tab === "team"      && <Team audits={audits} />}
        {tab === "detail"    && detailAudit && <Detail audit={detailAudit} prevAudit={prevAudit(detailAudit)} onBack={handleBack} />}
      </div>

      {!inWizard && (
        <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 430, background: "white", borderTop: "0.5px solid #E2E8F0", display: "flex", zIndex: 20, paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{ flex: 1, padding: "10px 0 8px", background: "none", border: "none", color: tab === t.id ? "#003A6B" : "#94A3B8", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
              <i className={`ti ${t.icon}`} style={{ fontSize: 22 }} />
              <span style={{ fontSize: 10, fontWeight: tab === t.id ? 700 : 400 }}>{t.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
