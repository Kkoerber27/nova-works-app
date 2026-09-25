<?php
/* =========================================================================
   NOVA WORKS - Impressum
   Kopf und Fuß kommen aus vorlage/. Bearbeitet wird im Backend nur, was
   zwischen <main id="main"> und </main> steht - admin/rechtsseiten.php
   sucht genau nach diesen beiden Marken.

   Am Wortlaut wurde nichts geändert. Die Pflichtangaben standen vorher
   als Folge von Absätzen mit fettem Anfang; jetzt stehen sie als
   Definitionsliste - links die Bezeichnung, rechts die Angabe. Dieselbe
   Form wie die Gewerke und die Kontaktdaten auf der Startseite. Gelesen
   wird dasselbe, nur schneller gefunden.
   ========================================================================= */

$seitenTitel = 'Impressum · Nova Works';
$seitenText  = 'Angaben zum Anbieter dieser Website.';
$nurLesen    = true;
require __DIR__ . '/vorlage/kopf.php';
?>
<main id="main">
  <section class="legal">
    <div class="shell">
      <article class="legal__inner">

        <header class="legal__kopf">
          <h1>Impressum</h1>
          <p class="legal__unter">Angaben zum Anbieter dieser Website</p>
        </header>

        <p class="legal__vorspann">Verantwortlich für den Inhalt der Seiten:</p>

        <p class="legal__anbieter">
          <strong>NovaWorks GmbH</strong><br>
          Am Buschbach 59<br>
          76275 Ettlingen<br>
          Deutschland
        </p>

        <dl class="angaben">
          <div class="angaben__zeile">
            <dt>Vertreten durch</dt>
            <dd>Kilian Körber</dd>
          </div>
          <div class="angaben__zeile">
            <dt>Kontakt</dt>
            <dd>
              Telefon: <a href="tel:+4972439383100">+49 7243 93 83 100</a><br>
              E-Mail: <a href="mailto:info@nova-works.de">info@nova-works.de</a><br>
              Web: <a href="https://www.nova-works.de">www.nova-works.de</a>
            </dd>
          </div>
          <div class="angaben__zeile">
            <dt>Registereintrag</dt>
            <dd>
              Eintragung im Registergericht: Mannheim<br>
              Registernummer: HRB 756990
            </dd>
          </div>
          <div class="angaben__zeile">
            <dt>Umsatzsteuer-ID</dt>
            <dd>Umsatzsteuer-Identifikationsnummer gemäß § 27a Umsatzsteuergesetz: DE459760673</dd>
          </div>
        </dl>

        <h2>Disclaimer – Haftungsausschluss:</h2>
        <p>Für die Nutzung unserer Internet-Seiten gelten seitens der NovaWorks GmbH die folgenden Bedingungen:</p>

        <h3>Urheberrecht und Linkhaftung</h3>
        <p>Wir schließen jegliche Haftung – insbesondere für eventuelle Schäden oder Konsequenzen, die durch die Nutzung der auf diesem Server dargestellten Inhalte entstehen – aus. Es wird keine Haftung für die Vollständigkeit oder Richtigkeit der dargestellten Daten übernommen. Es kann auch keine Haftung dafür übernommen werden, dass diese Daten frei von Rechten Dritter sind.</p>
        <p>Wir haben keinen Einfluss auf die Inhalte externer Webseiten. Aus dieser Website hinausführende Hyperlinks wurden nach Ansicht der verlinkten Seiten erstellt. Allerdings unterliegen Webseiten häufigen Veränderungen. Sollte deshalb ein externer Link nicht funktionieren oder nicht zum angegebenen Ziel führen, teilen Sie uns das bitte mit – wir korrigieren etwaige Fehler gerne. Sollten Sie Grund zur Beanstandung über Inhalte auf einer verlinkten Seite haben, setzen sie sich bitte mit dem Betreiber dieser Seite in Verbindung.</p>
        <p>Der gesamte Inhalt dieses Servers unterliegt dem Urheberrecht, insbesondere alle Grafiken, Fotos, Buttons und sonstigen Gestaltungselemente. Eine auch nur teilweise Veröffentlichung der Inhalte unserer Website ist nur mit unserer ausdrücklichen Zustimmung erlaubt.</p>

        <h3>Geltungsbereich</h3>
        <p>Dieser Haftungsausschluss gilt, sofern anwendbar, für alle Rechtsordnungen. Bei Teilnichtigkeit bleibt die Restgültigkeit dieses Dokumentes gegeben. Vereinbarungen und Formulierungen auf unseren eigenen Seiten sind gegenüber diesen hier speziell.</p>

      </article>
    </div>
  </section>
</main>
<?php require __DIR__ . '/vorlage/fuss.php';
