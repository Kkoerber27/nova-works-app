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

  /* ---------- Farbschema beim Scrollen ----------------------------------
     Die Seite beginnt dunkel und wechselt im Kontaktbereich auf Gelb.
     Welcher Abschnitt gerade gilt, entscheidet ein schmales Band auf
     halber Fensterhoehe - wieder ohne Scroll-Listener. Die Farben selbst
     stehen im Stylesheet unter body[data-schema].

     Die Fusszeile traegt bewusst keine eigene Angabe: Am Seitenende
     erreicht das Band sie nie, die Seite endet deshalb im Gelb des
     Kontaktbereichs.                                                     */

  var schemaAbschnitte = document.querySelectorAll('[data-schema]');

  if (schemaAbschnitte.length && 'IntersectionObserver' in window) {
    var themeMeta  = document.querySelector('meta[name="theme-color"]');
    var seitenfarbe = { dunkel: '#0b0b0c', signal: '#ebeb0d' };

    var setzeSchema = function (name) {
      if (!name || document.body.getAttribute('data-schema') === name) return;
      document.body.setAttribute('data-schema', name);
      // Auch die Browserleiste auf dem Handy faerbt sich mit.
      if (themeMeta) themeMeta.setAttribute('content', seitenfarbe[name] || seitenfarbe.dunkel);
    };

    setzeSchema(schemaAbschnitte[0].getAttribute('data-schema'));

    var schemaObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) setzeSchema(entry.target.getAttribute('data-schema'));
      });
    }, { rootMargin: '-50% 0px -50% 0px', threshold: 0 });

    Array.prototype.forEach.call(schemaAbschnitte, function (el) {
      schemaObserver.observe(el);
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
