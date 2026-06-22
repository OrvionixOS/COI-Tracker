import React, { useState, useRef, useEffect } from "react";

// ── Brand tokens ─────────────────────────────────────────────
const C = {
  obsidian: "#0E0E10",
  panel: "#15151A",
  raised: "#1C1C22",
  line: "rgba(194,163,107,0.18)",
  lineSoft: "rgba(244,241,234,0.07)",
  ivory: "#F4F1EA",
  muted: "#928D81",
  gold: "#C2A36B",
  goldDeep: "#A8853F",
  ok: "#7E9B86",
  warn: "#C9A24B",
  bad: "#B5603F",
};

// ── Coverage requirements by vendor type ─────────────────────
const REQUIREMENTS = {
  "General Contractor": {
    coverages: [
      { type: "gl", label: "General Liability", each_occurrence: 1000000, aggregate: 2000000 },
      { type: "auto", label: "Automobile Liability", each_occurrence: 1000000 },
      { type: "wc", label: "Workers Compensation" },
    ],
    additionalInsured: true,
  },
  "Janitorial / Cleaning": {
    coverages: [
      { type: "gl", label: "General Liability", each_occurrence: 1000000 },
      { type: "wc", label: "Workers Compensation" },
    ],
    additionalInsured: true,
  },
  Landscaping: {
    coverages: [
      { type: "gl", label: "General Liability", each_occurrence: 1000000 },
      { type: "auto", label: "Automobile Liability", each_occurrence: 1000000 },
      { type: "wc", label: "Workers Compensation" },
    ],
    additionalInsured: true,
  },
  "Event Vendor": {
    coverages: [
      { type: "gl", label: "General Liability", each_occurrence: 1000000, aggregate: 2000000 },
    ],
    additionalInsured: true,
  },
  "Professional Services": {
    coverages: [
      { type: "gl", label: "General Liability", each_occurrence: 1000000 },
      { type: "prof", label: "Professional Liability", each_occurrence: 1000000 },
    ],
    additionalInsured: false,
  },
};
const VENDOR_TYPES = Object.keys(REQUIREMENTS);

// ── Helpers ──────────────────────────────────────────────────
const parseMoney = (v) => Number(String(v || "").replace(/[^0-9.]/g, "")) || 0;
const fmtMoney = (n) => {
  const num = Number(n) || 0;
  return num === 0 ? "—" : "$" + num.toLocaleString("en-US");
};
const parseDate = (s) => (s ? new Date(s) : new Date("invalid"));
const fmtDate = (d) =>
  d && !isNaN(d) ? d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";

function normalizeType(t) {
  const s = (t || "").toLowerCase();
  if (s.includes("general") || s.includes("cgl") || s === "gl") return "gl";
  if (s.includes("auto")) return "auto";
  if (s.includes("work") || s.includes("comp") || s === "wc") return "wc";
  if (s.includes("umbrella") || s.includes("excess")) return "umbrella";
  if (s.includes("prof") || s.includes("e&o") || s.includes("errors")) return "prof";
  return s;
}

function checkCompliance(vendor) {
  const reqs = REQUIREMENTS[vendor.type] || REQUIREMENTS["General Contractor"];
  const checks = [];
  const now = new Date();
  let earliestExp = null;

  reqs.coverages.forEach((req) => {
    const cov = (vendor.coverages || []).find((c) => normalizeType(c.type) === req.type);
    if (!cov) {
      checks.push({ label: req.label, pass: false, detail: `No ${req.label} on file` });
      return;
    }
    const eo = parseMoney(cov.each_occurrence);
    const agg = parseMoney(cov.aggregate);
    if (req.each_occurrence && eo < req.each_occurrence) {
      checks.push({
        label: req.label,
        pass: false,
        detail: `Each-occurrence ${fmtMoney(eo)} is below required ${fmtMoney(req.each_occurrence)}`,
      });
    } else if (req.aggregate && agg < req.aggregate) {
      checks.push({
        label: req.label,
        pass: false,
        detail: `Aggregate ${fmtMoney(agg)} is below required ${fmtMoney(req.aggregate)}`,
      });
    } else {
      checks.push({
        label: req.label,
        pass: true,
        detail: req.each_occurrence ? `${fmtMoney(eo)} each occurrence` : "In force",
      });
    }
    const exp = parseDate(cov.expiration_date);
    if (!isNaN(exp) && (!earliestExp || exp < earliestExp)) earliestExp = exp;
  });

  if (reqs.additionalInsured) {
    checks.push({
      label: "Additional Insured",
      pass: !!vendor.additional_insured,
      detail: vendor.additional_insured
        ? "Certificate holder listed as additional insured"
        : "Certificate holder is not listed as additional insured",
    });
  }

  let daysLeft = null;
  let expiringSoon = false;
  if (earliestExp) {
    daysLeft = Math.ceil((earliestExp - now) / 86400000);
    if (daysLeft < 0) {
      checks.push({ label: "Coverage Active", pass: false, detail: `Coverage lapsed ${fmtDate(earliestExp)}` });
    } else if (daysLeft <= 30) {
      expiringSoon = true;
    }
  }

  const hasFail = checks.some((c) => !c.pass);
  const status = hasFail ? "Non-compliant" : expiringSoon ? "Expiring" : "Compliant";
  return { status, checks, earliestExp, daysLeft };
}

const statusColor = (s) => (s === "Compliant" ? C.ok : s === "Expiring" ? C.warn : C.bad);
const statusLabel = (s, d) => (s === "Expiring" && d != null ? `Expiring · ${d}d` : s);

// ── Seed data (in-memory; resets on refresh) ─────────────────
const HOLDER = "Brookline Property Group";
const SEED = [
  {
    id: 1, name: "Pacific Coast Builders", type: "General Contractor", additional_insured: true,
    certificate_holder: HOLDER,
    coverages: [
      { type: "General Liability", policy_number: "GL-4471902", effective_date: "11/30/2025", expiration_date: "11/30/2026", each_occurrence: "$1,000,000", aggregate: "$2,000,000" },
      { type: "Automobile Liability", policy_number: "CA-2210045", effective_date: "11/30/2025", expiration_date: "11/30/2026", each_occurrence: "$1,000,000", aggregate: "" },
      { type: "Workers Compensation", policy_number: "WC-9981", effective_date: "11/30/2025", expiration_date: "11/30/2026", each_occurrence: "$1,000,000", aggregate: "" },
    ],
  },
  {
    id: 2, name: "Evergreen Janitorial", type: "Janitorial / Cleaning", additional_insured: true,
    certificate_holder: HOLDER,
    coverages: [
      { type: "General Liability", policy_number: "GL-7782", effective_date: "07/05/2025", expiration_date: "07/05/2026", each_occurrence: "$1,000,000", aggregate: "$2,000,000" },
      { type: "Workers Compensation", policy_number: "WC-3321", effective_date: "07/05/2025", expiration_date: "07/05/2026", each_occurrence: "$1,000,000", aggregate: "" },
    ],
  },
  {
    id: 3, name: "Sunset Landscaping", type: "Landscaping", additional_insured: true,
    certificate_holder: HOLDER,
    coverages: [
      { type: "General Liability", policy_number: "GL-5540", effective_date: "10/12/2025", expiration_date: "10/12/2026", each_occurrence: "$1,000,000", aggregate: "$2,000,000" },
      { type: "Workers Compensation", policy_number: "WC-1180", effective_date: "10/12/2025", expiration_date: "10/12/2026", each_occurrence: "$1,000,000", aggregate: "" },
    ],
  },
  {
    id: 4, name: "Lumen Event Co.", type: "Event Vendor", additional_insured: true,
    certificate_holder: HOLDER,
    coverages: [
      { type: "General Liability", policy_number: "GL-3092", effective_date: "09/01/2025", expiration_date: "09/01/2026", each_occurrence: "$500,000", aggregate: "$1,000,000" },
    ],
  },
  {
    id: 5, name: "Apex Plumbing", type: "General Contractor", additional_insured: true,
    certificate_holder: HOLDER,
    coverages: [
      { type: "General Liability", policy_number: "GL-2025", effective_date: "02/15/2025", expiration_date: "02/15/2026", each_occurrence: "$1,000,000", aggregate: "$2,000,000" },
      { type: "Automobile Liability", policy_number: "CA-7741", effective_date: "02/15/2025", expiration_date: "02/15/2026", each_occurrence: "$1,000,000", aggregate: "" },
      { type: "Workers Compensation", policy_number: "WC-6610", effective_date: "02/15/2025", expiration_date: "02/15/2026", each_occurrence: "$1,000,000", aggregate: "" },
    ],
  },
];

const EXTRACT_PROMPT = `You are reading an ACORD 25 Certificate of Liability Insurance (or a similar COI). Extract the data and respond with ONLY a JSON object — no prose, no markdown code fences. Use exactly this schema:
{
  "insured_name": string,            // the named insured (the vendor/business)
  "certificate_holder": string,      // who the certificate is issued to
  "additional_insured": boolean,     // true if the holder/described operations are an additional insured
  "waiver_of_subrogation": boolean,  // true if a waiver of subrogation applies
  "coverages": [
    {
      "type": string,                // "General Liability" | "Automobile Liability" | "Workers Compensation" | "Umbrella/Excess" | "Professional Liability"
      "policy_number": string,
      "effective_date": string,      // MM/DD/YYYY
      "expiration_date": string,     // MM/DD/YYYY
      "each_occurrence": string,     // e.g. "$1,000,000"; for WC use employer's-liability per-accident if shown, else ""
      "aggregate": string            // general aggregate if shown, else ""
    }
  ]
}
Missing fields: use "" for strings and false for booleans. Return only the JSON object.`;

// ── UI atoms ─────────────────────────────────────────────────
function Chip({ status, days }) {
  const c = statusColor(status);
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 7, fontFamily: "'DM Mono', monospace",
      fontSize: 11, letterSpacing: "0.04em", color: c, border: `1px solid ${c}55`,
      background: `${c}14`, padding: "3px 9px", borderRadius: 2, whiteSpace: "nowrap",
    }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: c }} />
      {statusLabel(status, days)}
    </span>
  );
}

function Kpi({ value, label, color }) {
  return (
    <div style={{ background: C.panel, border: `1px solid ${C.lineSoft}`, borderRadius: 3, padding: "20px 22px" }}>
      <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 46, lineHeight: 1, fontWeight: 500, color: color || C.ivory }}>
        {value}
      </div>
      <div style={{ marginTop: 10, fontFamily: "'DM Mono', monospace", fontSize: 10.5, letterSpacing: "0.16em", textTransform: "uppercase", color: C.muted }}>
        {label}
      </div>
    </div>
  );
}

// ── App ──────────────────────────────────────────────────────
export default function App() {
  const [vendors, setVendors] = useState(SEED);
  const [selected, setSelected] = useState(null);
  const [filter, setFilter] = useState("All");
  const [vType, setVType] = useState(VENDOR_TYPES[0]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef(null);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && setSelected(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const results = vendors.map((v) => ({ v, r: checkCompliance(v) }));
  const counts = {
    Compliant: results.filter((x) => x.r.status === "Compliant").length,
    Expiring: results.filter((x) => x.r.status === "Expiring").length,
    "Non-compliant": results.filter((x) => x.r.status === "Non-compliant").length,
  };
  const shown = filter === "All" ? results : results.filter((x) => x.r.status === filter);

  const toBase64 = (file) =>
    new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(String(r.result).split(",")[1]);
      r.onerror = rej;
      r.readAsDataURL(file);
    });

  async function handleFile(e) {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!file) return;
    if (file.type !== "application/pdf") {
      setError("That file isn't a PDF. Upload the ACORD 25 certificate as a PDF.");
      return;
    }
    setError("");
    setBusy(true);
    try {
      const b64 = await toBase64(file);
      const resp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 1000,
          messages: [
            {
              role: "user",
              content: [
                { type: "document", source: { type: "base64", media_type: "application/pdf", data: b64 } },
                { type: "text", text: EXTRACT_PROMPT },
              ],
            },
          ],
        }),
      });
      const data = await resp.json();
      const text = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
      const clean = text.replace(/```json/g, "").replace(/```/g, "").trim();
      const parsed = JSON.parse(clean);
      const v = {
        id: Date.now(),
        name: parsed.insured_name || "Unnamed vendor",
        type: vType,
        additional_insured: !!parsed.additional_insured,
        waiver_of_subrogation: !!parsed.waiver_of_subrogation,
        certificate_holder: parsed.certificate_holder || "",
        coverages: Array.isArray(parsed.coverages) ? parsed.coverages : [],
        source: "upload",
      };
      setVendors((prev) => [v, ...prev]);
      setSelected(v);
    } catch (err) {
      setError("Couldn't read that certificate. Try a clearer PDF, or explore the sample vendors already loaded.");
    } finally {
      setBusy(false);
    }
  }

  const glLimit = (v) => {
    const gl = (v.coverages || []).find((c) => normalizeType(c.type) === "gl");
    return gl ? fmtMoney(parseMoney(gl.each_occurrence)) : "—";
  };

  return (
    <div style={{ background: C.obsidian, minHeight: "100vh", color: C.ivory, fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600&family=DM+Sans:wght@400;500;600&family=DM+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; }
        .coi-row { transition: background .15s ease; cursor: pointer; }
        .coi-row:hover { background: ${C.raised}; }
        .coi-btn { transition: background .15s ease, color .15s ease, border-color .15s ease; cursor: pointer; }
        .coi-btn:hover:not(:disabled) { background: ${C.gold}; color: ${C.obsidian}; border-color: ${C.gold}; }
        .coi-btn:disabled { opacity: .55; cursor: default; }
        .coi-chipbtn { transition: color .15s ease, border-color .15s ease; cursor: pointer; }
        button:focus-visible, select:focus-visible { outline: 2px solid ${C.gold}; outline-offset: 2px; }
        ::-webkit-scrollbar { width: 10px; height: 10px; }
        ::-webkit-scrollbar-thumb { background: ${C.line}; border-radius: 6px; }
        select { background: ${C.panel}; color: ${C.ivory}; border: 1px solid ${C.line}; border-radius: 2px;
                 padding: 9px 12px; font-family: 'DM Sans', sans-serif; font-size: 13px; }
        @keyframes coi-spin { to { transform: rotate(360deg); } }
        @media (prefers-reduced-motion: reduce){ *{ transition:none!important; animation:none!important; } }
      `}</style>

      <div style={{ maxWidth: 1060, margin: "0 auto", padding: "0 22px" }}>
        {/* Header */}
        <header style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between",
          gap: 20, flexWrap: "wrap", padding: "30px 0 22px", borderBottom: `1px solid ${C.line}` }}>
          <div>
            <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 30, fontWeight: 600, letterSpacing: "0.01em" }}>
              Attest<span style={{ color: C.gold }}>·</span>COI
            </div>
            <div style={{ marginTop: 4, fontFamily: "'DM Mono', monospace", fontSize: 11, letterSpacing: "0.14em",
              textTransform: "uppercase", color: C.muted }}>
              Vendor insurance compliance ledger
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
              <select value={vType} onChange={(e) => setVType(e.target.value)} aria-label="Vendor type for upload">
                {VENDOR_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <button className="coi-btn" disabled={busy} onClick={() => fileRef.current && fileRef.current.click()}
                style={{ display: "inline-flex", alignItems: "center", gap: 9, background: "transparent",
                  color: C.gold, border: `1px solid ${C.gold}`, borderRadius: 2, padding: "9px 16px",
                  fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 500 }}>
                {busy && <span style={{ width: 13, height: 13, border: `2px solid ${C.gold}55`,
                  borderTopColor: C.gold, borderRadius: "50%", animation: "coi-spin .7s linear infinite" }} />}
                {busy ? "Reading certificate…" : "Upload COI (PDF)"}
              </button>
              <input ref={fileRef} type="file" accept="application/pdf" onChange={handleFile} style={{ display: "none" }} />
            </div>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: C.muted }}>
              Uploads run live extraction · {vType}
            </div>
          </div>
        </header>

        {error && (
          <div style={{ marginTop: 16, background: `${C.bad}14`, border: `1px solid ${C.bad}55`,
            borderRadius: 3, padding: "11px 14px", display: "flex", justifyContent: "space-between", gap: 14 }}>
            <span style={{ fontSize: 13, color: C.ivory }}>{error}</span>
            <button onClick={() => setError("")} style={{ background: "none", border: "none", color: C.bad,
              cursor: "pointer", fontSize: 13, fontFamily: "'DM Mono', monospace" }}>dismiss</button>
          </div>
        )}

        {/* KPIs */}
        <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 14, margin: "24px 0 8px" }}>
          <Kpi value={vendors.length} label="Vendors tracked" />
          <Kpi value={counts.Compliant} label="Compliant" color={C.ok} />
          <Kpi value={counts.Expiring} label="Expiring ≤ 30 days" color={C.warn} />
          <Kpi value={counts["Non-compliant"]} label="Non-compliant" color={C.bad} />
        </section>

        {/* Filters */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "20px 0 12px" }}>
          {["All", "Non-compliant", "Expiring", "Compliant"].map((f) => {
            const active = filter === f;
            const c = f === "All" ? C.gold : statusColor(f);
            return (
              <button key={f} className="coi-chipbtn" onClick={() => setFilter(f)}
                style={{ background: active ? `${c}1c` : "transparent", color: active ? c : C.muted,
                  border: `1px solid ${active ? c + "66" : C.lineSoft}`, borderRadius: 2, padding: "6px 13px",
                  fontFamily: "'DM Mono', monospace", fontSize: 11, letterSpacing: "0.04em" }}>
                {f}{f !== "All" ? ` · ${counts[f]}` : ` · ${vendors.length}`}
              </button>
            );
          })}
        </div>

        {/* Ledger */}
        <div style={{ overflowX: "auto", border: `1px solid ${C.lineSoft}`, borderRadius: 3, marginBottom: 40 }}>
          <table style={{ width: "100%", minWidth: 720, borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: C.panel }}>
                {["Vendor", "Type", "GL each occ.", "Earliest expiry", "Status"].map((h, i) => (
                  <th key={h} style={{ textAlign: i >= 2 && i <= 3 ? "right" : "left", padding: "12px 18px",
                    fontFamily: "'DM Mono', monospace", fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase",
                    color: C.muted, fontWeight: 400, borderBottom: `1px solid ${C.line}` }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shown.map(({ v, r }) => {
                const expired = r.daysLeft != null && r.daysLeft < 0;
                return (
                  <tr key={v.id} className="coi-row" onClick={() => setSelected(v)}
                    style={{ borderBottom: `1px solid ${C.lineSoft}` }}>
                    <td style={{ padding: "15px 18px" }}>
                      <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 19, fontWeight: 500 }}>
                        {v.name}
                      </div>
                      {v.source === "upload" && (
                        <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 9.5, color: C.gold,
                          letterSpacing: "0.1em" }}>UPLOADED</span>
                      )}
                    </td>
                    <td style={{ padding: "15px 18px", fontSize: 13, color: C.muted }}>{v.type}</td>
                    <td style={{ padding: "15px 18px", textAlign: "right", fontFamily: "'DM Mono', monospace",
                      fontSize: 13, color: C.ivory }}>{glLimit(v)}</td>
                    <td style={{ padding: "15px 18px", textAlign: "right", fontFamily: "'DM Mono', monospace",
                      fontSize: 13, color: expired ? C.bad : r.status === "Expiring" ? C.warn : C.ivory }}>
                      {fmtDate(r.earliestExp)}
                    </td>
                    <td style={{ padding: "15px 18px" }}><Chip status={r.status} days={r.daysLeft} /></td>
                  </tr>
                );
              })}
              {shown.length === 0 && (
                <tr><td colSpan={5} style={{ padding: "34px 18px", textAlign: "center", color: C.muted, fontSize: 14 }}>
                  No vendors in this view. Switch filters or upload a certificate to add one.
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail modal */}
      {selected && (() => {
        const r = checkCompliance(selected);
        return (
          <div onClick={() => setSelected(null)} style={{ position: "fixed", inset: 0, background: "rgba(7,7,9,0.74)",
            display: "flex", justifyContent: "center", alignItems: "flex-start", padding: "5vh 18px", zIndex: 50 }}>
            <div onClick={(e) => e.stopPropagation()} style={{ background: C.panel, border: `1px solid ${C.line}`,
              borderRadius: 4, maxWidth: 620, width: "100%", maxHeight: "90vh", overflowY: "auto" }}>
              <div style={{ padding: "24px 26px", borderBottom: `1px solid ${C.line}`, display: "flex",
                justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
                <div>
                  <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 28, fontWeight: 600 }}>{selected.name}</div>
                  <div style={{ marginTop: 5, fontFamily: "'DM Mono', monospace", fontSize: 11, color: C.muted,
                    letterSpacing: "0.06em" }}>
                    {selected.type} · Holder: {selected.certificate_holder || "—"}
                  </div>
                  <div style={{ marginTop: 12 }}><Chip status={r.status} days={r.daysLeft} /></div>
                </div>
                <button onClick={() => setSelected(null)} style={{ background: "none", border: `1px solid ${C.lineSoft}`,
                  color: C.muted, borderRadius: 2, width: 30, height: 30, cursor: "pointer", fontSize: 16, lineHeight: 1 }}>×</button>
              </div>

              {/* Compliance check */}
              <div style={{ padding: "20px 26px", borderBottom: `1px solid ${C.lineSoft}` }}>
                <SectionLabel>Compliance check</SectionLabel>
                {r.checks.map((c, i) => (
                  <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "9px 0",
                    borderBottom: i < r.checks.length - 1 ? `1px solid ${C.lineSoft}` : "none" }}>
                    <span style={{ color: c.pass ? C.ok : C.bad, fontFamily: "'DM Mono', monospace", fontSize: 14, marginTop: 1 }}>
                      {c.pass ? "✓" : "✕"}
                    </span>
                    <div>
                      <div style={{ fontSize: 13.5, color: C.ivory }}>{c.label}</div>
                      <div style={{ fontSize: 12, color: c.pass ? C.muted : C.bad, marginTop: 2 }}>{c.detail}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Coverages */}
              <div style={{ padding: "20px 26px" }}>
                <SectionLabel>Coverages on certificate</SectionLabel>
                {(selected.coverages || []).length === 0 && (
                  <div style={{ fontSize: 13, color: C.muted }}>No coverages extracted.</div>
                )}
                {(selected.coverages || []).map((c, i) => (
                  <div key={i} style={{ padding: "12px 0", borderBottom: i < selected.coverages.length - 1 ? `1px solid ${C.lineSoft}` : "none" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 13.5, color: C.ivory, fontWeight: 500 }}>{c.type}</span>
                      <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 12.5, color: C.gold }}>
                        {fmtMoney(parseMoney(c.each_occurrence))}
                        {parseMoney(c.aggregate) > 0 ? ` / ${fmtMoney(parseMoney(c.aggregate))} agg` : ""}
                      </span>
                    </div>
                    <div style={{ marginTop: 5, fontFamily: "'DM Mono', monospace", fontSize: 11, color: C.muted, letterSpacing: "0.03em" }}>
                      {(c.policy_number || "no policy #")} · {fmtDate(parseDate(c.effective_date))} → {fmtDate(parseDate(c.expiration_date))}
                    </div>
                  </div>
                ))}
                <div style={{ marginTop: 14, fontFamily: "'DM Mono', monospace", fontSize: 11, color: C.muted }}>
                  Additional insured: {selected.additional_insured ? "yes" : "no"}
                  {"waiver_of_subrogation" in selected ? ` · Waiver of subrogation: ${selected.waiver_of_subrogation ? "yes" : "no"}` : ""}
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

function SectionLabel({ children }) {
  return (
    <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase",
      color: C.gold, marginBottom: 12 }}>
      {children}
    </div>
  );
}
