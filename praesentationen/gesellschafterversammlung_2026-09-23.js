const pptxgen = require("pptxgenjs");
const fs = require("fs");

const LOGO = __dirname + "/../scripts/assets/nova-works-logo.png";
// Nova-Works-Design (aus angebote.html)
const C = { bg:"F7F5F2", panel:"FFFFFF", ink:"3D3D3D", inkSoft:"6A6A6A", gold:"A8884F", goldSoft:"C7AB78", goldBg:"F4EEE2", line:"E4E1DB", lineSoft:"EFECE7" };
const FONT = "Helvetica";

const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE"; // 13.33 x 7.5
pres.author = "NOVA WORKS GmbH";
pres.company = "NOVA WORKS GmbH";
pres.title = "Gesellschafterversammlung NOVA WORKS GmbH – 23.09.2026";
pres.lang = "de-DE";

const W = 13.333, H = 7.5;

function footer(slide, num) {
  slide.addText("NOVA WORKS GmbH  ·  Gesellschafterversammlung  ·  Denkendorf, 23.09.2026", {
    x:0.6, y:H-0.55, w:9, h:0.3, fontFace:FONT, fontSize:9, color:C.inkSoft, margin:0, isTextBox:true, valign:"middle"
  });
  slide.addText(String(num), { x:W-1.2, y:H-0.55, w:0.6, h:0.3, fontFace:FONT, fontSize:9, color:C.inkSoft, align:"right", margin:0, isTextBox:true, valign:"middle" });
  slide.addImage({ path:LOGO, x:W-0.6-1.8, y:0.42, w:1.8, h:0.452 });
}

/* ---------- 1  Titelfolie ---------- */
{
  const s = pres.addSlide();
  s.background = { color:C.bg };
  // rechte Panel-Fläche in Gold-Hintergrund als Motiv
  s.addShape(pres.shapes.RECTANGLE, { x:W*0.62, y:0, w:W*0.38, h:H, fill:{ color:C.goldBg }, line:{ color:C.goldBg } });
  s.addImage({ path:LOGO, x:1.0, y:1.2, w:4.6, h:1.156 });
  s.addText("Gesellschafterversammlung", { x:1.0, y:3.05, w:7.1, h:0.8, fontFace:FONT, fontSize:34, bold:true, color:C.ink, margin:0, isTextBox:true, valign:"top" });
  s.addText("NOVA WORKS GmbH", { x:1.0, y:3.95, w:7.0, h:0.55, fontFace:FONT, fontSize:22, color:C.gold, margin:0, isTextBox:true, charSpacing:2 });
  s.addText("Denkendorf, 23. September 2026", { x:1.0, y:5.55, w:7.0, h:0.45, fontFace:FONT, fontSize:16, color:C.inkSoft, margin:0, isTextBox:true });
  // Datum-Kachel rechts
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x:W*0.62+1.05, y:2.55, w:3.0, h:2.4, fill:{ color:C.panel }, line:{ color:C.line, width:0.75 }, rectRadius:0.12, shadow:{ type:"outer", color:"000000", opacity:0.08, blur:8, offset:2, angle:90 } });
  s.addText("23", { x:W*0.62+1.05, y:2.75, w:3.0, h:1.2, fontFace:FONT, fontSize:66, bold:true, color:C.gold, align:"center", margin:0, isTextBox:true, valign:"middle" });
  s.addText("September 2026", { x:W*0.62+1.05, y:3.95, w:3.0, h:0.4, fontFace:FONT, fontSize:14, color:C.ink, align:"center", margin:0, isTextBox:true });
  s.addText("Denkendorf", { x:W*0.62+1.05, y:4.35, w:3.0, h:0.4, fontFace:FONT, fontSize:12, color:C.inkSoft, align:"center", margin:0, isTextBox:true });
}

/* ---------- 2  Tagesordnung ---------- */
const TOPS = [
  { nr:"1", titel:"TOP 1", sub:"Inhalt folgt" },
  { nr:"2", titel:"TOP 2", sub:"Inhalt folgt" },
  { nr:"3", titel:"TOP 3", sub:"Inhalt folgt" },
  { nr:"4", titel:"TOP 4", sub:"Inhalt folgt" },
];
{
  const s = pres.addSlide();
  s.background = { color:C.bg };
  footer(s, 2);
  s.addText("Tagesordnung", { x:0.6, y:0.5, w:8, h:0.8, fontFace:FONT, fontSize:36, bold:true, color:C.ink, margin:0, isTextBox:true, valign:"middle" });
  s.addText("Tagesordnungspunkte der Gesellschafterversammlung", { x:0.6, y:1.3, w:9, h:0.4, fontFace:FONT, fontSize:14, color:C.inkSoft, margin:0, isTextBox:true });
  // 2x2 Karten
  const cw = 5.85, ch = 1.9, gx = 0.6, gy = 2.15, gap = 0.4;
  TOPS.forEach((t, i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const x = gx + col*(cw+gap), y = gy + row*(ch+gap);
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w:cw, h:ch, fill:{ color:C.panel }, line:{ color:C.line, width:0.75 }, rectRadius:0.12, shadow:{ type:"outer", color:"000000", opacity:0.06, blur:6, offset:2, angle:90 } });
    s.addShape(pres.shapes.OVAL, { x:x+0.35, y:y+0.5, w:0.9, h:0.9, fill:{ color:C.goldBg }, line:{ color:C.goldBg } });
    s.addText(t.nr, { x:x+0.35, y:y+0.5, w:0.9, h:0.9, fontFace:FONT, fontSize:26, bold:true, color:C.gold, align:"center", valign:"middle", margin:0, isTextBox:true });
    s.addText(t.titel, { x:x+1.55, y:y+0.5, w:cw-1.9, h:0.5, fontFace:FONT, fontSize:22, bold:true, color:C.ink, margin:0, isTextBox:true, valign:"middle" });
    s.addText(t.sub, { x:x+1.55, y:y+1.0, w:cw-1.9, h:0.4, fontFace:FONT, fontSize:14, italic:true, color:C.inkSoft, margin:0, isTextBox:true, valign:"middle" });
  });
}

/* ---------- 3–6  je ein TOP ---------- */
TOPS.forEach((t, i) => {
  const s = pres.addSlide();
  s.background = { color:C.bg };
  footer(s, 3+i);
  // Gold-Kreis mit Nummer + Titel
  s.addShape(pres.shapes.OVAL, { x:0.6, y:0.55, w:0.75, h:0.75, fill:{ color:C.goldBg }, line:{ color:C.goldBg } });
  s.addText(t.nr, { x:0.6, y:0.55, w:0.75, h:0.75, fontFace:FONT, fontSize:22, bold:true, color:C.gold, align:"center", valign:"middle", margin:0, isTextBox:true });
  s.addText(t.titel, { x:1.55, y:0.5, w:8, h:0.85, fontFace:FONT, fontSize:36, bold:true, color:C.ink, margin:0, isTextBox:true, valign:"middle" });
  // Inhaltspanel
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x:0.6, y:1.75, w:W-1.2, h:4.75, fill:{ color:C.panel }, line:{ color:C.line, width:0.75 }, rectRadius:0.12, shadow:{ type:"outer", color:"000000", opacity:0.06, blur:6, offset:2, angle:90 } });
  s.addText("Inhalt folgt", { x:0.6, y:1.75, w:W-1.2, h:4.75, fontFace:FONT, fontSize:20, italic:true, color:C.goldSoft, align:"center", valign:"middle", margin:0, isTextBox:true });
  s.addNotes(`${t.titel} – Inhalt folgt.`);
});

/* ---------- 7  Abschluss ---------- */
{
  const s = pres.addSlide();
  s.background = { color:C.ink };
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x:3.4, y:2.1, w:6.55, h:1.7, fill:{ color:"FFFFFF" }, line:{ color:"FFFFFF" }, rectRadius:0.12 });
  s.addImage({ path:LOGO, x:3.9, y:2.4, w:5.55, h:1.394 });
  s.addText("Vielen Dank", { x:0, y:4.35, w:W, h:0.7, fontFace:FONT, fontSize:30, bold:true, color:"FFFFFF", align:"center", margin:0, isTextBox:true });
  s.addText("NOVA WORKS GmbH  ·  Denkendorf, 23. September 2026", { x:0, y:5.1, w:W, h:0.4, fontFace:FONT, fontSize:13, color:C.goldSoft, align:"center", margin:0, isTextBox:true });
}

pres.writeFile({ fileName:__dirname + "/Gesellschafterversammlung_2026-09-23.pptx" }).then(f => console.log("written", f));
