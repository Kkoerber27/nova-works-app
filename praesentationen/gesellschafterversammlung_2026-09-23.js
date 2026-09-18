/* Gesellschafterversammlung NOVA WORKS GmbH · Denkendorf, 23.09.2026
   Erzeugen:  node praesentationen/gesellschafterversammlung_2026-09-23.js
   Zahlen unten (DEAL, FORECAST) sind die einzigen Stellen, die bei neuem Stand angepasst werden müssen. */
const pptxgen = require("pptxgenjs");
const path = require("path");

const LOGO = path.join(__dirname, "..", "scripts", "assets", "nova-works-logo.png");
const OUT  = path.join(__dirname, "Gesellschafterversammlung_2026-09-23.pptx");

/* ---------- Nova-Works-Design (aus angebote.html) ---------- */
const C = { bg:"F7F5F2", panel:"FFFFFF", ink:"3D3D3D", inkSoft:"6A6A6A", gold:"A8884F", goldSoft:"C7AB78", goldBg:"F4EEE2", line:"E4E1DB", lineSoft:"EFECE7", grey:"8A8A8A", greyLight:"C8C8C8", ok:"5A7D52", danger:"B4493F" };
const FONT = "Helvetica";
const W = 13.333, H = 7.5;

/* ---------- Daten ---------- */
/* Deal-Auswertung ProEvent 2026 (Nova Works App → Auswertung → Deal-Auswertung), Stand 07.08.2026, alle Beträge netto */
const DEAL = {
  stand: "07.08.2026",
  parteien: ["Nova Works", "CGS", "TCLG"],
  projekte: [
    { nr:"26-0007", name:"80er Live",  ums:[412556, 235000, 245000], kosten:151483.36 },
    { nr:"26-0008", name:"Oberhausen", ums:[114210,  65000,  55000], kosten:157113.91 },
  ],
  rechnungen: { gestelltNetto:874624, gestelltBrutto:1040752.56, bezahltBrutto:678992.56, bezahltAnz:15, offenBrutto:361760, offenAnz:7 },
};
/* Forecast (Nova Works App → Forecast → PowerPoint-Export). null = Zahlen liegen noch nicht vor. */
const FORECAST = null;
/* Beispielstruktur:
const FORECAST = { zeitraum:"Nächste 12 Monate", bestaetigt:0, offenGewichtet:0, abgerechnet:0, marge:0, fixkosten:0,
  monate:[{ label:"Okt 26", bestaetigt:0, offen:0, abgerechnet:0 }, …] }; */

const eur = n => (Math.round(n)).toLocaleString("de-DE") + " €";
const eurK = n => (Math.round(n/1000)).toLocaleString("de-DE") + " T€";
const pct = (a,b) => b>0 ? Math.round(a/b*100)+" %" : "–";

/* ---------- Deck ---------- */
const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE";
pres.author = "NOVA WORKS GmbH"; pres.company = "NOVA WORKS GmbH"; pres.lang = "de-DE";
pres.title = "Gesellschafterversammlung NOVA WORKS GmbH – 23.09.2026";

let pageNo = 1;
function txt(s, t, o){ s.addText(t, Object.assign({ fontFace:FONT, color:C.ink, margin:0, isTextBox:true }, o)); }
function card(s, x, y, w, h, fill){
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, fill:{ color:fill||C.panel }, line:{ color:C.line, width:0.75 }, rectRadius:0.12,
    shadow:{ type:"outer", color:"000000", opacity:0.06, blur:6, offset:2, angle:90 } });
}
function circleNo(s, x, y, d, n, fs){
  s.addShape(pres.shapes.OVAL, { x, y, w:d, h:d, fill:{ color:C.goldBg }, line:{ color:C.goldBg } });
  txt(s, String(n), { x, y, w:d, h:d, fontSize:fs||22, bold:true, color:C.gold, align:"center", valign:"middle" });
}
function contentSlide(topNr, title, sub){
  const s = pres.addSlide(); pageNo++;
  s.background = { color:C.bg };
  s.addImage({ path:LOGO, x:W-0.6-1.8, y:0.42, w:1.8, h:0.452 });
  txt(s, "NOVA WORKS GmbH  ·  Gesellschafterversammlung  ·  Denkendorf, 23.09.2026", { x:0.6, y:H-0.55, w:9, h:0.3, fontSize:9, color:C.inkSoft, valign:"middle" });
  txt(s, String(pageNo), { x:W-1.2, y:H-0.55, w:0.6, h:0.3, fontSize:9, color:C.inkSoft, align:"right", valign:"middle" });
  if(topNr){ circleNo(s, 0.6, 0.55, 0.75, topNr, 22); }
  txt(s, title, { x:topNr?1.55:0.6, y:0.5, w:9.2, h:0.85, fontSize:30, bold:true, valign:"middle" });
  if(sub) txt(s, sub, { x:topNr?1.55:0.6, y:1.3, w:9.5, h:0.35, fontSize:12.5, color:C.inkSoft });
  return s;
}
function kpi(s, x, y, w, label, value, sub, col){
  card(s, x, y, w, 1.35);
  const narrow = w < 2.5;
  txt(s, label.toUpperCase(), { x:x+0.25, y:y+0.18, w:w-0.5, h:0.28, fontSize:narrow?8:9, color:C.inkSoft, charSpacing:narrow?0.6:1.5 });
  txt(s, value, { x:x+0.25, y:y+0.45, w:w-0.5, h:0.5, fontSize:22, bold:true, color:col||C.ink, valign:"middle" });
  if(sub) txt(s, sub, { x:x+0.25, y:y+0.95, w:w-0.5, h:0.28, fontSize:9.5, color:C.inkSoft });
}
function placeholder(s, x, y, w, h, text){
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, fill:{ color:C.panel }, line:{ color:C.goldSoft, width:0.75, dashType:"dash" }, rectRadius:0.12 });
  txt(s, text||"Inhalt folgt", { x, y, w, h, fontSize:14, italic:true, color:C.goldSoft, align:"center", valign:"middle" });
}
const TH = t => ({ text:t, options:{ bold:true, color:C.inkSoft, fontSize:8.5, fontFace:FONT, charSpacing:1, align:t.r?"right":"left", fill:{ color:C.goldBg }, border:[{type:"none"},{type:"none"},{type:"solid",color:C.line,pt:0.75},{type:"none"}], margin:[3,5,3,5] } });
const THr = t => { const o = TH(t); o.options.align = "right"; return o; };
const TD = (t,o) => { o=o||{}; return { text:t, options:{ color:o.col||C.ink, fontSize:o.fs||10, fontFace:FONT, bold:!!o.b, align:o.r?"right":"left", fill:o.fill?{ color:o.fill }:undefined, border:[{type:"none"},{type:"none"},{type:"solid",color:o.bt?C.ink:C.lineSoft,pt:o.bt?1:0.5},{type:"none"}], margin:[3,5,3,5] } }; };
const chartBase = { catAxisLabelColor:C.inkSoft, catAxisLabelFontSize:9, catAxisLabelFontFace:FONT, valAxisLabelColor:C.inkSoft, valAxisLabelFontSize:8, valAxisLabelFontFace:FONT,
  valGridLine:{ style:"solid", color:C.lineSoft, size:0.5 }, catGridLine:{ style:"none" }, catAxisLineColor:C.line, valAxisLineColor:C.line, dataLabelFontFace:FONT, valAxisLabelFormatCode:"#,##0", legendFontFace:FONT, legendFontSize:9, legendColor:C.inkSoft, titleFontFace:FONT, titleFontSize:10, titleColor:C.inkSoft };

/* ---------- TOPs ---------- */
const TOPS = [
  { nr:1, titel:"Kurze Zusammenfassung und IST-Zustand", sub:"Wo steht die NOVA WORKS GmbH heute?" },
  { nr:2, titel:"Überblick der letzten 4 Monate",          sub:"Projekte Mai bis September 2026 · Vorstellung der Nova Works App" },
  { nr:3, titel:"80er im Detail und Zukunft Kunde MK?",     sub:"Deal-Auswertung 26-0007 80er Live und 26-0008 Oberhausen" },
  { nr:4, titel:"Messeauftritt",                            sub:"Planung, Ziele und Budget" },
  { nr:5, titel:"Forecast und Ausblick",                    sub:"Zusammenfassung aus dem Forecast der Nova Works App" },
  { nr:6, titel:"Sonstiges",                                sub:"Verschiedenes, Beschlüsse und nächste Schritte" },
];

/* ===== 1 Titel ===== */
{
  const s = pres.addSlide();
  s.background = { color:C.bg };
  s.addShape(pres.shapes.RECTANGLE, { x:W*0.62, y:0, w:W*0.38, h:H, fill:{ color:C.goldBg }, line:{ color:C.goldBg } });
  s.addImage({ path:LOGO, x:1.0, y:1.2, w:4.6, h:1.156 });
  txt(s, "Gesellschafterversammlung", { x:1.0, y:3.05, w:7.1, h:0.8, fontSize:34, bold:true, valign:"top" });
  txt(s, "NOVA WORKS GmbH", { x:1.0, y:3.95, w:7.0, h:0.55, fontSize:22, color:C.gold, charSpacing:2 });
  txt(s, "Denkendorf, 23. September 2026", { x:1.0, y:5.55, w:7.0, h:0.45, fontSize:16, color:C.inkSoft });
  const kx = W*0.62+1.05;
  card(s, kx, 2.55, 3.0, 2.4);
  txt(s, "23", { x:kx, y:2.75, w:3.0, h:1.2, fontSize:66, bold:true, color:C.gold, align:"center", valign:"middle" });
  txt(s, "September 2026", { x:kx, y:3.95, w:3.0, h:0.4, fontSize:14, align:"center" });
  txt(s, "Denkendorf", { x:kx, y:4.35, w:3.0, h:0.4, fontSize:12, color:C.inkSoft, align:"center" });
}

/* ===== 2 Tagesordnung ===== */
{
  const s = contentSlide(null, "Tagesordnung", "Sechs Tagesordnungspunkte");
  const cw = 3.9, ch = 2.15, gx = 0.6, gy = 1.95, gap = 0.31;
  TOPS.forEach((t, i) => {
    const col = i % 3, row = Math.floor(i / 3);
    const x = gx + col*(cw+gap), y = gy + row*(ch+gap);
    card(s, x, y, cw, ch);
    circleNo(s, x+0.3, y+0.35, 0.7, t.nr, 20);
    txt(s, "TOP "+t.nr, { x:x+1.2, y:y+0.38, w:cw-1.4, h:0.35, fontSize:11, color:C.gold, charSpacing:1.5, bold:true });
    txt(s, t.titel, { x:x+0.3, y:y+1.15, w:cw-0.6, h:0.8, fontSize:15, bold:true, valign:"top" });
  });
}

/* ===== 3 TOP 1 ===== */
{
  const t = TOPS[0]; const s = contentSlide(t.nr, t.titel, t.sub);
  const nw = DEAL.projekte.reduce((a,p)=>a+p.ums[0],0), kos = DEAL.projekte.reduce((a,p)=>a+p.kosten,0), all = DEAL.projekte.reduce((a,p)=>a+p.ums.reduce((x,y)=>x+y,0),0);
  txt(s, "ZAHLEN AUS DEM DEAL PROEVENT 2026 · STAND "+DEAL.stand+" · NETTO", { x:0.6, y:1.95, w:7, h:0.3, fontSize:9, color:C.inkSoft, charSpacing:1.5 });
  kpi(s, 0.6, 2.3, 3.7, "Umsatz Nova Works", eur(nw), "Anteil "+pct(nw,all)+" am Gesamtdeal "+eur(all));
  kpi(s, 4.5, 2.3, 3.7, "Marge Nova-Works-Sicht", eur(nw-kos), pct(nw-kos,nw)+" · Kosten "+eur(kos), C.ok);
  kpi(s, 0.6, 3.85, 3.7, "Offene Kundenrechnungen", eur(DEAL.rechnungen.offenBrutto), DEAL.rechnungen.offenAnz+" Rechnungen · brutto · alle Parteien", C.gold);
  kpi(s, 4.5, 3.85, 3.7, "Bezahlt", eur(DEAL.rechnungen.bezahltBrutto), DEAL.rechnungen.bezahltAnz+" Rechnungen · brutto · alle Parteien");
  card(s, 8.6, 1.95, 4.13, 4.6);
  txt(s, "IST-ZUSTAND", { x:8.9, y:2.15, w:3.6, h:0.3, fontSize:9, color:C.inkSoft, charSpacing:1.5 });
  const pts = ["Team und Auslastung", "Liquidität und offene Forderungen", "Kunden und Partner (ProEvent, CGS, TCLG)", "Werkzeuge: Nova Works App im Einsatz", "Offene Punkte"];
  s.addText(pts.map((p,i)=>({ text:p, options:{ bullet:{ code:"25A0" }, breakLine:i<pts.length-1, paraSpaceAfter:8 } })),
    { x:8.9, y:2.5, w:3.6, h:2.6, fontFace:FONT, fontSize:12.5, color:C.ink, margin:0, isTextBox:true, valign:"top" });
  txt(s, "Stichpunkte werden vor der Versammlung ergänzt.", { x:8.9, y:5.7, w:3.6, h:0.6, fontSize:10, italic:true, color:C.goldSoft });
  s.addNotes("TOP 1 – Kurze Zusammenfassung und IST-Zustand. Kennzahlen stammen aus der Deal-Auswertung ProEvent 2026 (Stand 07.08.2026).");
}

/* ===== 4 TOP 2a Zeitstrahl ===== */
{
  const t = TOPS[1]; const s = contentSlide(t.nr, t.titel, "Was ist seit Mai 2026 passiert?");
  const months = ["Mai", "Juni", "Juli", "August", "September"];
  const x0 = 0.6, x1 = W-0.6, y = 2.55, mw = (x1-x0)/months.length;
  s.addShape(pres.shapes.LINE, { x:x0, y:y, w:x1-x0, h:0, line:{ color:C.goldSoft, width:1.5 } });
  months.forEach((m,i) => {
    s.addShape(pres.shapes.OVAL, { x:x0+i*mw+mw/2-0.09, y:y-0.09, w:0.18, h:0.18, fill:{ color:C.gold }, line:{ color:C.gold } });
    txt(s, m+" 2026", { x:x0+i*mw, y:y-0.55, w:mw, h:0.35, fontSize:12, bold:true, align:"center", color:C.ink });
  });
  const items = [
    { m:0, t:"Vorbereitung Inselfieber", d:"26-0008 · Vorkasse an ProEvent" },
    { m:1, t:"Inselfieber Oberhausen", d:"26-0008 · 10.–15.06. · Royal Stage, Bühne, Rigging, LED" },
    { m:2, t:"80er Live Hamburg", d:"26-0007.01 · Audio, Backline, Zusätze" },
    { m:2, t:"80er Live Schalke", d:"26-0007 · Backline Zusätze" },
    { m:3, t:"80er Live Frankfurt", d:"26-0007.03 · Abschlussrechnung 26.08." },
    { m:3, t:"Weitere Projekte", d:"SWR NPF 2026 · Ina Müller & Band · Red Bull Energy Station" },
    { m:4, t:"Nova Works App", d:"Forecast, Deal-Auswertung, Kalkulations-Assistent, Messen" },
    { m:4, t:"Gesellschafter-\nversammlung", d:"23.09. Denkendorf" },
  ];
  const slots = {};
  items.forEach(it => {
    const k = it.m, n = slots[k] = (slots[k]||0)+1;
    const cx = x0+it.m*mw+0.12, cw = mw-0.24, cy = y+0.35+(n-1)*1.7;
    card(s, cx, cy, cw, 1.5);
    txt(s, it.t, { x:cx+0.18, y:cy+0.15, w:cw-0.36, h:0.45, fontSize:12, bold:true, valign:"top" });
    txt(s, it.d, { x:cx+0.18, y:cy+0.62, w:cw-0.36, h:0.8, fontSize:9.5, color:C.inkSoft, valign:"top" });
  });
  s.addNotes("TOP 2 – Überblick der letzten 4 Monate. Zeitstrahl der Projekte seit Mai 2026.");
}

/* ===== 5 TOP 2b Nova Works App ===== */
{
  const t = TOPS[1]; const s = contentSlide(t.nr, "Die Nova Works App", "Eine Web-App für Angebot, Crew, Disposition, Auswertung und Forecast · angebote.nova-works.de");
  const cols = [
    { h:"Angebote & Projekte", l:["Projekte mit Angeboten, Jobs und Material", "Angebots-PDF und Zusätze im Nova-Design", "Crew-Kalkulation und Transport", "Kalkulations-Assistent mit Erfahrungswerten und KI-Einschätzung", "Lieferanten-Anfragen als PDF"] },
    { h:"Crew & Disposition", l:["Crewplanung nach Gewerken und Phasen", "Crew Sheet, Schichtplan, Bauzeitenplan", "Hotelplanung und Funkgeräte-Ausgabe", "Crew per E-Mail anfragen", "Freelancer-Datenbank mit Adressen"] },
    { h:"Zahlen & Steuerung", l:["Projektauswertung Soll / Ist je Kategorie", "Deal-Auswertung mit Partnern und Kostensplit", "Rechnungseingang mit Zuordnung", "Forecast: Umsatz, Marge, Fixkosten je Monat", "Overhead, Messen und Lexware-Anbindung"] },
  ];
  const cw = 3.9, gap = 0.31;
  cols.forEach((c,i) => {
    const x = 0.6+i*(cw+gap), y = 1.95;
    card(s, x, y, cw, 4.6);
    circleNo(s, x+0.3, y+0.3, 0.6, i+1, 16);
    txt(s, c.h, { x:x+1.05, y:y+0.3, w:cw-1.3, h:0.6, fontSize:15, bold:true, valign:"middle" });
    s.addText(c.l.map((p,j)=>({ text:p, options:{ bullet:{ code:"25A0" }, breakLine:j<c.l.length-1, paraSpaceAfter:7 } })),
      { x:x+0.3, y:y+1.15, w:cw-0.6, h:3.2, fontFace:FONT, fontSize:11.5, color:C.ink, margin:0, isTextBox:true, valign:"top" });
  });
  s.addNotes("TOP 2 – Vorstellung der Nova Works App: Angebots-Tool (angebote.nova-works.de) und Crewplanung, beide mit Supabase-Cloud, Mehrbenutzer und Zugriff für Claude über MCP.");
}

/* ===== 6 TOP 3a Deal-Auswertung ===== */
{
  const t = TOPS[2]; const s = contentSlide(t.nr, t.titel, "Deal-Auswertung ProEvent 2026 · Stand "+DEAL.stand+" · alle Beträge netto");
  const tot = { ums:[0,0,0], kosten:0 };
  DEAL.projekte.forEach(p => { p.ums.forEach((v,i)=>tot.ums[i]+=v); tot.kosten+=p.kosten; });
  const sum = a => a.reduce((x,y)=>x+y,0);
  const rows = [[TH("Projekt"), THr("Nova Works"), THr("CGS"), THr("TCLG"), THr("Umsatz gesamt"), THr("Anteil"), THr("Kosten (NW)"), THr("Marge Deal"), THr("Marge NW-Sicht")]];
  DEAL.projekte.forEach(p => {
    const u = sum(p.ums), mNW = p.ums[0]-p.kosten;
    rows.push([TD(p.nr+" · "+p.name,{b:1}), TD(eur(p.ums[0]),{r:1,b:1}), TD(eur(p.ums[1]),{r:1}), TD(eur(p.ums[2]),{r:1}), TD(eur(u),{r:1,b:1}), TD(pct(u,sum(tot.ums)),{r:1,col:C.inkSoft}), TD(eur(p.kosten),{r:1}), TD(eur(u-p.kosten),{r:1,col:C.ok}), TD(eur(mNW),{r:1,b:1,col:mNW>=0?C.ok:C.danger})]);
  });
  const U = sum(tot.ums), mNW = tot.ums[0]-tot.kosten;
  rows.push([TD("Deal gesamt",{b:1,bt:1}), TD(eur(tot.ums[0]),{r:1,b:1,bt:1}), TD(eur(tot.ums[1]),{r:1,b:1,bt:1}), TD(eur(tot.ums[2]),{r:1,b:1,bt:1}), TD(eur(U),{r:1,b:1,bt:1}), TD("",{bt:1}), TD(eur(tot.kosten),{r:1,b:1,bt:1}), TD(eur(U-tot.kosten),{r:1,b:1,bt:1,col:C.ok}), TD(eur(mNW),{r:1,b:1,bt:1,col:C.ok})]);
  rows.push([TD("Umsatz-Anteil je Partei",{col:C.inkSoft,fs:9}), TD(pct(tot.ums[0],U),{r:1,col:C.inkSoft,fs:9}), TD(pct(tot.ums[1],U),{r:1,col:C.inkSoft,fs:9}), TD(pct(tot.ums[2],U),{r:1,col:C.inkSoft,fs:9}), TD(""), TD(""), TD(""), TD(""), TD("")]);
  s.addTable(rows, { x:0.6, y:1.95, w:W-1.2, colW:[2.25,1.35,1.2,1.2,1.5,0.8,1.35,1.4,1.08], rowH:0.38, fontFace:FONT });
  /* Diagramm: Umsatz je Partei und Projekt */
  s.addChart(pres.charts.BAR, DEAL.parteien.map((pt,i) => ({ name:pt, labels:DEAL.projekte.map(p=>p.name), values:DEAL.projekte.map(p=>p.ums[i]) })),
    Object.assign({ x:0.6, y:4.15, w:6.3, h:2.5, barDir:"col", barGrouping:"clustered", barGapWidthPct:60, chartColors:[C.ink, C.gold, C.greyLight],
      showLegend:true, legendPos:"b", showValue:true, dataLabelPosition:"outEnd", dataLabelColor:C.inkSoft, dataLabelFontSize:8, dataLabelFormatCode:"#,##0",
      showTitle:true, title:"UMSATZ JE PARTEI UND PROJEKT (€, NETTO)" }, chartBase));
  /* Kennzahlen rechts */
  kpi(s, 7.2, 4.15, 2.65, "Umsatz Nova Works", eur(tot.ums[0]), pct(tot.ums[0],U)+" des Deals");
  kpi(s, 10.08, 4.15, 2.65, "Marge NW-Sicht", eur(mNW), pct(mNW,tot.ums[0])+" vom NW-Umsatz", C.ok);
  card(s, 7.2, 5.65, 5.53, 1.0, C.goldBg);
  txt(s, "80er Live trägt die Marge: "+eur(DEAL.projekte[0].ums[0]-DEAL.projekte[0].kosten)+" aus Nova-Works-Sicht. Oberhausen liegt aus Nova-Works-Sicht bei "+eur(DEAL.projekte[1].ums[0]-DEAL.projekte[1].kosten)+" (Kosten über dem eigenen Umsatzanteil).",
    { x:7.4, y:5.72, w:5.15, h:0.86, fontSize:10.5, valign:"middle" });
  s.addNotes("TOP 3 – Deal-Auswertung aus der Nova Works App (Auswertung → Deal-Auswertung), Stand 07.08.2026. Nova-Works-Umsatz = bestätigte Projektsumme, Partnerumsätze CGS/TCLG manuell erfasst, Kosten (NW) aus der Kostenkontrolle.");
}

/* ===== 7 TOP 3b Rechnungen + Zukunft Kunde MK ===== */
{
  const t = TOPS[2]; const s = contentSlide(t.nr, "Rechnungsstand und Zukunft Kunde MK?", "Rechnungen an den Kunden über alle Parteien · Stand "+DEAL.stand);
  const R = DEAL.rechnungen;
  kpi(s, 0.6, 1.95, 3.3, "In Rechnung gestellt", eur(R.gestelltNetto), "netto · "+eur(R.gestelltBrutto)+" brutto");
  kpi(s, 0.6, 3.5, 3.3, "Bezahlt", eur(R.bezahltBrutto), R.bezahltAnz+" Rechnungen · brutto", C.ok);
  kpi(s, 0.6, 5.05, 3.3, "Offen", eur(R.offenBrutto), R.offenAnz+" Rechnungen · brutto · nur 80er Live", C.gold);
  s.addChart(pres.charts.DOUGHNUT, [{ name:"Rechnungen", labels:["Bezahlt","Offen"], values:[Math.round(R.bezahltBrutto), Math.round(R.offenBrutto)] }],
    Object.assign({ x:4.1, y:1.95, w:3.6, h:4.45, holeSize:60, chartColors:[C.ink, C.gold], showLegend:true, legendPos:"b", showPercent:true, showValue:false, dataLabelColor:"FFFFFF", dataLabelFontSize:10,
      showTitle:true, title:"ZAHLUNGSSTAND (BRUTTO)" }, chartBase));
  card(s, 8.0, 1.95, 4.73, 4.45);
  txt(s, "ZUKUNFT KUNDE MK?", { x:8.3, y:2.15, w:4.2, h:0.3, fontSize:9, color:C.gold, charSpacing:1.5, bold:true });
  txt(s, "Fragen zur Diskussion", { x:8.3, y:2.45, w:4.2, h:0.4, fontSize:15, bold:true });
  const q = ["Erfahrungen aus 80er Live und Oberhausen", "Konditionen und Zahlungsziele", "Rollenverteilung mit CGS und TCLG", "Umfang 2027: Tour, Einzelshows, Festivals", "Entscheidung: weiter, anpassen oder beenden?"];
  s.addText(q.map((p,i)=>({ text:p, options:{ bullet:{ code:"25A0" }, breakLine:i<q.length-1, paraSpaceAfter:8 } })),
    { x:8.3, y:3.0, w:4.2, h:3.2, fontFace:FONT, fontSize:12, color:C.ink, margin:0, isTextBox:true, valign:"top" });
  s.addNotes("TOP 3 – Rechnungsstand aus der Deal-Auswertung (Stand 07.08.2026). Diskussionspunkte zur Zukunft mit dem Kunden.");
}

/* ===== 8 TOP 4 Messeauftritt ===== */
{
  const t = TOPS[3]; const s = contentSlide(t.nr, t.titel, t.sub);
  const boxes = ["Messe und Termin", "Ziele und Zielgruppen", "Budget und Kostenplan", "Umsetzung und Verantwortliche"];
  boxes.forEach((b,i) => {
    const x = 0.6+(i%2)*6.2, y = 1.95+Math.floor(i/2)*2.35;
    card(s, x, y, 5.93, 2.1);
    circleNo(s, x+0.3, y+0.3, 0.55, i+1, 14);
    txt(s, b, { x:x+1.0, y:y+0.3, w:4.6, h:0.55, fontSize:14, bold:true, valign:"middle" });
    placeholder(s, x+0.3, y+1.0, 5.33, 0.85);
  });
  s.addNotes("TOP 4 – Messeauftritt. Inhalte folgen.");
}

/* ===== 9 TOP 5 Forecast ===== */
{
  const t = TOPS[4]; const s = contentSlide(t.nr, t.titel, FORECAST ? ("Forecast · "+FORECAST.zeitraum+" · alle Beträge netto") : "Kennzahlen aus dem Forecast der Nova Works App · alle Beträge netto");
  const F = FORECAST;
  const v = k => F ? eur(F[k]) : "–";
  const fc = F ? F.bestaetigt+F.offenGewichtet : 0;
  const tiles = [
    ["Bestätigt / fest", v("bestaetigt"), "Projektsumme bestätigter Projekte", C.ok],
    ["Offen (gewichtet)", v("offenGewichtet"), "Angebote „auf Anfrage“ × Wahrscheinlichkeit", C.gold],
    ["Forecast Umsatz", F ? eur(fc) : "–", "Bestätigt + Offen gewichtet"],
    ["Abgerechnet", v("abgerechnet"), "Ausgangsrechnungen"],
    ["Marge (Forecast)", v("marge"), F ? pct(F.marge,fc)+" vom Forecast-Umsatz" : "Umsatz − geplante Kosten", C.ok],
    ["nach Fixkosten", F ? eur(F.marge-F.fixkosten) : "–", F ? "Fixkosten "+eur(F.fixkosten) : "Marge − Fixkosten aus dem Overhead"],
  ];
  const tw = 1.92, tg = 0.15;
  tiles.forEach((k,i) => kpi(s, 0.6+i*(tw+tg), 1.95, tw, k[0], k[1], k[2], k[3]));
  if(F && F.monate && F.monate.length){
    s.addChart(pres.charts.BAR, [
        { name:"Bestätigt / fest", labels:F.monate.map(m=>m.label), values:F.monate.map(m=>Math.round(m.bestaetigt)) },
        { name:"Offen gewichtet",  labels:F.monate.map(m=>m.label), values:F.monate.map(m=>Math.round(m.offen)) },
        { name:"Abgerechnet",      labels:F.monate.map(m=>m.label), values:F.monate.map(m=>Math.round(m.abgerechnet)) }],
      Object.assign({ x:0.6, y:3.5, w:W-1.2, h:3.1, barDir:"col", barGrouping:"clustered", chartColors:[C.ink, C.gold, C.greyLight], showLegend:true, legendPos:"b",
        showTitle:true, title:"UMSATZ JE MONAT (€, NETTO)" }, chartBase));
  } else {
    placeholder(s, 0.6, 3.5, W-1.2, 3.1, "Umsatz je Monat (Bestätigt · Offen gewichtet · Abgerechnet)\nZahlen folgen aus dem Forecast der Nova Works App (Forecast → PowerPoint-Export)");
  }
  s.addNotes("TOP 5 – Forecast und Ausblick. Zahlen aus Nova Works App → Forecast; dort PowerPoint-Export nutzen oder Werte in FORECAST im Build-Skript eintragen.");
}

/* ===== 10 TOP 6 Sonstiges ===== */
{
  const t = TOPS[5]; const s = contentSlide(t.nr, t.titel, t.sub);
  card(s, 0.6, 1.95, 6.0, 4.6);
  txt(s, "VERSCHIEDENES", { x:0.9, y:2.15, w:5.4, h:0.3, fontSize:9, color:C.inkSoft, charSpacing:1.5 });
  placeholder(s, 0.9, 2.55, 5.4, 3.7);
  card(s, 6.9, 1.95, 5.83, 4.6);
  txt(s, "BESCHLÜSSE UND NÄCHSTE SCHRITTE", { x:7.2, y:2.15, w:5.2, h:0.3, fontSize:9, color:C.inkSoft, charSpacing:1.5 });
  const rows = [[TH("Thema"), TH("Beschluss / Aufgabe"), TH("Wer"), TH("Bis")]];
  for(let i=0;i<5;i++) rows.push([TD(""), TD(""), TD(""), TD("")]);
  s.addTable(rows, { x:7.2, y:2.55, w:5.23, colW:[1.5,2.13,0.8,0.8], rowH:0.5, fontFace:FONT });
  s.addNotes("TOP 6 – Sonstiges, Beschlüsse und nächste Schritte.");
}

/* ===== 11 Abschluss ===== */
{
  const s = pres.addSlide();
  s.background = { color:C.ink };
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x:3.4, y:2.1, w:6.55, h:1.7, fill:{ color:"FFFFFF" }, line:{ color:"FFFFFF" }, rectRadius:0.12 });
  s.addImage({ path:LOGO, x:3.9, y:2.4, w:5.55, h:1.394 });
  txt(s, "Vielen Dank", { x:0, y:4.35, w:W, h:0.7, fontSize:30, bold:true, color:"FFFFFF", align:"center" });
  txt(s, "NOVA WORKS GmbH  ·  Denkendorf, 23. September 2026", { x:0, y:5.1, w:W, h:0.4, fontSize:13, color:C.goldSoft, align:"center" });
}

pres.writeFile({ fileName:OUT }).then(f => console.log("written", f));
