import { useRef, useState } from "react";
import { useParams } from "wouter";
import { useGetUploadLink, useSubmitUploadLink } from "@workspace/api-client-react";

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

const REQUIREMENTS: Record<string, Array<{ label: string; detail: string }>> = {
  "General Contractor": [
    { label: "General Liability", detail: "$1,000,000 each occurrence / $2,000,000 aggregate" },
    { label: "Automobile Liability", detail: "$1,000,000 each occurrence" },
    { label: "Workers Compensation", detail: "Statutory limits" },
    { label: "Additional Insured", detail: "Certificate holder must be listed" },
  ],
  "Janitorial / Cleaning": [
    { label: "General Liability", detail: "$1,000,000 each occurrence" },
    { label: "Workers Compensation", detail: "Statutory limits" },
    { label: "Additional Insured", detail: "Certificate holder must be listed" },
  ],
  Landscaping: [
    { label: "General Liability", detail: "$1,000,000 each occurrence" },
    { label: "Automobile Liability", detail: "$1,000,000 each occurrence" },
    { label: "Workers Compensation", detail: "Statutory limits" },
    { label: "Additional Insured", detail: "Certificate holder must be listed" },
  ],
  "Event Vendor": [
    { label: "General Liability", detail: "$1,000,000 each occurrence / $2,000,000 aggregate" },
    { label: "Additional Insured", detail: "Certificate holder must be listed" },
  ],
  "Professional Services": [
    { label: "General Liability", detail: "$1,000,000 each occurrence" },
    { label: "Professional Liability", detail: "$1,000,000 each occurrence" },
  ],
};

function getReqs(vendorType: string) {
  return REQUIREMENTS[vendorType] ?? REQUIREMENTS["General Contractor"];
}

export default function UploadPage() {
  const { token } = useParams<{ token: string }>();
  const fileRef = useRef<HTMLInputElement>(null);

  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const { data: linkInfo, isLoading, isError } = useGetUploadLink(token ?? "", {
    query: { enabled: !!token, retry: false },
  });

  const submitMutation = useSubmitUploadLink();

  const toBase64 = (file: File) =>
    new Promise<string>((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(String(r.result).split(",")[1]);
      r.onerror = rej;
      r.readAsDataURL(file);
    });

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.type !== "application/pdf") {
      setError("Please upload a PDF — the ACORD 25 certificate.");
      return;
    }
    setError("");
    try {
      const pdf_base64 = await toBase64(file);
      await submitMutation.mutateAsync({ token: token!, data: { pdf_base64 } });
      setSubmitted(true);
    } catch (err: any) {
      if (err?.status === 410) {
        setError("This upload link has already been used. Please ask your property manager for a new link.");
      } else {
        setError("Something went wrong reading your certificate. Please try again with a clearer PDF.");
      }
    }
  }

  const busy = submitMutation.isPending;

  // ── Loading ──────────────────────────────────────────────────
  if (isLoading) {
    return (
      <Page>
        <div style={{ color: C.muted, fontFamily: "'DM Mono', monospace", fontSize: 13, textAlign: "center", padding: "80px 0" }}>
          Loading…
        </div>
      </Page>
    );
  }

  // ── Invalid / expired token ──────────────────────────────────
  if (isError || !linkInfo) {
    return (
      <Page>
        <div style={{ textAlign: "center", padding: "60px 0" }}>
          <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 28, color: C.ivory, marginBottom: 12 }}>
            Link not found
          </div>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, color: C.muted, maxWidth: 360, margin: "0 auto" }}>
            This upload link is invalid or has expired. Please request a new link from your property manager.
          </div>
        </div>
      </Page>
    );
  }

  // ── Already used ─────────────────────────────────────────────
  if (linkInfo.used_at && !submitted) {
    return (
      <Page>
        <div style={{ textAlign: "center", padding: "60px 0" }}>
          <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 28, color: C.ivory, marginBottom: 12 }}>
            Already submitted
          </div>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, color: C.muted, maxWidth: 380, margin: "0 auto" }}>
            A certificate has already been uploaded via this link. Contact your property manager if you need to resubmit.
          </div>
        </div>
      </Page>
    );
  }

  // ── Success ──────────────────────────────────────────────────
  if (submitted) {
    return (
      <Page>
        <div style={{ textAlign: "center", padding: "60px 0" }}>
          <div style={{ width: 48, height: 48, borderRadius: "50%", background: `${C.ok}18`,
            border: `1px solid ${C.ok}55`, display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 20px", fontSize: 20, color: C.ok }}>
            ✓
          </div>
          <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 32, color: C.ivory, marginBottom: 10 }}>
            Certificate received
          </div>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, color: C.muted, maxWidth: 380, margin: "0 auto", lineHeight: 1.8 }}>
            Your Certificate of Liability Insurance has been submitted and will be reviewed by your property manager.
            No further action is needed.
          </div>
        </div>
      </Page>
    );
  }

  const reqs = getReqs(linkInfo.vendor_type);

  // ── Upload form ──────────────────────────────────────────────
  return (
    <Page>
      {/* Header */}
      <div style={{ marginBottom: 32, paddingBottom: 20, borderBottom: `1px solid ${C.line}` }}>
        <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 28, fontWeight: 600, color: C.ivory }}>
          Submit your Certificate of Insurance
        </div>
        <div style={{ marginTop: 8, fontFamily: "'DM Mono', monospace", fontSize: 12, color: C.muted, letterSpacing: "0.06em" }}>
          For · <span style={{ color: C.ivory }}>{linkInfo.vendor_name}</span>
          <span style={{ margin: "0 8px", color: C.lineSoft }}>|</span>
          <span style={{ color: C.gold }}>{linkInfo.vendor_type}</span>
        </div>
      </div>

      {/* Requirements */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, letterSpacing: "0.14em",
          textTransform: "uppercase", color: C.muted, marginBottom: 14 }}>
          Required coverages
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {reqs.map((req, i) => (
            <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start",
              padding: "10px 14px", background: C.raised, border: `1px solid ${C.lineSoft}`, borderRadius: 2 }}>
              <div style={{ width: 5, height: 5, borderRadius: "50%", background: C.gold,
                flexShrink: 0, marginTop: 7 }} />
              <div>
                <div style={{ fontSize: 13, color: C.ivory, fontWeight: 500 }}>{req.label}</div>
                <div style={{ fontSize: 12, color: C.muted, marginTop: 2,
                  fontFamily: "'DM Mono', monospace" }}>{req.detail}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Instructions */}
      <div style={{ marginBottom: 24, padding: "12px 14px", background: `${C.gold}0a`,
        border: `1px solid ${C.line}`, borderRadius: 2,
        fontFamily: "'DM Mono', monospace", fontSize: 11, color: C.muted, lineHeight: 1.8 }}>
        Upload your ACORD 25 Certificate of Liability Insurance as a PDF. Make sure your policy reflects
        the coverage limits above and lists the certificate holder as an Additional Insured where required.
      </div>

      {/* Error */}
      {error && (
        <div style={{ marginBottom: 16, padding: "11px 14px", background: `${C.bad}14`,
          border: `1px solid ${C.bad}55`, borderRadius: 2, display: "flex",
          justifyContent: "space-between", alignItems: "center", gap: 14 }}>
          <span style={{ fontSize: 13, color: C.ivory }}>{error}</span>
          <button onClick={() => setError("")} style={{ background: "none", border: "none",
            color: C.bad, cursor: "pointer", fontSize: 13 }}>dismiss</button>
        </div>
      )}

      {/* Upload button */}
      <button
        disabled={busy}
        onClick={() => fileRef.current?.click()}
        style={{
          width: "100%", padding: "14px 20px",
          background: "transparent", color: C.gold,
          border: `1px solid ${C.gold}`, borderRadius: 2,
          fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 500,
          cursor: busy ? "not-allowed" : "pointer",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
          opacity: busy ? 0.7 : 1,
        }}
      >
        {busy && (
          <span style={{ width: 14, height: 14, border: `2px solid ${C.gold}55`,
            borderTopColor: C.gold, borderRadius: "50%", animation: "coi-spin .7s linear infinite",
            display: "inline-block" }} />
        )}
        {busy ? "Reading certificate…" : "Choose PDF to upload"}
      </button>
      <input ref={fileRef} type="file" accept="application/pdf" onChange={handleFile} style={{ display: "none" }} />

      <div style={{ marginTop: 14, fontFamily: "'DM Mono', monospace", fontSize: 11, color: C.muted, textAlign: "center" }}>
        PDF only · Your data is used solely for compliance verification
      </div>
    </Page>
  );
}

function Page({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: "#0E0E10", minHeight: "100vh", color: "#F4F1EA",
      fontFamily: "'DM Sans', sans-serif" }}>
      {/* Top bar */}
      <div style={{ borderBottom: "1px solid rgba(194,163,107,0.18)", padding: "18px 24px",
        display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 22, fontWeight: 600 }}>
          Attest<span style={{ color: "#C2A36B" }}>·</span>COI
        </span>
      </div>
      <div style={{ maxWidth: 540, margin: "0 auto", padding: "40px 24px" }}>
        {children}
      </div>

      <style>{`
        @keyframes coi-spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
