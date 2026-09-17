# UNIFY LEARN — MATHEMATICS RENDERING RULE

## Rule: Always Use MathJax for Mathematical Equations

All Unify Learn HTML files that contain mathematical equations, formulas, derivations, or expressions **must use MathJax** for rendering.

---

## How to Include MathJax

Add this single script tag inside the `<head>` of every HTML file that contains maths:

```html
<script src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js"></script>
```

---

## How to Write Equations

Use standard LaTeX syntax wrapped in delimiters:

**Display equations (centred, on their own line):**
```
\[ your equation here \]
```

**Inline equations (within a sentence):**
```
\( your equation here \)
```

---

## Examples

| What you want | What you write |
|---|---|
| H₀ formula | `\[ H_0 = \frac{24}{\pi} I_{sc} \left[1 + 0.033\cos\!\left(\frac{360n}{365}\right)\right] \]` |
| Air density | `\[ \rho = \frac{P}{RT} \]` |
| Efficiency fraction | `\[ \eta_c = \frac{q_u}{H_b R_b} \]` |
| Inline symbol | `The solar constant \( I_{sc} = 1353 \text{ W/m}^2 \)` |
| Subscript | `\( T_{2'} \)` for primed actual temperatures |
| Superscript | `\( V^3 \)` for velocity cubed |
| Fraction | `\( \frac{a}{b} \)` |
| Square root | `\( \sqrt{9} = 3 \)` |
| Greek letters | `\( \delta, \phi, \omega_s, \eta, \rho, \gamma, \tau, \alpha, \epsilon \)` |
| Exponent | `\( e^{-x} \)` |

---

## Why This Rule Exists

Previous Unify Learn files (W1–W7) used monospace font for equations. This breaks down for:
- Nested fractions
- Greek symbols
- Subscripts and superscripts
- Multi-line derivations

MathJax renders proper mathematical notation — clean, consistently sized, readable on mobile — matching the quality of a printed textbook. W8–W11 were built with MathJax and the improvement is significant.

---

## Where to Put Equations in the HTML Structure

Inside `.formula-box` blocks:

```html
<div class="formula-box">
  <div class="f-label">Formula Name</div>
  <div class="f-eq">\[ your equation \]</div>
  <div class="f-note">Explanation of variables...</div>
</div>
```

Inside `.we-math` blocks (worked examples):

```html
<div class="we-math">\[ substituted equation here \]</div>
```

---

## Do NOT Do This

```html
<!-- Wrong — monospace, no rendering -->
<code>H0 = (24/pi) * Isc * [1 + 0.033*cos(360n/365)] * (...)</code>

<!-- Wrong — plain text -->
<p>H₀ = 24/π × Isc × ...</p>
```

---

## Platform Note

MathJax loads from a CDN. The file requires an internet connection to render equations. All Unify Learn HTML files are designed for browser use — this is not a limitation.

