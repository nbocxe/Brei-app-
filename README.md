# Knittinerd

Een app die je breipatroon uitleest en er een lijst van maakt waarin je elke
afgewerkte toer afvinkt. Geen toerenteller of vinger op papier meer nodig.

Je kiest een patroon-PDF, de app leest de instructies uit en schrijft de
herhalingen uit tot losse toeren. Je kijkt de lijst na, past aan wat niet klopt,
en begint met breien.

## Hoe het werkt

- **Inlezen** — de PDF wordt op je eigen apparaat gelezen en nergens naartoe
  gestuurd. Bestaat de PDF uit afbeeldingen, dan kun je de tekst zelf plakken.
- **Uitschrijven** — `Herhaal toer 1 en 2 nog 4 keer` wordt acht losse toeren,
  met doorlopende toernummers, goede en verkeerde kant, en een doorgeteld
  stekenaantal. Nederlands en Engels worden allebei herkend.
- **Nakijken** — wat de app niet zeker weet wordt gemarkeerd in plaats van
  weggelaten. Je past elke stap aan voordat je het project opslaat.
- **Breien** — de huidige toer staat groot in beeld, één brede knop vinkt hem
  af, en het scherm blijft aan. Je voortgang wordt bij elke klik bewaard.
- **Bewaren** — projecten staan alleen op je eigen apparaat. Met export en
  import maak je een back-up of zet je ze over naar een ander apparaat.

## Ontwikkelen

```sh
npm install
npm run dev       # draaien op http://localhost:5173
npm test          # parsertests
npm run build     # typecontrole en bouwen
```

De parser zit in `src/lib/parser/` en is opgedeeld per stap: tekst opschonen
(`normalize`), breitermen herkennen (`lexicon`), opdelen in blokken (`segment`),
één toer ontleden (`parseBlock`), herhalingen lezen (`repeats`) en alles
uitschrijven (`buildRows`). De tests in `parser.test.ts` zijn de plek om een
patroon aan toe te voegen dat niet goed wordt gelezen.

De app wordt automatisch gepubliceerd naar GitHub Pages bij elke push.
