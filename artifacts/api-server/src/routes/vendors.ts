import { Router, type IRouter } from "express";
import { eq, count } from "drizzle-orm";
import { db, vendorsTable } from "@workspace/db";
import {
  ListVendorsResponseItem,
  CreateVendorBody,
  GetVendorParams,
  UpdateVendorParams,
  UpdateVendorBody,
  DeleteVendorParams,
} from "@workspace/api-zod";
import Anthropic from "@anthropic-ai/sdk";

const router: IRouter = Router();

const VENDOR_REQUIREMENTS: Record<string, {
  coverages: Array<{ type: string; label: string; each_occurrence?: number; aggregate?: number }>;
  additionalInsured: boolean;
}> = {
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

function normalizeType(t: string): string {
  const s = (t || "").toLowerCase();
  if (s.includes("general") || s.includes("cgl") || s === "gl") return "gl";
  if (s.includes("auto")) return "auto";
  if (s.includes("work") || s.includes("comp") || s === "wc") return "wc";
  if (s.includes("umbrella") || s.includes("excess")) return "umbrella";
  if (s.includes("prof") || s.includes("e&o") || s.includes("errors")) return "prof";
  return s;
}

function parseMoney(v: unknown): number {
  return Number(String(v || "").replace(/[^0-9.]/g, "")) || 0;
}

function parseDate(s: unknown): Date {
  if (!s) return new Date("invalid");
  const str = String(s);
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(str)) {
    const [m, d, y] = str.split("/");
    return new Date(`${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`);
  }
  return new Date(str);
}

function checkCompliance(vendor: {
  type: string;
  additional_insured: boolean;
  coverages: Array<{ type: string; each_occurrence?: string; aggregate?: string; expiration_date?: string }>;
}): { status: string; daysLeft: number | null } {
  const reqs = VENDOR_REQUIREMENTS[vendor.type] ?? VENDOR_REQUIREMENTS["General Contractor"];
  const now = new Date();
  let hasFail = false;
  let earliestExp: Date | null = null;

  for (const req of reqs.coverages) {
    const cov = (vendor.coverages || []).find((c) => normalizeType(c.type) === req.type);
    if (!cov) { hasFail = true; continue; }
    const eo = parseMoney(cov.each_occurrence);
    const agg = parseMoney(cov.aggregate);
    if (req.each_occurrence && eo < req.each_occurrence) hasFail = true;
    else if (req.aggregate && agg < req.aggregate) hasFail = true;
    const exp = parseDate(cov.expiration_date);
    if (!isNaN(exp.getTime()) && (!earliestExp || exp < earliestExp)) earliestExp = exp;
  }

  if (reqs.additionalInsured && !vendor.additional_insured) hasFail = true;

  let daysLeft: number | null = null;
  let expiringSoon = false;
  if (earliestExp) {
    daysLeft = Math.ceil((earliestExp.getTime() - now.getTime()) / 86400000);
    if (daysLeft < 0) hasFail = true;
    else if (daysLeft <= 30) expiringSoon = true;
  }

  const status = hasFail ? "Non-compliant" : expiringSoon ? "Expiring" : "Compliant";
  return { status, daysLeft };
}

function dbToApi(row: { id: number; name: string; type: string; additionalInsured: boolean; waiverOfSubrogation: boolean; certificateHolder: string; coverages: unknown; source: string | null; email: string | null; createdAt: Date }) {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    additional_insured: row.additionalInsured,
    waiver_of_subrogation: row.waiverOfSubrogation,
    certificate_holder: row.certificateHolder,
    email: row.email ?? null,
    coverages: Array.isArray(row.coverages) ? row.coverages : [],
    source: row.source ?? null,
    created_at: row.createdAt?.toISOString?.() ?? "",
  };
}

router.get("/vendors", async (_req, res): Promise<void> => {
  const rows = await db.select().from(vendorsTable).orderBy(vendorsTable.createdAt);
  res.json(rows.map(dbToApi));
});

router.post("/vendors", async (req, res): Promise<void> => {
  const parsed = CreateVendorBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const d = parsed.data;
  const [row] = await db.insert(vendorsTable).values({
    name: d.name,
    type: d.type,
    additionalInsured: d.additional_insured,
    waiverOfSubrogation: d.waiver_of_subrogation,
    certificateHolder: d.certificate_holder,
    email: d.email ?? null,
    coverages: d.coverages as object[],
    source: d.source ?? null,
  }).returning();
  res.status(201).json(dbToApi(row as any));
});

router.get("/vendors/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const [row] = await db.select().from(vendorsTable).where(eq(vendorsTable.id, id));
  if (!row) { res.status(404).json({ error: "Vendor not found" }); return; }
  res.json(dbToApi(row as any));
});

router.put("/vendors/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const parsed = UpdateVendorBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const d = parsed.data;
  const [row] = await db.update(vendorsTable).set({
    name: d.name,
    type: d.type,
    additionalInsured: d.additional_insured,
    waiverOfSubrogation: d.waiver_of_subrogation,
    certificateHolder: d.certificate_holder,
    email: d.email ?? null,
    coverages: d.coverages as object[],
    source: d.source ?? null,
  }).where(eq(vendorsTable.id, id)).returning();
  if (!row) { res.status(404).json({ error: "Vendor not found" }); return; }
  res.json(dbToApi(row as any));
});

router.delete("/vendors/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const [row] = await db.delete(vendorsTable).where(eq(vendorsTable.id, id)).returning();
  if (!row) { res.status(404).json({ error: "Vendor not found" }); return; }
  res.sendStatus(204);
});

router.post("/coi/extract", async (req, res): Promise<void> => {
  const { pdf_base64, vendor_type } = req.body as { pdf_base64: string; vendor_type: string };
  if (!pdf_base64) { res.status(400).json({ error: "pdf_base64 is required" }); return; }

  const EXTRACT_PROMPT = `You are reading an ACORD 25 Certificate of Liability Insurance (or a similar COI). Extract the data and respond with ONLY a JSON object — no prose, no markdown code fences. Use exactly this schema:
{
  "insured_name": string,
  "certificate_holder": string,
  "additional_insured": boolean,
  "waiver_of_subrogation": boolean,
  "coverages": [
    {
      "type": string,
      "policy_number": string,
      "effective_date": string,
      "expiration_date": string,
      "each_occurrence": string,
      "aggregate": string
    }
  ]
}
Missing fields: use "" for strings and false for booleans. Return only the JSON object.`;

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1000,
    messages: [
      {
        role: "user",
        content: [
          { type: "document", source: { type: "base64", media_type: "application/pdf", data: pdf_base64 } },
          { type: "text", text: EXTRACT_PROMPT },
        ],
      },
    ],
  });

  const text = (message.content || [])
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
  const clean = text.replace(/```json/g, "").replace(/```/g, "").trim();
  const parsed = JSON.parse(clean);
  res.json(parsed);
});

router.get("/stats", async (_req, res): Promise<void> => {
  const rows = await db.select().from(vendorsTable);
  const total = rows.length;
  let compliant = 0, expiring = 0, non_compliant = 0;
  for (const row of rows) {
    const vendor = {
      type: row.type,
      additional_insured: row.additionalInsured,
      coverages: Array.isArray(row.coverages) ? row.coverages as any[] : [],
    };
    const { status } = checkCompliance(vendor);
    if (status === "Compliant") compliant++;
    else if (status === "Expiring") expiring++;
    else non_compliant++;
  }
  res.json({ total, compliant, expiring, non_compliant });
});

export default router;
