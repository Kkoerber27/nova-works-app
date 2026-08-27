/* =========================================================================
   NOVA WORKS - Interaktion
   Kein Framework, keine Abhängigkeiten. Alles über IntersectionObserver,
   kein Scroll-Listener. Bewegung respektiert prefers-reduced-motion.
   ========================================================================= */

(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Hero-Einstieg ---------------------------------------------
     Ordnet den Blick: Claim zuerst, dann Fließtext, dann CTA.            */

  var hero = document.querySelector('.hero');
  if (hero) {
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        hero.classList.add('is-ready');
      });
    });
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

  /* Der Lichtstrahl ueber dem Claim laeuft im Dauerlauf. Ausserhalb des
     Bildes soll er ruhen - das Stylesheet haelt ihn ueber .hero--weg an. */
  if (hero && 'IntersectionObserver' in window) {
    new IntersectionObserver(function (eintraege) {
      hero.classList.toggle('hero--weg', !eintraege[0].isIntersecting);
    }, { threshold: 0 }).observe(hero);
  }

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

     Die Zahlen stehen doppelt - hier und in @keyframes bild-tiefe. Wer
     eine aendert, muss die andere mitziehen, sonst bewegen sich dieselben
     Bilder je nach Browser verschieden weit. */

  var kannSichtAnimation = window.CSS && CSS.supports &&
                           CSS.supports('animation-timeline', 'view()') &&
                           CSS.supports('timeline-scope', '--pruefung');

  var TIEFE_SCALE = [1.22, 1.32];    /* von / bis                         */
  var TIEFE_WEG   = [7.5, -7.5];     /* Prozent der eigenen Hoehe         */

  if (!reduceMotion && !kannSichtAnimation && 'IntersectionObserver' in window) {
    var gruppen = [];

    Array.prototype.forEach.call(document.querySelectorAll('.ref__foto'), function (el) {
      gruppen.push({ bezug: el.parentNode, elemente: [el], sichtbar: false });
    });

    var dienste = document.getElementById('services');
    var karten = document.querySelectorAll('.card__media');
    if (dienste && karten.length) {
      gruppen.push({ bezug: dienste, sichtbar: false,
                     elemente: Array.prototype.slice.call(karten) });
    }

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
          var gross = (TIEFE_SCALE[0] + anteil * (TIEFE_SCALE[1] - TIEFE_SCALE[0])).toFixed(4);
          var weg = '0 ' + (TIEFE_WEG[0] + anteil * (TIEFE_WEG[1] - TIEFE_WEG[0])).toFixed(3) + '%';
          for (var k = 0; k < g.elemente.length; k++) {
            g.elemente[k].style.scale = gross;
            g.elemente[k].style.translate = weg;
          }
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

  /* ---------- Kontaktformular -------------------------------------------- */

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
