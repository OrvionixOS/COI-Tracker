import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import crypto from "node:crypto";
import { db, vendorsTable, uploadLinksTable } from "@workspace/db";
import Anthropic from "@anthropic-ai/sdk";

const router: IRouter = Router();

const LINK_TTL_DAYS = 30;

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

function dbToApi(row: { id: number; name: string; type: string; additionalInsured: boolean; waiverOfSubrogation: boolean; certificateHolder: string; coverages: unknown; source: string | null; email: string | null; notes: string | null; createdAt: Date }) {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    additional_insured: row.additionalInsured,
    waiver_of_subrogation: row.waiverOfSubrogation,
    certificate_holder: row.certificateHolder,
    email: row.email ?? null,
    notes: row.notes ?? null,
    coverages: Array.isArray(row.coverages) ? row.coverages : [],
    source: row.source ?? null,
    created_at: row.createdAt?.toISOString?.() ?? "",
  };
}

router.post("/vendors/:id/upload-link", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [vendor] = await db.select({ id: vendorsTable.id }).from(vendorsTable).where(eq(vendorsTable.id, id));
  if (!vendor) { res.status(404).json({ error: "Vendor not found" }); return; }

  const token = crypto.randomUUID().replace(/-/g, "");
  const expiresAt = new Date(Date.now() + LINK_TTL_DAYS * 24 * 60 * 60 * 1000);

  await db.insert(uploadLinksTable).values({ token, vendorId: id, expiresAt });

  res.status(201).json({ token, expires_at: expiresAt.toISOString() });
});

router.get("/upload-links/:token", async (req, res): Promise<void> => {
  const { token } = req.params;

  const [link] = await db
    .select()
    .from(uploadLinksTable)
    .where(eq(uploadLinksTable.token, token));

  if (!link) { res.status(404).json({ error: "Link not found" }); return; }
  if (link.expiresAt < new Date()) { res.status(404).json({ error: "Link expired" }); return; }

  const [vendor] = await db.select().from(vendorsTable).where(eq(vendorsTable.id, link.vendorId));
  if (!vendor) { res.status(404).json({ error: "Vendor not found" }); return; }

  res.json({
    vendor_id: vendor.id,
    vendor_name: vendor.name,
    vendor_type: vendor.type,
    expires_at: link.expiresAt.toISOString(),
    used_at: link.usedAt?.toISOString() ?? null,
  });
});

router.post("/upload-links/:token/submit", async (req, res): Promise<void> => {
  const { token } = req.params;
  const { pdf_base64 } = req.body as { pdf_base64?: string };

  if (!pdf_base64) { res.status(400).json({ error: "pdf_base64 is required" }); return; }

  const [link] = await db
    .select()
    .from(uploadLinksTable)
    .where(eq(uploadLinksTable.token, token));

  if (!link) { res.status(404).json({ error: "Link not found" }); return; }
  if (link.expiresAt < new Date()) { res.status(404).json({ error: "Link expired" }); return; }
  if (link.usedAt) { res.status(410).json({ error: "This link has already been used" }); return; }

  const [vendor] = await db.select().from(vendorsTable).where(eq(vendorsTable.id, link.vendorId));
  if (!vendor) { res.status(404).json({ error: "Vendor not found" }); return; }

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
  const extracted = JSON.parse(clean);

  const [updated] = await db
    .update(vendorsTable)
    .set({
      additionalInsured: !!extracted.additional_insured,
      waiverOfSubrogation: !!extracted.waiver_of_subrogation,
      certificateHolder: extracted.certificate_holder || vendor.certificateHolder,
      coverages: Array.isArray(extracted.coverages) ? extracted.coverages : [],
      source: "vendor-upload",
    })
    .where(eq(vendorsTable.id, link.vendorId))
    .returning();

  await db
    .update(uploadLinksTable)
    .set({ usedAt: new Date() })
    .where(eq(uploadLinksTable.token, token));

  res.json(dbToApi(updated as any));
});

export default router;
