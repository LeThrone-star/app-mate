# Astral · Matematica e Fisica interattive

Sito statico (HTML, CSS e JavaScript, senza build) che unisce matematica e fisica:

| Pagina | Contenuto |
| --- | --- |
| `index.html` | Home con accesso rapido a tutti gli strumenti |
| `grafici.html` | Calcolatrice grafica: funzioni `y = …`, funzioni con nome `f(x) = …` e derivate `f'(x)`, curve implicite (`x^2 + y^2 = 9`), disequazioni con area colorata, punti `(a, b)`, slider animabili, punti trascinabili, zeri/massimi/minimi/intersezioni, link condivisibili |
| `calcolatrice.html` | Calcolatrice scientifica con cronologia, variabili, `Ans`, gradi/radianti e frazioni |
| `matematica.html` | Laboratorio: circonferenza goniometrica, derivata e tangente, integrali (somme di Riemann), equazione di 2° grado passo per passo |
| `fisica.html` | Laboratorio: leve (tre generi), piano inclinato con attrito, moto parabolico, pendolo, sistema massa-molla |
| `teoria.html` | Teoria di matematica e fisica con formule, esempi, quiz e collegamenti ai laboratori |

## Avvio in locale

```bash
python3 -m http.server 8000
# poi apri http://localhost:8000
```

Si può pubblicare così com'è su GitHub Pages (Settings → Pages → branch e cartella `/`).

## Struttura

- `assets/style.css` — stile condiviso, tema chiaro/scuro
- `assets/common.js` — header, tema, slider, tab, helper per canvas
- `assets/parser.js` — parser di espressioni (moltiplicazione implicita, funzioni, derivate numeriche, LaTeX)
- `assets/plot.js` — piano cartesiano con griglia, pan e zoom
- `assets/grapher.js`, `assets/calc.js`, `assets/mathlab.js`, `assets/physics.js` — logica delle singole pagine

Le formule sono impaginate con [KaTeX](https://katex.org) caricato da CDN; senza connessione il sito funziona comunque e mostra le formule come testo.
