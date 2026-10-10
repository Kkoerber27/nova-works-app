// Edge Function „card-scan“: liest Kontaktdaten von fotografierten Visitenkarten (Vorder- und
// optional Rückseite) für das Angebots-Tool und liefert sie als festes JSON { data: {...} }.
//
// Erwartet: { images: [{ d: "<base64 ohne data:-Präfix>", mt: "image/jpeg" }, …] } (max. 2 Bilder)
//
// Einrichten (einmalig, im Repo-Ordner; ANTHROPIC_API_KEY ist schon gesetzt, falls kalk-advisor läuft):
//   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
//   supabase functions deploy card-scan
import Anthropic from "npm:@anthropic-ai/sdk@0.133.0";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "content-type": "application/json" } });

const FIELDS = [
  "firma", "abteilung", "anrede", "vorname", "nachname", "position",
  "telefon", "mobil", "fax", "email", "web",
  "strasse", "plz", "ort", "land", "ustid", "sonstiges", "art", "art_grund",
] as const;

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [...FIELDS],
  properties: {
    firma: { type: "string", description: "Firmenname inkl. Rechtsform, leer bei Einzelperson ohne Firma" },
    abteilung: { type: "string", description: "Abteilung / Bereich, falls angegeben" },
    anrede: { type: "string", enum: ["", "Herr", "Frau"], description: "Nur wenn eindeutig (Vorname oder Anrede auf der Karte)" },
    vorname: { type: "string" },
    nachname: { type: "string" },
    position: { type: "string", description: "Funktion / Jobtitel, z. B. Projektleiter, Lichttechniker" },
    telefon: { type: "string", description: "Festnetz / Büro, international lesbar, z. B. +49 221 123456" },
    mobil: { type: "string" },
    fax: { type: "string" },
    email: { type: "string" },
    web: { type: "string", description: "Webadresse ohne https://" },
    strasse: { type: "string", description: "Straße und Hausnummer" },
    plz: { type: "string" },
    ort: { type: "string" },
    land: { type: "string", description: "Land auf Deutsch, Deutschland wenn deutsche Adresse ohne Angabe" },
    ustid: { type: "string", description: "USt-IdNr., falls angegeben" },
    sonstiges: { type: "string", description: "Weitere Angaben (Social Media, zweite Adresse, Zertifikate …), sonst leer" },
    art: { type: "string", enum: ["kunde", "crew", "unklar"] },
    art_grund: { type: "string", description: "Kurz, warum kunde oder crew" },
  },
};

const SYSTEM = `Du liest Visitenkarten für Nova Works, einen Dienstleister für Veranstaltungstechnik (Licht, Ton, LED/Video, Rigging, Bühne).
Übertrage jede Angabe der Karte genau so, wie sie dort steht, in das passende Feld. Erfinde nichts: Was nicht auf der Karte steht, bleibt ein leerer String. Bei mehreren Bildern gehören sie zur selben Karte (Vorder- und Rückseite).
Telefonnummern: Mobilnummern (in Deutschland 015x, 016x, 017x oder als „Mobil“, „M“, „Handy“ beschriftet) in „mobil“, sonst in „telefon“.
Feld „art“: „crew“, wenn die Karte zu einer einzelnen Person aus der Veranstaltungstechnik gehört, die Nova Works als Freelancer buchen würde (z. B. Licht-, Ton-, Video-, Rigging-Techniker, Operator, Stagehand, Crew-Chief, kleines Ein-Personen-Technikunternehmen). „kunde“ für Agenturen, Veranstalter, Firmen, Locations, Lieferanten und Ansprechpartner dort. „unklar“, wenn beides plausibel ist.`;

type Img = { d?: unknown; mt?: unknown };
const MEDIA = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST erwartet" }, 405);
  if (!req.headers.get("authorization")) return json({ error: "nicht angemeldet" }, 401);
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) return json({ error: "ANTHROPIC_API_KEY fehlt (supabase secrets set …)" }, 500);

  let body: { images?: Img[] };
  try { body = await req.json(); } catch { return json({ error: "ungültiger JSON-Body" }, 400); }
  const images = (Array.isArray(body.images) ? body.images : [])
    .filter((i) => typeof i.d === "string" && i.d.length > 100)
    .slice(0, 2);
  if (!images.length) return json({ error: "kein Bild übergeben" }, 400);

  const content: Anthropic.Beta.Messages.BetaContentBlockParam[] = images.map((i) => ({
    type: "image" as const,
    source: {
      type: "base64" as const,
      media_type: (MEDIA.has(String(i.mt)) ? i.mt : "image/jpeg") as "image/jpeg" | "image/png" | "image/webp" | "image/gif",
      data: String(i.d),
    },
  }));
  content.push({ type: "text", text: images.length > 1 ? "Vorder- und Rückseite einer Visitenkarte. Bitte auslesen." : "Visitenkarte. Bitte auslesen." });

  const client = new Anthropic({ apiKey });
  try {
    const response = await client.beta.messages.create({
      model: "claude-opus-5-5",
      max_tokens: 4000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA } },
      system: SYSTEM,
      messages: [{ role: "user", content }],
    });
    if (response.stop_reason === "refusal") return json({ error: "Bild wurde vom Modell abgelehnt" }, 422);
    if (response.stop_reason === "max_tokens") return json({ error: "Antwort unvollständig – bitte erneut versuchen" }, 502);
    const text = response.content.filter((b) => b.type === "text").map((b) => (b as { text: string }).text).join("");
    let data: Record<string, string>;
    try { data = JSON.parse(text); } catch { return json({ error: "Antwort nicht lesbar – bitte erneut versuchen" }, 502); }
    const out: Record<string, string> = {};
    for (const k of FIELDS) out[k] = typeof data[k] === "string" ? data[k].trim() : "";
    return json({ data: out });
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) return json({ error: "Anthropic-API-Key ungültig" }, 500);
    if (error instanceof Anthropic.RateLimitError) return json({ error: "Rate-Limit erreicht, bitte gleich noch einmal" }, 429);
    if (error instanceof Anthropic.BadRequestError) return json({ error: `Anfrage abgelehnt: ${error.message}` }, 400);
    if (error instanceof Anthropic.APIError) return json({ error: `Anthropic-Fehler ${error.status}: ${error.message}` }, 502);
    return json({ error: String(error) }, 500);
  }
});
