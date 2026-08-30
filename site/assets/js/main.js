/* =========================================================================
   NOVA WORKS - Interaktion
   Kein Framework, keine Abhängigkeiten. Alles über IntersectionObserver,
   kein Scroll-Listener. Bewegung respektiert prefers-reduced-motion.
   ========================================================================= */

(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Hero-Einstieg ---------------------------------------------
     Der Claim faehrt zeilenweise herein, danach Fliesstext und Schaltflaeche.

     Dafuer muessen die beiden Halbsaetze in ihre tatsaechlichen Zeilen
     zerlegt werden - von Hand geht das nicht, weil der Umbruch von der
     Breite abhaengt: am Schirm zwei Zeilen, am Handy vier.

     Der Weg dahin: jedes Wort einzeln setzen, die Oberkanten vergleichen,
     nach Zeilen gruppieren, neu aufbauen. Ueber die Oberkante und nicht
     ueber eine Breitenrechnung, weil der Browser den Umbruch ohnehin schon
     gemacht hat - man muss ihn nur ablesen.

     Woerter im gelben Halbsatz behalten ihr <em>: Ein <em> je Wort sieht
     genauso aus wie eines um mehrere, die Auszeichnung ist hier reine
     Farbe. Das erspart es, ein Element mitten im Wort aufzutrennen. */

  var hero = document.querySelector('.hero');

  var zeilenSchneiden = function (halb) {
    var woerter = [];
    Array.prototype.forEach.call(halb.childNodes, function (kn) {
      var istEm = kn.nodeType === 1 && kn.tagName === 'EM';
      (kn.textContent || '').split(/\s+/).forEach(function (w) {
        if (w) woerter.push({ text: w, em: istEm });
      });
    });
    if (!woerter.length) return 0;

    var setzen = function (ziel, liste, einzeln) {
      ziel.textContent = '';
      var marken = [];
      liste.forEach(function (w, i) {
        if (i) ziel.appendChild(document.createTextNode(' '));
        var s = document.createElement(w.em ? 'em' : 'span');
        s.textContent = w.text;
        ziel.appendChild(s);
        marken.push(s);
      });
      return einzeln ? marken : null;
    };

    /* Erst provisorisch, nur um die Umbrueche abzulesen. */
    var marken = setzen(halb, woerter, true);
    var zeilen = [], letzteOberkante = null;
    marken.forEach(function (s, i) {
      var oben = Math.round(s.getBoundingClientRect().top);
      /* Vier Pixel Toleranz: Buchstaben mit und ohne Oberlaenge sitzen
         nicht auf die Nachkommastelle gleich. */
      if (letzteOberkante === null || Math.abs(oben - letzteOberkante) > 4) {
        zeilen.push([]);
        letzteOberkante = oben;
      }
      zeilen[zeilen.length - 1].push(woerter[i]);
    });

    /* Und jetzt endgueltig: je Zeile ein Kasten mit fahrendem Innenleben.

       Zwischen den Kaesten steht ein echtes Leerzeichen. Es ist unsichtbar
       - zwischen zwei Bloecken erzeugt es keine Zeile -, aber ohne es
       klebte der Text zusammen: "Momente,die bleiben,weil allespasst."
       Genau so laese ihn ein Vorleseprogramm, und genau so landete er in
       der Zwischenablage. */
    halb.textContent = '';
    zeilen.forEach(function (zeile, i) {
      if (i) halb.appendChild(document.createTextNode(' '));
      var aussen = document.createElement('span');
      aussen.className = 'hero__zeile';
      var innen = document.createElement('span');
      innen.className = 'hero__zeile-innen';
      setzen(innen, zeile, false);
      aussen.appendChild(innen);
      halb.appendChild(aussen);
    });
    return zeilen.length;
  };

  if (hero) {
    /* Sofort und synchron: Ab hier fuehrt dieses Skript den Auftritt, und
       das Stylesheet darf die Zeilen und den Kopfbereich verstecken. Die
       Klasse muss von hier kommen und nicht aus einem Schnipsel im Kopf
       der Seite - sonst gibt es zwei Bedingungen, die auseinanderlaufen
       koennen, und in der Vorschau tat sie das auch: Dort fehlte die
       fremde Klasse, die Zeilen standen von Anfang an, es passierte
       sichtbar nichts. */
    hero.classList.add('hero--auftritt');

    var claim = hero.querySelector('.hero__title');
    var halbsaetze = claim ? claim.querySelectorAll(':scope > span') : [];

    var neuSchneiden = function () {
      var nr = 0;
      Array.prototype.forEach.call(halbsaetze, function (halb) {
        zeilenSchneiden(halb);
        Array.prototype.forEach.call(halb.querySelectorAll('.hero__zeile-innen'), function (innen) {
          innen.style.setProperty('--z', nr++);
        });
      });
      return nr;
    };

    /* Geschnitten wird erst, wenn die Schrift steht. Vorher misst man die
       Ersatzschrift, und die bricht an anderer Stelle um - gemessen kam
       dabei jedes Wort auf eine eigene Zeile heraus.

       Die Notbremse nach 1,2 Sekunden ist fuer den Fall, dass die
       Schriftdatei haengt: Dann faehrt der Claim lieber mit den Umbruechen
       der Ersatzschrift herein, als gar nicht zu erscheinen. Kommt die
       Schrift danach doch noch, wird still nachgeschnitten. */

    var ohneFahrt = function (tun) {
      hero.classList.add('hero--ohne-fahrt');
      tun();
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          hero.classList.remove('hero--ohne-fahrt');
        });
      });
    };

    var starten = function () {
      neuSchneiden();
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          hero.classList.add('is-ready');
        });
      });
    };

    if (!halbsaetze.length) {
      hero.classList.add('is-ready');
    } else if (document.fonts && document.fonts.ready) {
      var gestartet = false;
      var einmal = function () {
        if (gestartet) return;
        gestartet = true;
        starten();
      };
      document.fonts.ready.then(function () {
        if (gestartet) ohneFahrt(neuSchneiden); else einmal();
      });
      window.setTimeout(einmal, 1200);
    } else {
      starten();
    }

    /* Dreht jemand das Geraet, stimmen die Umbrueche nicht mehr. Dann neu
       schneiden - aber ohne die Fahrt noch einmal zu spielen: Der Auftritt
       gehoert zum Ankommen auf der Seite, nicht zum Drehen des Telefons.
       Nur eine echte Breitenaenderung zaehlt; auf dem Handy wandert beim
       Scrollen die Adressleiste, und die aendert allein die Hoehe. */
    if (halbsaetze.length) {
      var letzteBreite = window.innerWidth;
      var uhr = null;
      window.addEventListener('resize', function () {
        if (window.innerWidth === letzteBreite) return;
        letzteBreite = window.innerWidth;
        window.clearTimeout(uhr);
        uhr = window.setTimeout(function () { ohneFahrt(neuSchneiden); }, 180);
      });
    }
  }

  /* ---------- Bildtiefe im Hero -----------------------------------------
     Das Hintergrundbild faehrt beim Scrollen langsam heran und tritt
     zurueck. Kann der Browser scrollgebundene CSS-Animationen, macht das
     Stylesheet die Arbeit - ausserhalb des Hauptstrangs und ohne uns.
     Sonst uebernehmen wir hier dieselbe Bewegung.

     Auch das kommt ohne Scroll-Listener aus: Ein IntersectionObserver
     schaltet eine rAF-Schleife an und wieder aus, sobald der Hero das Bild
     verlaesst. Ausserhalb des Heros rechnet also nichts.                  */

  var kannScrollAnimation = window.CSS && CSS.supports &&
                            CSS.supports('animation-timeline', 'scroll()');

  var heroBild = document.querySelector('.hero__media');

  if (heroBild && hero && !reduceMotion && !kannScrollAnimation &&
      'IntersectionObserver' in window) {
    var laeuftHero = false;

    var zeichne = function () {
      var hoehe = window.innerHeight || 1;
      var fortschritt = Math.min(1, Math.max(0, (window.pageYOffset || 0) / hoehe));
      heroBild.style.transform = 'scale(' + (1.04 + fortschritt * 0.09).toFixed(4) + ') ' +
                                 'translateY(' + (fortschritt * -2.5).toFixed(3) + '%)';
      heroBild.style.opacity = (0.5 - fortschritt * 0.18).toFixed(3);
      if (laeuftHero) window.requestAnimationFrame(zeichne);
    };

    new IntersectionObserver(function (eintraege) {
      var sichtbar = eintraege[0].isIntersecting;
      if (sichtbar === laeuftHero) return;
      laeuftHero = sichtbar;
      if (sichtbar) window.requestAnimationFrame(zeichne);
    }, { threshold: 0 }).observe(hero);
  }

  /* ---------- Scroll-Reveal ---------------------------------------------
     Erzählt die Seite in der Reihenfolge, in der sie gelesen wird.       */

  var revealTargets = document.querySelectorAll('[data-reveal]');

  if (reduceMotion || !('IntersectionObserver' in window)) {
    Array.prototype.forEach.call(revealTargets, function (el) {
      el.classList.add('is-visible');
    });
  } else {
    var revealObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        revealObserver.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.12 });

    Array.prototype.forEach.call(revealTargets, function (el) {
      revealObserver.observe(el);
    });

    // Sicherheitsnetz: sollte der Observer aus irgendeinem Grund nicht
    // ausloesen, ist die Seite nach 3 Sekunden trotzdem vollstaendig lesbar.
    window.setTimeout(function () {
      Array.prototype.forEach.call(revealTargets, function (el) {
        el.classList.add('is-visible');
      });
    }, 3000);
  }

  /* ---------- Header-Zustand --------------------------------------------
     Sentinel statt Scroll-Listener: der Header bekommt seinen Hintergrund
     erst, wenn er nicht mehr über dem Hero-Bild steht.                   */

  var masthead = document.getElementById('masthead');
  if (masthead && 'IntersectionObserver' in window) {
    var sentinel = document.createElement('div');
    sentinel.setAttribute('aria-hidden', 'true');
    sentinel.style.cssText = 'position:absolute;top:0;left:0;width:1px;height:80px;pointer-events:none';
    document.body.prepend(sentinel);

    new IntersectionObserver(function (entries) {
      masthead.classList.toggle('is-stuck', !entries[0].isIntersecting);
    }, { threshold: 0 }).observe(sentinel);
  }

  /* ---------- Laufband der Leistungsfelder -------------------------------
     Ersetzt Flickity von der alten Seite. Die Karten wandern langsam durchs
     Bild und lassen sich mit Maus, Finger oder Trackpad schieben. Grundlage
     ist ein ganz normaler seitwaerts scrollbarer Kasten - dadurch
     funktionieren Wischen, Trackpad und Pfeiltasten von selbst, und ohne
     JavaScript bleibt die Reihe trotzdem bedienbar.

     Eine Eigenheit des Browsers macht Arbeit: scrollLeft wird auf ganze
     Pixel gerundet. Ein Schritt von 0,45 px pro Bild verschwindet dadurch
     spurlos, das Band stuende still. Die massgebliche Position liegt
     deshalb als Fliesskommazahl hier im Skript, und scrollLeft wird jedes
     Mal absolut gesetzt.                                                  */

  Array.prototype.forEach.call(document.querySelectorAll('[data-slider]'), function (kasten) {
    var spur = kasten.querySelector('.slider__spur');
    if (!spur) return;

    var TEMPO = 28;                                    // Pixel je Sekunde
    var richtung = kasten.getAttribute('data-richtung') === 'links' ? 1 : -1;
    var original = Array.prototype.slice.call(spur.children);
    if (!original.length) return;

    var satzBreite = 0, pos = 0, pausen = 0, letzte = 0;

    /* Fuer die Endlosschleife braucht es drei Saetze: einen sichtbaren und
       je einen als Reserve links und rechts. Die Kopien sind fuer
       Screenreader unsichtbar. */
    for (var runde = 0; runde < 2; runde++) {
      original.forEach(function (el) {
        var kopie = el.cloneNode(true);
        kopie.setAttribute('aria-hidden', 'true');
        Array.prototype.forEach.call(kopie.querySelectorAll('a, button, input'), function (f) {
          f.setAttribute('tabindex', '-1');
        });
        spur.appendChild(kopie);
      });
    }

    var messen = function () {
      var stil = window.getComputedStyle(spur);
      var abstand = parseFloat(stil.columnGap || stil.gap) || 0;
      satzBreite = original.reduce(function (summe, el) {
        return summe + el.getBoundingClientRect().width + abstand;
      }, 0);
    };

    /* Setzt die Position und faltet sie in den mittleren Satz zurueck.
       Gibt zurueck, um wie viel gefaltet wurde. */
    var setzen = function (wert) {
      var vorher = wert;
      if (satzBreite > 0) {
        while (wert < satzBreite) wert += satzBreite;
        while (wert >= satzBreite * 2) wert -= satzBreite;
      }
      pos = wert;
      kasten.scrollLeft = pos;
      return pos - vorher;
    };

    messen();
    setzen(satzBreite);

    var neuMessen = function () {
      var anteil = satzBreite ? (pos - satzBreite) / satzBreite : 0;
      messen();
      setzen(satzBreite + anteil * satzBreite);
    };
    if ('ResizeObserver' in window) new ResizeObserver(neuMessen).observe(kasten);
    else window.addEventListener('resize', neuMessen);

    var anhalten = function () { pausen++; };
    var weiter   = function () { pausen = Math.max(0, pausen - 1); letzte = 0; };

    /* Hat etwas anderes gescrollt - Trackpad, Wischen, Pfeiltasten -,
       uebernehmen wir dessen Position. Die eigene Rundung von unter einem
       Pixel zaehlt dabei nicht als fremde Bewegung. */
    kasten.addEventListener('scroll', function () {
      if (Math.abs(kasten.scrollLeft - pos) > 2) setzen(kasten.scrollLeft);
    }, { passive: true });

    /* --- Automatischer Lauf --- */
    if (!reduceMotion) {
      var schritt = function (zeit) {
        var dt = letzte ? Math.min(zeit - letzte, 50) : 0;
        letzte = zeit;
        if (pausen === 0 && satzBreite > 0) setzen(pos + richtung * TEMPO * dt / 1000);
        window.requestAnimationFrame(schritt);
      };
      window.requestAnimationFrame(schritt);

      kasten.addEventListener('mouseenter', anhalten);
      kasten.addEventListener('mouseleave', weiter);
      kasten.addEventListener('focusin', anhalten);
      kasten.addEventListener('focusout', weiter);

      // Steht das Laufband nicht im Bild, muss es auch nicht rechnen.
      if ('IntersectionObserver' in window) {
        var sichtbar = true;
        new IntersectionObserver(function (eintraege) {
          var jetzt = eintraege[0].isIntersecting;
          if (jetzt === sichtbar) return;
          sichtbar = jetzt;
          if (jetzt) weiter(); else anhalten();
        }, { threshold: 0 }).observe(kasten);
      }

      // Beim Scrollen per Trackpad kurz aussetzen, sonst zieht es dagegen.
      var radUhr = null;
      kasten.addEventListener('wheel', function () {
        if (!radUhr) anhalten();
        window.clearTimeout(radUhr);
        radUhr = window.setTimeout(function () { radUhr = null; weiter(); }, 700);
      }, { passive: true });
    }

    /* --- Schieben mit der Maus --- */
    var startX = 0, startScroll = 0, greift = false;

    kasten.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'touch') return;            // Wischen kann der Browser selbst
      greift = true;
      startX = e.clientX;
      startScroll = pos;
      kasten.setAttribute('data-greift', '');
      anhalten();
      kasten.setPointerCapture(e.pointerId);
    });

    kasten.addEventListener('pointermove', function (e) {
      if (!greift) return;
      e.preventDefault();
      var ziel = startScroll - (e.clientX - startX);
      // Wurde beim Falten ein Satz uebersprungen, wandert der Bezugspunkt mit.
      startScroll += setzen(ziel);
    });

    var loslassen = function (e) {
      if (!greift) return;
      greift = false;
      kasten.removeAttribute('data-greift');
      weiter();
      if (e && e.pointerId != null && kasten.hasPointerCapture(e.pointerId)) {
        kasten.releasePointerCapture(e.pointerId);
      }
    };
    kasten.addEventListener('pointerup', loslassen);
    kasten.addEventListener('pointercancel', loslassen);
  });

  /* ---------- Bildtiefe in den Abschnitten -------------------------------
     Dieselbe Bewegung wie im Kopfbild, jetzt fuer die Referenzfotos und
     die Karten: heranfahren und dabei ein Stueck nach oben wandern,
     solange sie im Bild sind.

     Auch hier macht das Stylesheet die Arbeit, wo der Browser
     scrollgebundene Animationen kennt. Diese Schleife springt nur ein,
     wo er es nicht tut.

     Dieser Block steht mit Absicht HINTER dem Laufband: Erst dort
     entstehen die Kopien der Karten. Stuende er davor, kennte er nur die
     vier Originale - und ausgerechnet die stehen im Laufband dauerhaft
     ausserhalb des Bildes, weil es in der mittleren Kopie laeuft.

     Massgeblich ist nicht das Bild selbst, sondern sein Bezug: beim
     Referenzfoto der Rahmen, bei den Karten der ganze Abschnitt. Genau so
     rechnet auch das Stylesheet, und bei den Karten ist es der einzige
     Weg - jede einzelne haette im waagerecht laufenden Band ihren eigenen,
     staendig wechselnden Stand.

     An derselben Schleife haengt der Farbtausch der Ueberschriften. Der
     Rechenweg ist fuer beides derselbe - wie weit ist dieser Kasten durchs
     Bild gewandert - nur was am Ende damit geschieht, unterscheidet sich.
     Deshalb bringt jede Gruppe ihre eigene Setzfunktion mit, statt dass
     die Schleife Fallunterscheidungen trifft.

     Die Zahlen stehen doppelt - hier und in @keyframes bild-tiefe
     beziehungsweise titel-tausch. Wer eine aendert, muss die andere
     mitziehen, sonst bewegt sich dasselbe je nach Browser verschieden
     weit. */

  var kannSichtAnimation = window.CSS && CSS.supports &&
                           CSS.supports('animation-timeline', 'view()') &&
                           CSS.supports('timeline-scope', '--pruefung');

  var TIEFE_SCALE = [1.22, 1.32];    /* von / bis                         */
  var TIEFE_WEG   = [7.5, -7.5];     /* Prozent der eigenen Hoehe         */

  if (!reduceMotion && !kannSichtAnimation && 'IntersectionObserver' in window) {
    var gruppen = [];

    /* Bilder: heranfahren und ein Stueck nach oben wandern. */
    var bildSetzer = function (elemente) {
      return function (anteil) {
        var gross = (TIEFE_SCALE[0] + anteil * (TIEFE_SCALE[1] - TIEFE_SCALE[0])).toFixed(4);
        var weg = '0 ' + (TIEFE_WEG[0] + anteil * (TIEFE_WEG[1] - TIEFE_WEG[0])).toFixed(3) + '%';
        for (var i = 0; i < elemente.length; i++) {
          elemente[i].style.scale = gross;
          elemente[i].style.translate = weg;
        }
      };
    };

    Array.prototype.forEach.call(document.querySelectorAll('.ref__foto'), function (el) {
      gruppen.push({ bezug: el.parentNode, sichtbar: false, setze: bildSetzer([el]) });
    });

    var dienste = document.getElementById('services');
    var karten = document.querySelectorAll('.card__media');
    if (dienste && karten.length) {
      gruppen.push({ bezug: dienste, sichtbar: false,
                     setze: bildSetzer(Array.prototype.slice.call(karten)) });
    }

    /* Ueberschriften: 0 ist der Entwurfszustand, 1 der getauschte. Die
       Punkte sind Zeile fuer Zeile dieselben wie in @keyframes
       titel-tausch - erst gibt die eine Haelfte das Gelb ab, dann nimmt
       es die andere auf. Gemischt wird im Stylesheet; hier fallen nur die
       beiden Zahlen. */
    var TAUSCH_EINS = [[0, 1], [.22, 1], [.32, 0], [.42, 0], [.68, 0], [.78, 0], [.88, 1], [1, 1]];
    var TAUSCH_ZWEI = [[0, 1], [.22, 1], [.32, 1], [.42, 0], [.68, 0], [.78, 1], [.88, 1], [1, 1]];

    /* Zwischen zwei Punkten linear - genau das, was linear in der
       CSS-Animation auch tut. */
    var aufKurve = function (punkte, anteil) {
      for (var i = 1; i < punkte.length; i++) {
        if (anteil > punkte[i][0]) continue;
        var a = punkte[i - 1], b = punkte[i];
        var spanne = b[0] - a[0];
        if (spanne <= 0) return b[1];
        return a[1] + (b[1] - a[1]) * (anteil - a[0]) / spanne;
      }
      return punkte[punkte.length - 1][1];
    };

    Array.prototype.forEach.call(document.querySelectorAll('.section__title'), function (el) {
      gruppen.push({ bezug: el, sichtbar: false, setze: function (anteil) {
        el.style.setProperty('--tausch-eins', aufKurve(TAUSCH_EINS, anteil).toFixed(4));
        el.style.setProperty('--tausch-zwei', aufKurve(TAUSCH_ZWEI, anteil).toFixed(4));
      } });
    });

    if (gruppen.length) {
      var offen = 0;
      var laeuftTiefe = false;

      var zeichneTiefe = function () {
        var hoehe = window.innerHeight || 1;
        for (var i = 0; i < gruppen.length; i++) {
          var g = gruppen[i];
          if (!g.sichtbar) continue;
          var r = g.bezug.getBoundingClientRect();
          /* Genau der Bereich von animation-range: cover 0% cover 100% -
             vom Hereinkommen unten bis zum Verschwinden oben. */
          var anteil = (hoehe - r.top) / (hoehe + r.height);
          anteil = anteil < 0 ? 0 : anteil > 1 ? 1 : anteil;
          g.setze(anteil);
        }
        if (laeuftTiefe) window.requestAnimationFrame(zeichneTiefe);
      };

      var tiefeBeobachter = new IntersectionObserver(function (eintraege) {
        for (var i = 0; i < eintraege.length; i++) {
          for (var k = 0; k < gruppen.length; k++) {
            if (gruppen[k].bezug !== eintraege[i].target) continue;
            /* sichtbar startet auf false, nicht undefined: Der erste
               Durchlauf meldet auch alles, was NICHT im Bild ist. Ohne den
               gesetzten Ausgangswert zaehlte er diese Meldungen als
               Abgaenge, der Zaehler geriete ins Minus und die Schleife
               spraenge nie an. */
            if (gruppen[k].sichtbar === eintraege[i].isIntersecting) break;
            gruppen[k].sichtbar = eintraege[i].isIntersecting;
            offen += gruppen[k].sichtbar ? 1 : -1;
            break;
          }
        }
        /* Ist nichts im Bild, rechnet auch nichts. */
        if (offen > 0 && !laeuftTiefe) {
          laeuftTiefe = true;
          window.requestAnimationFrame(zeichneTiefe);
        } else if (offen <= 0) {
          laeuftTiefe = false;
        }
      }, { threshold: 0 });

      for (var g2 = 0; g2 < gruppen.length; g2++) tiefeBeobachter.observe(gruppen[g2].bezug);
    }
  }


  /* ---------- Grossansicht der Projektbilder -----------------------------
     Ein Klick auf ein Referenzbild oeffnet die Galerie des Projekts.

     Woher die Bilder kommen: aus der Liste <ul class="ref__bilder"> unter
     dem Rahmen. Sie steht im Quelltext und ist ohne JavaScript eine ganz
     normale Liste von Verweisen auf die Bilddateien - erst hier wird sie
     ausgeblendet und das Bild darueber zum Schalter. Der Linktext ist die
     Bildbeschreibung und wird als alt-Text uebernommen.

     Hoechstens drei Bilder je Projekt. Steht ein viertes in der Liste,
     bleibt es weg statt die Ansicht zu ueberladen.

     Das <dialog> uebernimmt Escape, die Fokusfalle und die Rueckkehr des
     Fokus. Selbst gebaut werden muss nur, was es nicht kennt: blaettern,
     der Klick neben das Bild und das Wischen mit dem Finger.            */

  var lupe = document.querySelector('[data-lupe]');

  if (lupe && typeof lupe.showModal === 'function') {
    var lupeBild     = lupe.querySelector('[data-lupe-bild]');
    var lupeTitel    = lupe.querySelector('[data-lupe-titel]');
    var lupeNachweis = lupe.querySelector('[data-lupe-nachweis]');
    var lupeZaehler  = lupe.querySelector('[data-lupe-zaehler]');
    var lupeRahmen  = lupe.querySelector('.lupe__rahmen');
    var blaetternKnoepfe = lupe.querySelectorAll('[data-lupe-schritt]');

    var HOECHSTENS = 3;
    var bilder = [], stelle = 0, titel = '';

    var zeigen = function (i) {
      if (!bilder.length) return;
      stelle = (i + bilder.length) % bilder.length;
      lupeBild.src = bilder[stelle].src;
      lupeBild.alt = bilder[stelle].alt;
      lupeTitel.textContent = titel;
      /* Der Bildnachweis haengt am einzelnen Bild, nicht am Projekt. Hat
         eines keinen, verschwindet die Zeile - sonst klaffte dort eine
         Luecke mit Trennzeichen und nichts dazwischen. */
      var nachweis = bilder[stelle].nachweis;
      lupeNachweis.textContent = nachweis || '';
      lupeNachweis.hidden = !nachweis;
      lupeZaehler.textContent = bilder.length > 1
        ? (stelle + 1) + ' / ' + bilder.length : '';
      /* Ein einzelnes Bild braucht keine Pfeile. */
      Array.prototype.forEach.call(blaetternKnoepfe, function (k) {
        k.hidden = bilder.length < 2;
      });
    };

    var oeffnen = function (medien, ab) {
      var liste = medien.querySelector('.ref__bilder');
      if (!liste) return;
      bilder = Array.prototype.slice
        .call(liste.querySelectorAll('li'), 0, HOECHSTENS)
        .map(function (eintrag) {
          var a = eintrag.querySelector('a');
          var n = eintrag.querySelector('.ref__nachweis');
          return a ? { src: a.getAttribute('href'), alt: a.textContent.trim(),
                       nachweis: n ? n.textContent.trim() : '' } : null;
        })
        .filter(Boolean);
      if (!bilder.length) return;
      titel = liste.getAttribute('data-lupe-titel') || '';
      zeigen(ab || 0);
      lupe.showModal();
    };

    Array.prototype.forEach.call(document.querySelectorAll('.ref__media'), function (medien) {
      var liste = medien.querySelector('.ref__bilder');
      var schalter = medien.querySelector('[data-lupe-auf]');
      if (!liste || !schalter) return;
      /* Erst hier ausblenden: Ohne JavaScript bleibt die Liste stehen. */
      liste.hidden = true;
      schalter.addEventListener('click', function () { oeffnen(medien, 0); });
    });

    Array.prototype.forEach.call(blaetternKnoepfe, function (knopf) {
      knopf.addEventListener('click', function () {
        zeigen(stelle + parseInt(knopf.getAttribute('data-lupe-schritt'), 10));
      });
    });

    lupe.querySelector('[data-lupe-zu]').addEventListener('click', function () {
      lupe.close();
    });

    /* Klick daneben schliesst. Der Dialog selbst fuellt die ganze Flaeche,
       Treffer ausserhalb von .lupe__rahmen sind also der Hintergrund. */
    lupe.addEventListener('click', function (e) {
      if (!lupeRahmen.contains(e.target)) lupe.close();
    });

    lupe.addEventListener('keydown', function (e) {
      if (bilder.length < 2) return;
      if (e.key === 'ArrowRight') { e.preventDefault(); zeigen(stelle + 1); }
      if (e.key === 'ArrowLeft')  { e.preventDefault(); zeigen(stelle - 1); }
    });

    /* Wischen. Nur waagerecht und erst ab einem klaren Weg - sonst
       blaettert schon ein zittriger Tipp weiter. */
    var startX = 0, startY = 0, wischt = false;
    lupe.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'mouse') return;
      startX = e.clientX; startY = e.clientY; wischt = true;
    });
    lupe.addEventListener('pointerup', function (e) {
      if (!wischt) return;
      wischt = false;
      var dx = e.clientX - startX, dy = e.clientY - startY;
      if (bilder.length > 1 && Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
        zeigen(stelle + (dx < 0 ? 1 : -1));
      }
    });

    /* Beim Schliessen die Quelle loeschen, sonst haelt der Browser das
       zuletzt gezeigte Bild im Speicher und blitzt es beim naechsten
       Oeffnen kurz auf, bevor das richtige da ist. */
    lupe.addEventListener('close', function () {
      lupeBild.removeAttribute('src');
      lupeBild.alt = '';
    });
  }

  /* ---------- Mobile-Navigation ------------------------------------------ */

  var toggle = document.querySelector('.nav-toggle');
  var drawer = document.getElementById('nav-drawer');

  if (toggle && drawer) {
    var openDrawer = function () {
      drawer.hidden = false;
      // Reflow erzwingen, damit der Übergang von opacity:0 aus startet
      void drawer.offsetWidth;
      drawer.classList.add('is-open');
      toggle.setAttribute('aria-expanded', 'true');
      toggle.querySelector('.visually-hidden').textContent = 'Menü schließen';
      document.body.style.overflow = 'hidden';
    };

    var closeDrawer = function () {
      drawer.classList.remove('is-open');
      toggle.setAttribute('aria-expanded', 'false');
      toggle.querySelector('.visually-hidden').textContent = 'Menü öffnen';
      document.body.style.overflow = '';
      window.setTimeout(function () {
        if (!drawer.classList.contains('is-open')) drawer.hidden = true;
      }, reduceMotion ? 0 : 400);
    };

    toggle.addEventListener('click', function () {
      if (toggle.getAttribute('aria-expanded') === 'true') closeDrawer();
      else openDrawer();
    });

    drawer.addEventListener('click', function (event) {
      if (event.target.closest('a')) closeDrawer();
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
        closeDrawer();
        toggle.focus();
      }
    });
  }

  /* ---------- Einwilligung ------------------------------------------------
     Der Balken beim ersten Aufruf und die Einstellungen dahinter.

     Wichtig zum Verstaendnis: Diese Seite setzt heute keine Cookies, laedt
     nichts von fremden Servern und misst nichts. Es gibt also im Moment
     nichts, wofuer eine Einwilligung noetig waere. Der Balken fragt
     trotzdem - und die Einstellungen sagen bei jeder Gruppe offen, ob
     darin ueberhaupt etwas steckt.

     Damit die Frage nicht zur leeren Geste wird, haengt hier eine echte
     Weiche: Wer spaeter etwas einbaut, das Einwilligung braucht, traegt es
     in GRUPPEN ein, erhoeht STAND und fragt vor dem Laden

         window.novaEinwilligung.erlaubt('statistik')

     ab oder wartet auf das Ereignis 'nova:einwilligung' am Dokument. Das
     Erhoehen von STAND macht alte Entscheidungen ungueltig - sonst wuerde
     ein neuer Dienst unter einer Zustimmung mitlaufen, die ihn nie meinte.

     Gespeichert wird die Entscheidung im localStorage, nicht in einem
     Cookie: Sie bleibt damit im Browser und geht bei keinem Seitenaufruf
     mit ans Netz. Das Speichern der Entscheidung selbst braucht keine
     Einwilligung - ohne sie liesse sich die Frage nicht beantworten.

     Ohne JavaScript entsteht nichts davon. Das ist kein Mangel: Dann wird
     auch nichts gespeichert und nichts nachgeladen.                     */

  /* Der Verweis auf die Datenschutzerklaerung kommt aus der Fusszeile der
     Seite selbst. Die Startseite verlinkt relativ, die 404-Seite absolut -
     und die kann unter jedem Pfad ausgeliefert werden. Selbst geraten
     waere einer der beiden Faelle immer falsch. */
  var DATENSCHUTZ_URL = (function () {
    var v = document.querySelector('.footer__meta a[href$="datenschutz.html"]');
    return v ? v.getAttribute('href') : 'datenschutz.html';
  })();

  var EINWILLIGUNG_SCHLUESSEL = 'nova-einwilligung';
  var EINWILLIGUNG_STAND = 1;

  var GRUPPEN = [
    {
      schluessel: 'notwendig',
      pflicht: true,
      name: 'Notwendig',
      was: 'Ihre Entscheidung auf dieser Seite und der Spam-Schutz des ' +
           'Kontaktformulars. Ohne das funktioniert die Seite nicht.'
    },
    {
      schluessel: 'statistik',
      name: 'Statistik',
      was: 'Auswertung, wie die Seite genutzt wird.',
      leer: true
    },
    {
      schluessel: 'medien',
      name: 'Externe Medien',
      was: 'Inhalte von fremden Servern, etwa Karten oder Videos.',
      leer: true
    }
  ];

  (function () {
    /* Der Speicher kann verweigern - privates Fenster, gesperrte Seitendaten.
       Dann laeuft alles weiter, die Frage kommt nur beim naechsten Aufruf
       erneut. Ein Absturz waere die schlechtere Antwort. */
    var lesen = function () {
      try {
        var roh = window.localStorage.getItem(EINWILLIGUNG_SCHLUESSEL);
        if (!roh) return null;
        var wert = JSON.parse(roh);
        if (!wert || wert.stand !== EINWILLIGUNG_STAND) return null;
        return wert;
      } catch (e) { return null; }
    };

    var schreiben = function (wahl) {
      var wert = { stand: EINWILLIGUNG_STAND, zeit: new Date().toISOString(), wahl: wahl };
      try {
        window.localStorage.setItem(EINWILLIGUNG_SCHLUESSEL, JSON.stringify(wert));
      } catch (e) { /* nicht speicherbar - dann eben nur fuer diesen Besuch */ }
      stand = wert;
      document.dispatchEvent(new CustomEvent('nova:einwilligung', { detail: wahl }));
    };

    var stand = lesen();

    var alle = function (wert) {
      var w = {};
      GRUPPEN.forEach(function (g) { w[g.schluessel] = g.pflicht ? true : wert; });
      return w;
    };

    /* --- Der Balken --- */

    var balken = null;

    var balkenBauen = function () {
      balken = document.createElement('div');
      balken.className = 'zustimmung';
      balken.setAttribute('role', 'dialog');
      balken.setAttribute('aria-modal', 'false');
      balken.setAttribute('aria-labelledby', 'zustimmung-titel');
      balken.innerHTML =
        '<h2 class="zustimmung__titel" id="zustimmung-titel">Ihre Entscheidung</h2>' +
        '<p class="zustimmung__text">Diese Seite kommt ohne Cookies, ohne Analyse ' +
        'und ohne Inhalte von fremden Servern aus. Es gibt zurzeit also nichts zu ' +
        'messen und nichts nachzuladen. Sie können das hier trotzdem festlegen – ' +
        'nachzulesen in der <a href="' + DATENSCHUTZ_URL + '">Datenschutz&shy;erklärung</a>.</p>' +
        '<div class="zustimmung__wahl">' +
          /* Beide gleich: nicht nur gleich gross, sondern auch gleich
             gestaltet. Ein gelb gefuelltes "Zustimmen" neben einem
             blassen "Ablehnen" lenkt die Wahl, und genau das soll es
             hier nicht. Die Faerbung uebernimmt erst der Hover - fuer
             beide gleich. */
          '<button class="btn" type="button" data-zustimmung="alle">Zustimmen</button>' +
          '<button class="btn" type="button" data-zustimmung="keine">Ablehnen</button>' +
        '</div>' +
        '<button class="zustimmung__mehr" type="button" data-zustimmung="einstellungen">' +
        'Einstellungen ansehen</button>';

      /* Ganz vorn im Dokument, damit Tastatur und Vorleseprogramm die Frage
         gleich erreichen - angezeigt wird sie trotzdem unten. Die
         Sprungmarke bleibt das allererste Element. */
      var sprung = document.querySelector('.skip-link');
      if (sprung && sprung.nextSibling) document.body.insertBefore(balken, sprung.nextSibling);
      else document.body.insertBefore(balken, document.body.firstChild);

      platzMachen();
      window.addEventListener('resize', platzMachen);

      balken.addEventListener('click', function (e) {
        var knopf = e.target.closest('[data-zustimmung]');
        if (!knopf) return;
        var was = knopf.getAttribute('data-zustimmung');
        if (was === 'einstellungen') { einstellungenOeffnen(); return; }
        schreiben(alle(was === 'alle'));
        balkenWeg();
      });
    };

    /* Der Balken liegt ueber der Seite. Damit er die Fusszeile nicht
       verdeckt - Impressum und Datenschutzerklaerung stehen dort -,
       waechst sie um seine Hoehe, solange die Frage offen ist. */
    var platzMachen = function () {
      if (!balken) return;
      document.documentElement.classList.add('hat-zustimmung');
      document.documentElement.style.setProperty(
        '--zustimmung-hoehe', Math.ceil(balken.getBoundingClientRect().height) + 'px');
    };

    var balkenWeg = function () {
      if (!balken) return;
      balken.remove();
      balken = null;
      window.removeEventListener('resize', platzMachen);
      document.documentElement.classList.remove('hat-zustimmung');
      document.documentElement.style.removeProperty('--zustimmung-hoehe');
    };

    /* --- Die Einstellungen --- */

    var schirm = null;

    var einstellungenBauen = function () {
      schirm = document.createElement('dialog');
      schirm.className = 'einstellungen';
      schirm.setAttribute('aria-labelledby', 'einstellungen-titel');

      var zeilen = GRUPPEN.map(function (g) {
        var an = g.pflicht || (stand && stand.wahl && stand.wahl[g.schluessel]);
        return '<li class="gruppe">' +
          '<div>' +
            '<p class="gruppe__name">' + g.name + '</p>' +
            '<p class="gruppe__was">' + g.was +
              (g.leer ? '<span class="gruppe__leer">Zurzeit nicht im Einsatz</span>' : '') +
            '</p>' +
          '</div>' +
          '<span class="schalter">' +
            '<input class="schalter__feld" type="checkbox" data-gruppe="' + g.schluessel + '"' +
              (an ? ' checked' : '') + (g.pflicht ? ' disabled' : '') +
              ' aria-label="' + g.name + (g.pflicht ? ' – immer aktiv' : '') + '">' +
            '<span class="schalter__spur" aria-hidden="true"></span>' +
          '</span>' +
        '</li>';
      }).join('');

      schirm.innerHTML =
        '<div class="einstellungen__inhalt">' +
          '<h2 class="einstellungen__titel" id="einstellungen-titel">Datenschutz-Einstellungen</h2>' +
          '<p class="einstellungen__text">Hier steht, was diese Seite in Ihrem ' +
          'Browser ablegen oder von außen holen darf. Was zurzeit nichts enthält, ' +
          'ist als solches gekennzeichnet. Ausführlich in der ' +
          '<a href="' + DATENSCHUTZ_URL + '">Datenschutzerklärung</a>.</p>' +
          '<ul class="einstellungen__liste">' + zeilen + '</ul>' +
          '<div class="einstellungen__wahl">' +
            '<button class="btn btn--solid" type="button" data-einstellung="speichern">Auswahl speichern</button>' +
            '<button class="btn" type="button" data-einstellung="alle">Allem zustimmen</button>' +
            '<button class="btn" type="button" data-einstellung="keine">Alles ablehnen</button>' +
          '</div>' +
        '</div>';

      document.body.appendChild(schirm);

      schirm.addEventListener('click', function (e) {
        var knopf = e.target.closest('[data-einstellung]');
        if (!knopf) return;
        var was = knopf.getAttribute('data-einstellung');
        var wahl;
        if (was === 'speichern') {
          wahl = {};
          GRUPPEN.forEach(function (g) {
            var feld = schirm.querySelector('[data-gruppe="' + g.schluessel + '"]');
            wahl[g.schluessel] = g.pflicht ? true : !!(feld && feld.checked);
          });
        } else {
          wahl = alle(was === 'alle');
        }
        schreiben(wahl);
        schirm.close();
        balkenWeg();
      });

      /* Beim Schliessen ohne Entscheidung - Escape, Klick daneben - bleibt
         die Frage offen und der Balken kommt zurueck. Ein Wegklicken ist
         keine Zustimmung. */
      schirm.addEventListener('close', function () {
        schirm.remove();
        schirm = null;
        if (!lesen() && !balken) balkenBauen();
      });

      schirm.addEventListener('mousedown', function (e) {
        if (e.target === schirm) schirm.close();
      });
    };

    var einstellungenOeffnen = function () {
      if (schirm) return;
      einstellungenBauen();
      if (typeof schirm.showModal === 'function') schirm.showModal();
      else schirm.setAttribute('open', '');
    };

    /* --- Der Weg zurueck aus der Fusszeile --- */

    var meta = document.querySelector('.footer__meta');
    if (meta) {
      var zurueck = document.createElement('button');
      zurueck.className = 'footer__knopf';
      zurueck.type = 'button';
      zurueck.textContent = 'Datenschutz-Einstellungen';
      zurueck.addEventListener('click', einstellungenOeffnen);
      meta.appendChild(zurueck);
    }

    /* --- Die Auskunft fuer alles, was spaeter dazukommt --- */

    window.novaEinwilligung = {
      erlaubt: function (schluessel) {
        var s = lesen();
        return !!(s && s.wahl && s.wahl[schluessel]);
      },
      stand: function () { return lesen(); },
      oeffnen: einstellungenOeffnen,
      zuruecksetzen: function () {
        try { window.localStorage.removeItem(EINWILLIGUNG_SCHLUESSEL); } catch (e) {}
        stand = null;
        if (!balken) balkenBauen();
      }
    };

    if (!stand) balkenBauen();
  })();

  /* ---------- Kontaktformular -------------------------------------------- */

  /* Achtung: Dieses return beendet nicht nur diesen Abschnitt, sondern das
     ganze Skript. Auf Impressum, AGB, Datenschutz und 404 gibt es kein
     Formular - alles, was hier darunter stuende, liefe dort nie. Neue
     Bloecke gehoeren deshalb oberhalb dieser Zeile. */
  var form = document.getElementById('kontaktformular');
  if (!form) return;

  var status = document.getElementById('form-status');
  var submitBtn = form.querySelector('button[type="submit"]');
  var submitLabel = submitBtn ? submitBtn.querySelector('.btn__label') : null;
  var defaultLabel = submitLabel ? submitLabel.textContent : 'Absenden';

  var rules = [
    { name: 'vorname',     error: 'err-vorname',     message: 'Bitte tragen Sie Ihren Vornamen ein.' },
    { name: 'nachname',    error: 'err-nachname',    message: 'Bitte tragen Sie Ihren Nachnamen ein.' },
    { name: 'email',       error: 'err-email',       message: 'Bitte tragen Sie eine gültige E-Mail Adresse ein.' },
    { name: 'nachricht',   error: 'err-nachricht',   message: 'Bitte schreiben Sie uns kurz, worum es geht.' },
    { name: 'datenschutz', error: 'err-datenschutz', message: 'Ohne Ihre Einwilligung dürfen wir die Anfrage nicht verarbeiten.' }
  ];

  var isValid = function (field) {
    if (!field) return true;
    if (field.type === 'checkbox') return field.checked;
    if (field.type === 'email') return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(field.value.trim());
    return field.value.trim().length > 0;
  };

  var setFieldState = function (rule) {
    var field = form.elements[rule.name];
    var slot = document.getElementById(rule.error);
    var ok = isValid(field);

    if (slot) slot.textContent = ok ? '' : rule.message;
    if (field && field.type !== 'checkbox') field.setAttribute('aria-invalid', ok ? 'false' : 'true');
    return ok;
  };

  // Fehler erst korrigieren, wenn der Nutzer das Feld verlassen hat
  rules.forEach(function (rule) {
    var field = form.elements[rule.name];
    if (!field) return;
    field.addEventListener('blur', function () { setFieldState(rule); });
    field.addEventListener('input', function () {
      var slot = document.getElementById(rule.error);
      if (slot && slot.textContent) setFieldState(rule);
    });
  });

  var showStatus = function (html, ok) {
    if (!status) return;
    status.innerHTML = html;
    status.classList.toggle('form__status--ok', !!ok);
    status.hidden = false;
  };

  form.addEventListener('submit', function (event) {
    event.preventDefault();

    var firstBad = null;
    rules.forEach(function (rule) {
      var ok = setFieldState(rule);
      if (!ok && !firstBad) firstBad = form.elements[rule.name];
    });

    if (firstBad) {
      showStatus('Bitte prüfen Sie die markierten Felder.', false);
      firstBad.focus();
      return;
    }

    if (status) status.hidden = true;
    if (submitBtn) submitBtn.setAttribute('data-loading', 'true');
    if (submitLabel) submitLabel.textContent = 'Wird gesendet';

    fetch(form.action, {
      method: 'POST',
      body: new FormData(form),
      headers: { 'Accept': 'application/json' }
    })
      .then(function (response) {
        return response.json().then(function (data) {
          return { ok: response.ok && data.ok, data: data };
        });
      })
      .then(function (result) {
        if (!result.ok) throw new Error(result.data && result.data.error);
        form.reset();
        showStatus(
          '<strong>Danke, die Anfrage ist raus.</strong><br>Wir melden uns in der Regel innerhalb eines Werktages.',
          true
        );
      })
      .catch(function () {
        showStatus(
          'Das Senden hat nicht geklappt. Schreiben Sie uns bitte direkt an ' +
          '<a href="mailto:info@nova-works.de">info@nova-works.de</a> oder rufen Sie an: ' +
          '<a href="tel:+4972439383100">+49 7243 93 83 100</a>.',
          false
        );
      })
      .finally(function () {
        if (submitBtn) submitBtn.removeAttribute('data-loading');
        if (submitLabel) submitLabel.textContent = defaultLabel;
      });
  });

})();
