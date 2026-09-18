/* Liest die Kennzahlen für die Gesellschafter-Präsentation aus einer Datensicherung des Angebots-Tools.
   Aufruf:  node praesentationen/daten-aus-backup.js <Nova-Works-Sicherung.json>
   Lädt angebote.html headless (Playwright + Chromium), rechnet mit derselben Logik wie die App
   (Auswertung → Summe Bestätigt, Forecast, Deal-Auswertung) und schreibt praesentationen/daten.json. */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const BACKUP = process.argv[2];
if (!BACKUP) { console.error("Aufruf: node daten-aus-backup.js <Sicherung.json>"); process.exit(1); }
const APP = "file://" + path.join(__dirname, "..", "angebote.html");
const OUT = path.join(__dirname, "daten.json");
const EXE = process.env.CHROMIUM_PATH || undefined;   // z. B. /opt/pw-browsers/chromium-1194/chrome-linux/chrome

const num = s => { const m = /-?[\d.]+,\d+/.exec(String(s || "")); return m ? Number(m[0].replace(/\./g, "").replace(",", ".")) : 0; };

(async () => {
  const raw = JSON.parse(fs.readFileSync(BACKUP, "utf8"));
  const db = raw.data || raw;
  const stand = (raw._date || new Date().toISOString()).slice(0, 10).split("-").reverse().join(".");
  const browser = await chromium.launch({ headless: true, executablePath: EXE });
  const page = await browser.newPage();
  await page.route(/^https?:\/\//, r => r.abort());
  await page.addInitScript(([store, json]) => { localStorage.setItem(store, json); localStorage.setItem("fc_range", "12"); }, ["nw_angebote_v1", JSON.stringify(db)]);
  await page.goto(APP, { waitUntil: "load", timeout: 120000 });
  await page.waitForTimeout(1000);
  const r = await page.evaluate(() => {
    try { hideLogin(); } catch (e) {}
    const res = {};
    showView("auswertung"); renderAuswertung();
    const rows = [...document.querySelectorAll("#aw-overview tr")];
    const txt = tr => tr ? [...tr.querySelectorAll("td")].map(td => td.innerText.trim()) : [];
    res.summeBestaetigt = txt(rows.find(tr => tr.innerText.startsWith("Summe Bestätigt")));
    res.summeAngeboten = txt(rows.find(tr => tr.innerText.startsWith("Summe Angeboten")));
    const fc = rng => { fcRange = rng; const C = fcCalc(); return { rangeLbl: C.rangeLbl, periodLbl: C.periodLbl, T: C.T, planIn: C.planIn.length, projekte: C.D.rows.length,
      monate: C.months.map(mk => { const x = C.M[mk]; return { label: fcMonShort(mk), bestaetigt: x.wc, offen: x.wo, abgerechnet: x.erl, soll: x.soll, fix: x.fix }; }) }; };
    res.forecast = { zwoelf: fc("12"), jahr: fc("jahr"), naechstes: fc("next") };
    res.deals = (DB.deals || []).map(d => { try { dealSyncNwRech(d); } catch (e) {}
      const T = dealTotals(d), RS = dealRechSums(d), SP = dealSplitSums(d), BP = dealRechByProject(d);
      return { name: d.name, parteien: dealParties(d).map(dealPartyLbl),
        projekte: (d.projekte || []).map(pid => { const p = DB.projects.find(x => x.id === pid); return { nr: p ? p.nummer : "?", name: p ? p.name : "?", ums: dealParties(d).map(pt => dealUms(d, pid, pt)), kosten: dealKos(d, pid) }; }),
        umsatz: T.ums, kosten: T.kos, auszahlungen: SP.tot, auszahlungenJePartner: SP.perPt,
        rechnungen: { gestelltNetto: BP.reduce((a, x) => a + (x.netto || 0), 0), gestelltBrutto: BP.reduce((a, x) => a + x.sum, 0), gestelltAnz: BP.reduce((a, x) => a + x.n, 0), bezahltBrutto: RS.bez, bezahltAnz: RS.bezN, offenBrutto: RS.offen, offenAnz: RS.offenN,
          jeProjekt: BP.map(x => ({ projekt: dealRechProjLabel(x.pid), n: x.n, netto: x.netto || 0, brutto: x.sum, offen: x.offen, bezahlt: x.bez })) } }; });
    return res;
  });
  await browser.close();
  const sb = r.summeBestaetigt;
  const daten = {
    stand,
    gesamt: sb.length ? { stand, projekte: Number((/(\d+) Projekt/.exec(sb[0]) || [0, 0])[1]), angebot: num(sb[1]), bestaetigt: num(sb[2]), erloeseIst: num(sb[3]), kostenIst: num(sb[4]), eingangsrechnungen: num(sb[5]), margeSoll: num(sb[6]), margeIst: num(sb[7]) } : null,
    angeboten: r.summeAngeboten.length ? { projekte: Number((/(\d+) Projekt/.exec(r.summeAngeboten[0]) || [0, 0])[1]), angebot: num(r.summeAngeboten[1]) } : null,
    forecast: r.forecast,
    deal: r.deals[0] ? Object.assign({ stand }, r.deals[0]) : null,
  };
  fs.writeFileSync(OUT, JSON.stringify(daten, null, 2));
  console.log("geschrieben", OUT, "· Stand", stand, "· Summe Bestätigt:", JSON.stringify(daten.gesamt));
})().catch(e => { console.error("Fehler:", e.message || e); process.exit(1); });
