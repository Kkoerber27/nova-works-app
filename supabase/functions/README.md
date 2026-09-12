# Supabase Edge Functions

Die Edge Functions laufen im Supabase-Projekt des Angebots-Tools (`mmudczjjugjlgrzcuxfi`). Deployment mit der Supabase-CLI aus diesem Ordner:

```
supabase login
supabase link --project-ref mmudczjjugjlgrzcuxfi
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
supabase functions deploy kalk-advisor
```

## kalk-advisor

KI-Einschätzung für den Kalkulations-Assistenten im Angebots-Editor (Knopf „✨ KI-Einschätzung“). Bekommt Projektprofil, aktuelles Angebot und Erfahrungswerte aus vergangenen Projekten als JSON und liefert eine deutschsprachige Einschätzung mit Empfehlungen (`{ text }`). Nutzt `claude-opus-5` über das offizielle Anthropic-SDK; der API-Key liegt als Secret `ANTHROPIC_API_KEY` in Supabase, nie im Frontend.

Solange die Function nicht deployt ist, zeigt die App beim Klick einen Hinweis; die Erfahrungswerte im Panel funktionieren unabhängig davon vollständig im Browser.

Die anderen in der App genutzten Functions (`invoice-extract`, `supplier-import`, `tour-import`) sind bereits im Supabase-Projekt eingerichtet; ihr Quellcode liegt nicht in diesem Repo.
