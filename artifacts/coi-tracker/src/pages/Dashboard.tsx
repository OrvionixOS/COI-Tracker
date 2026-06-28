import React, { useState, useRef, useEffect, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListVendors,
  useGetStats,
  useExtractCoi,
  useCreateVendor,
  useUpdateVendor,
  useDeleteVendor,
  useCreateUploadLink,
  getListVendorsQueryKey,
  getGetStatsQueryKey,
} from "@workspace/api-client-react";
import type { Vendor } from "@workspace/api-client-react";

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
  ok: "#7E9B86",
  warn: "#C9A24B",
  bad: "#B5603F",
};

// ── Coverage requirements by vendor type ─────────────────────
const REQUIREMENTS: Record<string, any> = {
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
const parseMoney = (v: any) => Number(String(v || "").replace(/[^0-9.]/g, "")) || 0;
const fmtMoney = (n: any) => {
  const num = Number(n) || 0;
  return num === 0 ? "—" : "$" + num.toLocaleString("en-US");
};
const parseDate = (s: any) => (s ? new Date(s) : new Date("invalid"));
const fmtDate = (d: any) =>
  d && !isNaN(d.getTime()) ? d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";

function normalizeType(t: any) {
  const s = (t || "").toLowerCase();
  if (s.includes("general") || s.includes("cgl") || s === "gl") return "gl";
  if (s.includes("auto")) return "auto";
  if (s.includes("work") || s.includes("comp") || s === "wc") return "wc";
  if (s.includes("umbrella") || s.includes("excess")) return "umbrella";
  if (s.includes("prof") || s.includes("e&o") || s.includes("errors")) return "prof";
  return s;
}

function checkCompliance(vendor: Vendor) {
  const reqs = REQUIREMENTS[vendor.type] || REQUIREMENTS["General Contractor"];
  const checks: any[] = [];
  const now = new Date();
  let earliestExp: Date | null = null;

  reqs.coverages.forEach((req: any) => {
    const cov = (vendor.coverages || []).find((c: any) => normalizeType(c.type) === req.type);
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
    if (!isNaN(exp.getTime()) && (!earliestExp || exp < earliestExp)) earliestExp = exp;
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

  let daysLeft: number | null = null;
  let expiringSoon = false;
  if (earliestExp) {
    daysLeft = Math.ceil(((earliestExp as Date).getTime() - now.getTime()) / 86400000);
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

const statusColor = (s: string) => (s === "Compliant" ? C.ok : s === "Expiring" ? C.warn : C.bad);
const statusLabel = (s: string, d: number | null) => (s === "Expiring" && d != null ? `Expiring · ${d}d` : s);

// ── Email generation ──────────────────────────────────────────
function generateReminderEmail(vendor: Vendor, result: ReturnType<typeof checkCompliance>): string {
  const holder = vendor.certificate_holder || "our organization";
  const reqs = REQUIREMENTS[vendor.type] || REQUIREMENTS["General Contractor"];
  const failedChecks = result.checks.filter((c) => !c.pass);
  const isExpiring = result.status === "Expiring";
  const expiryStr = result.earliestExp ? fmtDate(result.earliestExp) : "";

  const requirementLines = reqs.coverages.map((r: any) => {
    const parts: string[] = [`  • ${r.label}`];
    if (r.each_occurrence) parts.push(`$${r.each_occurrence.toLocaleString()} each occurrence`);
    if (r.aggregate) parts.push(`$${r.aggregate.toLocaleString()} aggregate`);
    return parts.join(" / ");
  });
  if (reqs.additionalInsured) requirementLines.push(`  • ${holder} listed as Additional Insured`);

  if (isExpiring) {
    return [
      `Subject: Certificate of Insurance Expiring Soon — Renewal Required · ${vendor.name}`,
      "",
      `${vendor.name},`,
      "",
      `We are writing to notify you that your Certificate of Insurance on file with ${holder} is scheduled to expire on ${expiryStr} — ${result.daysLeft} day${result.daysLeft === 1 ? "" : "s"} from today.`,
      "",
      `To maintain uninterrupted compliance and continued authorization to perform work on behalf of ${holder}, please arrange for a renewed certificate to be issued before this date.`,
      "",
      `Your certificate should reflect the following minimum requirements for ${vendor.type} vendors:`,
      "",
      ...requirementLines,
      "",
      `Please have your insurance broker send the updated certificate directly to ${holder} at your earliest convenience.`,
      "",
      `If you have already renewed your policy, please arrange for the updated ACORD 25 to be forwarded to us promptly.`,
      "",
      `Thank you for your prompt attention to this matter.`,
      "",
      `${holder} — Vendor Compliance`,
    ].join("\n");
  }

  const issueLines = failedChecks.map((c) => `  • ${c.label}: ${c.detail}`);

  return [
    `Subject: Action Required — Insurance Certificate Update Needed · ${vendor.name}`,
    "",
    `${vendor.name},`,
    "",
    `We are conducting a routine review of vendor insurance certificates maintained on file with ${holder}.`,
    "",
    `Upon reviewing your most recent Certificate of Liability Insurance, we have identified the following item${failedChecks.length === 1 ? "" : "s"} that require your attention:`,
    "",
    ...issueLines,
    "",
    `To remain in good standing as an authorized ${vendor.type} vendor for ${holder}, please provide an updated certificate that meets the following minimum requirements:`,
    "",
    ...requirementLines,
    "",
    `Please have your insurance broker issue a revised ACORD 25 Certificate of Liability Insurance reflecting these requirements and send it directly to ${holder}.`,
    "",
    `If you believe this notice was sent in error or if you have questions regarding the requirements, please contact us so we can review your file.`,
    "",
    `Thank you for your continued partnership.`,
    "",
    `${holder} — Vendor Compliance`,
  ].join("\n");
}

// ── UI atoms ─────────────────────────────────────────────────
function Chip({ status, days }: { status: string; days: number | null }) {
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

function Kpi({ value, label, color }: { value: number | string; label: string; color?: string }) {
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

// ── App Page ──────────────────────────────────────────────────
export default function Dashboard() {
  const queryClient = useQueryClient();
  const { data: vendors = [], isLoading: vendorsLoading } = useListVendors();
  const { data: stats } = useGetStats();
  
  const extractMutation = useExtractCoi();
  const createMutation = useCreateVendor();
  const deleteMutation = useDeleteVendor();

  const [selected, setSelected] = useState<Vendor | null>(null);
  const [filter, setFilter] = useState("All");
  const [vType, setVType] = useState(VENDOR_TYPES[0]);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [linkCopied, setLinkCopied] = useState<number | null>(null);
  const [remindersOpen, setRemindersOpen] = useState(false);
  const [bulkCopied, setBulkCopied] = useState(false);
  const [emailDraft, setEmailDraft] = useState("");
  const [emailSaving, setEmailSaving] = useState(false);
  const [notesDraft, setNotesDraft] = useState("");
  const [notesSaving, setNotesSaving] = useState(false);
  const [criticalDismissed, setCriticalDismissed] = useState(false);
  const updateMutation = useUpdateVendor();
  const createUploadLinkMutation = useCreateUploadLink();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setSelected(null); setRemindersOpen(false); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    setEmailDraft(selected?.email ?? "");
    setNotesDraft(selected?.notes ?? "");
  }, [selected?.id]);

  const results = useMemo(() => vendors.map((v) => ({ v, r: checkCompliance(v) })), [vendors]);

  const criticalVendors = useMemo(
    () => results.filter(({ r }) => r.daysLeft !== null && r.daysLeft >= 0 && r.daysLeft <= 7),
    [results]
  );

  const counts = useMemo(() => ({
    Compliant: results.filter((x) => x.r.status === "Compliant").length,
    Expiring: results.filter((x) => x.r.status === "Expiring").length,
    "Non-compliant": results.filter((x) => x.r.status === "Non-compliant").length,
  }), [results]);

  const shown = useMemo(() => filter === "All" ? results : results.filter((x) => x.r.status === filter), [filter, results]);

  const actionableVendors = useMemo(
    () => results.filter((x) => x.r.status === "Non-compliant" || x.r.status === "Expiring"),
    [results]
  );

  const patchVendor = async (patch: { email?: string | null; notes?: string | null }) => {
    if (!selected) return;
    const updated = await updateMutation.mutateAsync({
      id: selected.id,
      data: {
        name: selected.name,
        type: selected.type,
        additional_insured: selected.additional_insured,
        waiver_of_subrogation: selected.waiver_of_subrogation,
        certificate_holder: selected.certificate_holder,
        email: "email" in patch ? patch.email : (selected.email ?? null),
        notes: "notes" in patch ? patch.notes : (selected.notes ?? null),
        coverages: selected.coverages ?? [],
        source: selected.source ?? null,
      },
    });
    setSelected(updated);
    queryClient.invalidateQueries({ queryKey: getListVendorsQueryKey() });
  };

  const saveEmail = async () => {
    setEmailSaving(true);
    try { await patchVendor({ email: emailDraft.trim() || null }); }
    finally { setEmailSaving(false); }
  };

  const saveNotes = async () => {
    setNotesSaving(true);
    try { await patchVendor({ notes: notesDraft.trim() || null }); }
    finally { setNotesSaving(false); }
  };

  const openMailto = (vendor: Vendor, result: ReturnType<typeof checkCompliance>) => {
    const body = generateReminderEmail(vendor, result);
    const lines = body.split("\n");
    const subject = lines[0].replace(/^Subject:\s*/i, "");
    const bodyText = lines.slice(2).join("\n");
    const mailto = `mailto:${encodeURIComponent(vendor.email ?? "")}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(bodyText)}`;
    window.open(mailto, "_self");
  };

  const copyEmail = (vendor: Vendor, result: ReturnType<typeof checkCompliance>) => {
    const text = generateReminderEmail(vendor, result);
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(vendor.id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const copyUploadLink = async (vendorId: number) => {
    try {
      const result = await createUploadLinkMutation.mutateAsync({ id: vendorId });
      const base = import.meta.env.BASE_URL.replace(/\/$/, "");
      const url = `${window.location.origin}${base}/upload/${result.token}`;
      await navigator.clipboard.writeText(url);
      setLinkCopied(vendorId);
      setTimeout(() => setLinkCopied(null), 3000);
    } catch {
      /* silently ignore */
    }
  };

  const copyBulk = () => {
    const all = actionableVendors
      .map(({ v, r }) => generateReminderEmail(v, r))
      .join("\n\n" + "─".repeat(60) + "\n\n");
    navigator.clipboard.writeText(all).then(() => {
      setBulkCopied(true);
      setTimeout(() => setBulkCopied(false), 2000);
    });
  };

  const toBase64 = (file: File) =>
    new Promise<string>((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(String(r.result).split(",")[1]);
      r.onerror = rej;
      r.readAsDataURL(file);
    });

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!file) return;
    if (file.type !== "application/pdf") {
      setError("That file isn't a PDF. Upload the ACORD 25 certificate as a PDF.");
      return;
    }
    setError("");
    
    try {
      const b64 = await toBase64(file);
      const extractResult = await extractMutation.mutateAsync({
        data: { pdf_base64: b64, vendor_type: vType }
      });
      
      const newVendor = await createMutation.mutateAsync({
        data: {
          name: extractResult.insured_name || "Unnamed vendor",
          type: vType,
          additional_insured: !!extractResult.additional_insured,
          waiver_of_subrogation: !!extractResult.waiver_of_subrogation,
          certificate_holder: extractResult.certificate_holder || "",
          coverages: Array.isArray(extractResult.coverages) ? extractResult.coverages : [],
          source: "upload",
        }
      });
      
      queryClient.invalidateQueries({ queryKey: getListVendorsQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetStatsQueryKey() });
      setSelected(newVendor);
      
    } catch (err) {
      setError("Couldn't read that certificate. Try a clearer PDF, or check if the server is running.");
    }
  }

  const handleDelete = async (id: number) => {
    try {
      await deleteMutation.mutateAsync({ id });
      queryClient.invalidateQueries({ queryKey: getListVendorsQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetStatsQueryKey() });
      setSelected(null);
    } catch (err) {
      console.error("Failed to delete vendor", err);
    }
  };

  const glLimit = (v: Vendor) => {
    const gl = (v.coverages || []).find((c: any) => normalizeType(c.type) === "gl");
    return gl ? fmtMoney(parseMoney(gl.each_occurrence)) : "—";
  };
  
  const busy = extractMutation.isPending || createMutation.isPending;

  return (
    <div style={{ background: C.obsidian, minHeight: "100vh", color: C.ivory, fontFamily: "'DM Sans', sans-serif" }}>
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
              {actionableVendors.length > 0 && (
                <button className="coi-btn" onClick={() => setRemindersOpen(true)}
                  style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "transparent",
                    color: C.warn, border: `1px solid ${C.warn}55`, borderRadius: 2, padding: "9px 16px",
                    fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 500 }}>
                  <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center",
                    width: 17, height: 17, borderRadius: "50%", background: `${C.warn}22`,
                    fontFamily: "'DM Mono', monospace", fontSize: 10, color: C.warn }}>
                    {actionableVendors.length}
                  </span>
                  Send reminders
                </button>
              )}
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

        {/* 7-day critical expiry banner */}
        {criticalVendors.length > 0 && !criticalDismissed && (
          <div style={{
            marginTop: 16,
            background: `${C.bad}12`,
            border: `1px solid ${C.bad}66`,
            borderLeft: `3px solid ${C.bad}`,
            borderRadius: 3,
            padding: "12px 16px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 14,
          }}>
            <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
              <span style={{ fontSize: 15, lineHeight: 1, marginTop: 1 }}>⚠</span>
              <div>
                <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: C.ivory,
                  fontWeight: 500, marginBottom: 4 }}>
                  {criticalVendors.length === 1
                    ? "1 certificate expiring within 7 days"
                    : `${criticalVendors.length} certificates expiring within 7 days`}
                </div>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: C.bad,
                  lineHeight: 1.6 }}>
                  {criticalVendors.map(({ v, r }) => (
                    <span
                      key={v.id}
                      onClick={() => setSelected(v)}
                      style={{ marginRight: 16, cursor: "pointer", textDecoration: "underline",
                        textDecorationStyle: "dotted", textUnderlineOffset: 3 }}
                    >
                      {v.name} ({r.daysLeft === 0 ? "today" : `${r.daysLeft}d`})
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <button
              onClick={() => setCriticalDismissed(true)}
              style={{ background: "none", border: "none", color: C.muted, cursor: "pointer",
                fontSize: 13, fontFamily: "'DM Mono', monospace", flexShrink: 0, paddingTop: 1 }}
            >
              dismiss
            </button>
          </div>
        )}

        {/* KPIs */}
        <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 14, margin: "24px 0 8px" }}>
          <Kpi value={stats?.total ?? vendors.length} label="Vendors tracked" />
          <Kpi value={stats?.compliant ?? counts.Compliant} label="Compliant" color={C.ok} />
          <Kpi value={stats?.expiring ?? counts.Expiring} label="Expiring ≤ 30 days" color={C.warn} />
          <Kpi value={stats?.non_compliant ?? counts["Non-compliant"]} label="Non-compliant" color={C.bad} />
        </section>

        {/* Filters */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "20px 0 12px" }}>
          {["All", "Non-compliant", "Expiring", "Compliant"].map((f) => {
            const active = filter === f;
            const c = f === "All" ? C.gold : statusColor(f);
            const countLabel = f === "All" ? (stats?.total ?? vendors.length) : (stats?.[f.toLowerCase().replace('-', '_') as keyof typeof stats] ?? counts[f as keyof typeof counts]);
            return (
              <button key={f} className="coi-chipbtn" onClick={() => setFilter(f)}
                style={{ background: active ? `${c}1c` : "transparent", color: active ? c : C.muted,
                  border: `1px solid ${active ? c + "66" : C.lineSoft}`, borderRadius: 2, padding: "6px 13px",
                  fontFamily: "'DM Mono', monospace", fontSize: 11, letterSpacing: "0.04em" }}>
                {f} · {countLabel}
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
              {vendorsLoading ? (
                <tr><td colSpan={5} style={{ padding: "34px 18px", textAlign: "center", color: C.muted, fontSize: 14 }}>
                  Loading vendors...
                </td></tr>
              ) : shown.length === 0 ? (
                <tr><td colSpan={5} style={{ padding: "34px 18px", textAlign: "center", color: C.muted, fontSize: 14 }}>
                  No vendors in this view. Switch filters or upload a certificate to add one.
                </td></tr>
              ) : (
                shown.map(({ v, r }) => {
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
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bulk reminders modal */}
      {remindersOpen && (
        <div onClick={() => setRemindersOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(7,7,9,0.78)",
          display: "flex", justifyContent: "center", alignItems: "flex-start", padding: "5vh 18px", zIndex: 60 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: C.panel, border: `1px solid ${C.line}`,
            borderRadius: 4, maxWidth: 680, width: "100%", maxHeight: "90vh", display: "flex", flexDirection: "column" }}>

            {/* Modal header */}
            <div style={{ padding: "22px 26px", borderBottom: `1px solid ${C.line}`, display: "flex",
              justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexShrink: 0 }}>
              <div>
                <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 24, fontWeight: 600 }}>
                  Reminder drafts
                </div>
                <div style={{ marginTop: 5, fontFamily: "'DM Mono', monospace", fontSize: 11, color: C.muted,
                  letterSpacing: "0.06em" }}>
                  {actionableVendors.length} vendor{actionableVendors.length === 1 ? "" : "s"} require attention
                </div>
              </div>
              <button onClick={() => setRemindersOpen(false)} style={{ background: "none", border: `1px solid ${C.lineSoft}`,
                color: C.muted, borderRadius: 2, width: 30, height: 30, cursor: "pointer", fontSize: 16, lineHeight: 1 }}>×</button>
            </div>

            {/* Per-vendor rows */}
            <div style={{ overflowY: "auto", flex: 1 }}>
              {actionableVendors.map(({ v, r }) => (
                <div key={v.id} style={{ padding: "18px 26px", borderBottom: `1px solid ${C.lineSoft}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
                    gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                      <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 18, fontWeight: 500 }}>{v.name}</div>
                      <Chip status={r.status} days={r.daysLeft} />
                      {v.email
                        ? <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: C.muted }}>{v.email}</span>
                        : <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: `${C.muted}77`,
                            fontStyle: "italic" }}>no email on file</span>
                      }
                    </div>
                    <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                      {v.email && (
                        <button
                          className="coi-btn"
                          onClick={() => openMailto(v, r)}
                          style={{
                            background: `${C.gold}12`, color: C.gold, border: `1px solid ${C.gold}44`,
                            borderRadius: 2, padding: "5px 10px",
                            fontFamily: "'DM Mono', monospace", fontSize: 11, cursor: "pointer",
                            whiteSpace: "nowrap",
                          }}
                        >
                          Send email
                        </button>
                      )}
                      <button
                        className="coi-btn"
                        onClick={() => copyEmail(v, r)}
                        style={{
                          background: copiedId === v.id ? `${C.gold}18` : "transparent",
                          color: copiedId === v.id ? C.gold : C.muted,
                          border: `1px solid ${copiedId === v.id ? C.gold + "55" : C.lineSoft}`,
                          borderRadius: 2, padding: "5px 10px",
                          fontFamily: "'DM Mono', monospace", fontSize: 11, cursor: "pointer",
                          transition: "all .15s ease", whiteSpace: "nowrap",
                        }}
                      >
                        {copiedId === v.id ? "Copied" : "Copy draft"}
                      </button>
                    </div>
                  </div>
                  <pre style={{ margin: 0, fontFamily: "'DM Mono', monospace", fontSize: 11, color: C.muted,
                    lineHeight: 1.7, whiteSpace: "pre-wrap", wordBreak: "break-word",
                    background: C.raised, border: `1px solid ${C.lineSoft}`, borderRadius: 2,
                    padding: "14px 16px", maxHeight: 200, overflowY: "auto" }}>
                    {generateReminderEmail(v, r)}
                  </pre>
                </div>
              ))}
            </div>

            {/* Modal footer */}
            <div style={{ padding: "14px 26px", borderTop: `1px solid ${C.line}`, display: "flex",
              justifyContent: "space-between", alignItems: "center", gap: 12, flexShrink: 0,
              background: "rgba(0,0,0,0.15)" }}>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: C.muted }}>
                Each draft is tailored to the vendor's specific failures.
              </div>
              <button
                className="coi-btn"
                onClick={copyBulk}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 8,
                  background: bulkCopied ? `${C.gold}18` : "transparent",
                  color: bulkCopied ? C.gold : C.warn,
                  border: `1px solid ${bulkCopied ? C.gold + "55" : C.warn + "55"}`,
                  borderRadius: 2, padding: "8px 16px",
                  fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 500,
                  cursor: "pointer", transition: "all .15s ease",
                }}
              >
                {bulkCopied ? "All drafts copied" : `Copy all ${actionableVendors.length} drafts`}
              </button>
            </div>
          </div>
        </div>
      )}

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

              {/* Email address row */}
              <div style={{ padding: "14px 26px", borderBottom: `1px solid ${C.lineSoft}`,
                display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, letterSpacing: "0.1em",
                  textTransform: "uppercase", color: C.muted, flexShrink: 0 }}>
                  Contact email
                </div>
                <input
                  type="email"
                  value={emailDraft}
                  onChange={(e) => setEmailDraft(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && saveEmail()}
                  placeholder="vendor@example.com"
                  style={{
                    flex: 1, background: "transparent", border: "none",
                    borderBottom: `1px solid ${C.line}`, color: C.ivory,
                    fontFamily: "'DM Mono', monospace", fontSize: 12,
                    padding: "3px 0", outline: "none",
                  }}
                />
                {emailDraft !== (selected.email ?? "") && (
                  <button
                    onClick={saveEmail}
                    disabled={emailSaving}
                    style={{
                      background: "transparent", color: C.gold, border: `1px solid ${C.gold}55`,
                      borderRadius: 2, padding: "4px 10px", fontFamily: "'DM Mono', monospace",
                      fontSize: 11, cursor: "pointer", whiteSpace: "nowrap",
                    }}
                  >
                    {emailSaving ? "Saving…" : "Save"}
                  </button>
                )}
              </div>

              {/* Notes */}
              <div style={{ padding: "14px 26px", borderBottom: `1px solid ${C.lineSoft}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
                  marginBottom: 8 }}>
                  <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, letterSpacing: "0.1em",
                    textTransform: "uppercase", color: C.muted }}>
                    Internal notes
                  </div>
                  {notesDraft !== (selected.notes ?? "") && (
                    <button
                      onClick={saveNotes}
                      disabled={notesSaving}
                      style={{
                        background: "transparent", color: C.gold, border: `1px solid ${C.gold}55`,
                        borderRadius: 2, padding: "3px 10px", fontFamily: "'DM Mono', monospace",
                        fontSize: 11, cursor: "pointer",
                      }}
                    >
                      {notesSaving ? "Saving…" : "Save"}
                    </button>
                  )}
                </div>
                <textarea
                  value={notesDraft}
                  onChange={(e) => setNotesDraft(e.target.value)}
                  onBlur={() => { if (notesDraft !== (selected.notes ?? "")) saveNotes(); }}
                  placeholder="e.g. Awaiting renewal from broker · Follow-up sent Jun 22"
                  rows={3}
                  style={{
                    width: "100%", boxSizing: "border-box",
                    background: C.raised, border: `1px solid ${C.lineSoft}`,
                    borderRadius: 2, color: C.ivory, resize: "vertical",
                    fontFamily: "'DM Mono', monospace", fontSize: 11,
                    lineHeight: 1.7, padding: "8px 10px", outline: "none",
                  }}
                />
              </div>

              {/* Compliance check */}
              <div style={{ padding: "20px 26px", borderBottom: `1px solid ${C.lineSoft}` }}>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, letterSpacing: "0.12em",
                  textTransform: "uppercase", color: C.muted, marginBottom: 16 }}>Compliance Check</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {r.checks.map((c, i) => (
                    <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                      <div style={{ width: 14, height: 14, borderRadius: "50%", background: c.pass ? `${C.ok}22` : `${C.bad}22`,
                        border: `1px solid ${c.pass ? C.ok : C.bad}`, display: "flex", alignItems: "center", justifyContent: "center",
                        color: c.pass ? C.ok : C.bad, fontSize: 9, flexShrink: 0, marginTop: 2 }}>
                        {c.pass ? "✓" : "×"}
                      </div>
                      <div>
                        <div style={{ fontSize: 14, color: c.pass ? C.ivory : C.bad }}>{c.label}</div>
                        <div style={{ fontSize: 13, color: C.muted, marginTop: 2 }}>{c.detail}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Coverages on file */}
              <div style={{ padding: "20px 26px", borderBottom: `1px solid ${C.lineSoft}` }}>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, letterSpacing: "0.12em",
                  textTransform: "uppercase", color: C.muted, marginBottom: 16 }}>Coverages on file</div>
                {selected.coverages && selected.coverages.length > 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    {selected.coverages.map((c: any, i: number) => (
                      <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, fontSize: 13 }}>
                        <div>
                          <div style={{ color: C.ivory, fontWeight: 500 }}>{c.type}</div>
                          <div style={{ color: C.muted, fontFamily: "'DM Mono', monospace", fontSize: 11, marginTop: 4 }}>
                            {c.policy_number || "No policy #"}
                          </div>
                          <div style={{ color: C.muted, fontFamily: "'DM Mono', monospace", fontSize: 11, marginTop: 2 }}>
                            {c.effective_date} → {c.expiration_date}
                          </div>
                        </div>
                        <div style={{ textAlign: "right", fontFamily: "'DM Mono', monospace", color: C.muted }}>
                          {c.each_occurrence && <div>{c.each_occurrence} <span style={{ fontSize: 10 }}>EACH OCC</span></div>}
                          {c.aggregate && <div style={{ marginTop: 2 }}>{c.aggregate} <span style={{ fontSize: 10 }}>AGG</span></div>}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ fontSize: 13, color: C.muted }}>No coverages extracted.</div>
                )}
                
                {selected.waiver_of_subrogation && (
                  <div style={{ marginTop: 16, background: `${C.gold}11`, border: `1px solid ${C.line}`,
                    padding: "10px 14px", borderRadius: 2, fontSize: 13, color: C.gold }}>
                    Waiver of subrogation applies to this certificate.
                  </div>
                )}
              </div>

              {/* Footer actions */}
              <div style={{ padding: "16px 26px", background: "rgba(0,0,0,0.2)", display: "flex",
                justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  {(r.status === "Non-compliant" || r.status === "Expiring") && selected.email && (
                    <button
                      className="coi-btn"
                      onClick={() => openMailto(selected, r)}
                      style={{
                        background: `${C.gold}12`, color: C.gold,
                        border: `1px solid ${C.gold}55`,
                        borderRadius: 2, padding: "7px 14px", fontFamily: "'DM Sans', sans-serif",
                        fontSize: 12, fontWeight: 500, cursor: "pointer",
                      }}
                    >
                      Send email
                    </button>
                  )}
                  {(r.status === "Non-compliant" || r.status === "Expiring") && (
                    <button
                      className="coi-btn"
                      onClick={() => copyEmail(selected, r)}
                      style={{
                        background: copiedId === selected.id ? `${C.gold}18` : "transparent",
                        color: copiedId === selected.id ? C.gold : C.muted,
                        border: `1px solid ${copiedId === selected.id ? C.gold + "55" : C.lineSoft}`,
                        borderRadius: 2, padding: "7px 14px", fontFamily: "'DM Sans', sans-serif", fontSize: 12,
                        cursor: "pointer", transition: "all .15s ease",
                      }}
                    >
                      {copiedId === selected.id ? "Copied" : selected.email ? "Copy draft" : "Copy email draft"}
                    </button>
                  )}
                </div>
                <button
                  className="coi-btn"
                  onClick={() => handleDelete(selected.id)}
                  disabled={deleteMutation.isPending}
                  style={{
                    background: "transparent", color: C.bad, border: `1px solid ${C.bad}55`,
                    borderRadius: 2, padding: "7px 14px", fontFamily: "'DM Sans', sans-serif", fontSize: 12,
                    cursor: "pointer"
                  }}
                >
                  {deleteMutation.isPending ? "Deleting..." : "Delete vendor"}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
