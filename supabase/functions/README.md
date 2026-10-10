# Supabase Edge Functions

Die Edge Functions laufen im Supabase-Projekt des Angebots-Tools (`mmudczjjugjlgrzcuxfi`). Deployment mit der Supabase-CLI aus diesem Ordner:

```
supabase login
supabase link --project-ref mmudczjjugjlgrzcuxfi
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
supabase functions deploy kalk-advisor
supabase functions deploy card-scan
```

## kalk-advisor

KI-Einschätzung für den Kalkulations-Assistenten im Angebots-Editor (Knopf „✨ KI-Einschätzung“). Bekommt Projektprofil, aktuelles Angebot und Erfahrungswerte aus vergangenen Projekten als JSON und liefert eine deutschsprachige Einschätzung mit Empfehlungen (`{ text }`). Nutzt `claude-opus-5` über das offizielle Anthropic-SDK; der API-Key liegt als Secret `ANTHROPIC_API_KEY` in Supabase, nie im Frontend.

Solange die Function nicht deployt ist, zeigt die App beim Klick einen Hinweis; die Erfahrungswerte im Panel funktionieren unabhängig davon vollständig im Browser.

## card-scan

Liest fotografierte Visitenkarten (Knopf „📷 Visitenkarte scannen“ unter Adressen und Crew). Bekommt ein oder zwei Bilder (Vorder- und Rückseite) als Base64 und liefert alle Kontaktfelder als festes JSON (`{ data: { firma, vorname, nachname, position, telefon, mobil, email, web, strasse, plz, ort, land, ustid, …, art } }`); `art` schlägt „kunde“ oder „crew“ vor. Nutzt `claude-opus-5-5` mit strukturierter Ausgabe (`output_config.format`) und der serverseitigen Ausweich-Option `fallbacks: "default"` (Beta `server-side-fallback-2026-07-01`), falls eine Anfrage abgelehnt wird.

Solange die Function nicht deployt ist, liest die App die Karte mit Texterkennung im Browser (tesseract.js von cdn.jsdelivr.net) und festen Regeln – das funktioniert, ist aber ungenauer.

Die anderen in der App genutzten Functions (`invoice-extract`, `supplier-import`, `tour-import`, `doc-extract`) sind bereits im Supabase-Projekt eingerichtet; ihr Quellcode liegt nicht in diesem Repo.
