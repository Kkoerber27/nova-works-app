// Edge Function „kalk-advisor“: KI-Einschätzung für den Kalkulations-Assistenten im Angebots-Tool.
// Erwartet den JSON-Payload aus kaPayload() (Projekt, aktuelles Angebot, Erfahrungswerte) und
// liefert { text } – eine deutschsprachige Einschätzung mit konkreten Kalkulationsempfehlungen.
//
// Einrichten (einmalig, im Repo-Ordner):
//   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
//   supabase functions deploy kalk-advisor
import Anthropic from "npm:@anthropic-ai/sdk";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "content-type": "application/json" } });

const SYSTEM = `Du bist ein erfahrener Kalkulator für Veranstaltungstechnik (Licht, Ton, LED/Video, Rigging, Bühne) bei Nova Works, einem Dienstleister für Festivals, Corporate-Events, Konzerte und Messen.
Du bekommst das aktuelle Angebot (Netto, Einkauf je Kategorie, Crew- und Transportzeilen, Eckdaten) und Erfahrungswerte aus vergangenen Projekten der Firma (geplanter Einkauf, tatsächliche Kosten aus Rechnungen, Margen, Crew-Tage), dazu die Hinweise, die die App bereits berechnet hat.
Deine Aufgabe: Beurteile, ob das Angebot realistisch kalkuliert ist, und gib konkrete, umsetzbare Empfehlungen mit Zahlen in Euro und Prozent. Stütze dich auf die Erfahrungswerte, nicht auf allgemeine Branchenzahlen. Benenne Risiken (Personal, Transport, Nebenkosten, Auf-/Abbautage, Ort, Zeitraum) und was der Kalkulator prüfen sollte. Wenn Daten fehlen oder die Vergleichsbasis dünn ist, sag das klar.
Antworte auf Deutsch, knapp und strukturiert als Klartext ohne Markdown-Sternchen: Abschnitte „Einschätzung“, „Empfehlungen“ (nummeriert, mit Zahlen), „Risiken / prüfen“. Maximal etwa 300 Wörter.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST erwartet" }, 405);
  if (!req.headers.get("authorization")) return json({ error: "nicht angemeldet" }, 401);
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) return json({ error: "ANTHROPIC_API_KEY fehlt (supabase secrets set …)" }, 500);

  let payload: unknown;
  try { payload = await req.json(); } catch { return json({ error: "ungültiger JSON-Body" }, 400); }

  const client = new Anthropic({ apiKey });
  try {
    const response = await client.messages.create({
      model: "claude-opus-5",
      max_tokens: 4000,
      output_config: { effort: "medium" },
      system: SYSTEM,
      messages: [{ role: "user", content: "Daten (JSON):\n" + JSON.stringify(payload) }],
    });
    if (response.stop_reason === "refusal") return json({ error: "Anfrage wurde vom Modell abgelehnt" }, 422);
    const text = response.content.filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
    return json({ text });
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) return json({ error: "Anthropic-API-Key ungültig" }, 500);
    if (error instanceof Anthropic.RateLimitError) return json({ error: "Rate-Limit erreicht, bitte gleich noch einmal" }, 429);
    if (error instanceof Anthropic.APIError) return json({ error: `Anthropic-Fehler ${error.status}: ${error.message}` }, 502);
    return json({ error: String(error) }, 500);
  }
});
