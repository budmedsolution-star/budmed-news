# BudMed News — Medical News Portal (MVP)

**AI-здравоохранение простым языком** / **AI Healthcare Made Simple**

---

## About

BudMed News is a bilingual (RU/EN) popular science medical portal for the [BudMed & MedCore™](https://github.com/) ecosystem. It covers AI in healthcare, pharmacology, clinical guidelines, and the BudMed platform — explained in simple, accessible language.

## Features

- **Bilingual:** Russian & English with one-click language toggle
- **14 articles** across 4 sections (AI & Health, Pharmacology, Clinical Guidelines, Ecosystem)
- **Freemium model:** 3 premium articles with blur-lock and subscription CTA
- **Design System:** Clinical Hybrid (BudMed) — Sage Green, Geist typography, glassmorphism
- **Mobile-first responsive** (320px → 1280px)
- **Accessibility:** WCAG 2.1 AA (aria-labels, semantic HTML, keyboard navigation)
- **SEO:** Open Graph, Twitter Card, Schema.org structured data
- **Zero dependencies:** Pure HTML5 + CSS3 + Vanilla JS

## Sections

| Section | Articles | Model |
|---------|:--------:|-------|
| AI & Здоровье | 5 | Free |
| Здоровье & Фармакология | 4 | Free |
| Клинические гайдлайны | 3 | 1 free + 2 premium |
| Об экосистеме BudMed | 2 | 1 free + 1 premium |

## Deployment

### GitHub Pages

1. Create a repository named `budmed-news`
2. Push this folder's contents to the `main` branch
3. Go to **Settings → Pages → Source → Deploy from branch → `main`**
4. Your site will be live at `https://<username>.github.io/budmed-news/`

### Local Development

Simply open `index.html` in any modern browser. No build step required.

## File Structure

```
budmed-news/
├── index.html          ← Main page (all sections, 14 articles)
├── css/
│   └── styles.css      ← Clinical Hybrid design system
├── js/
│   └── main.js         ← Language toggle, sticky header, hamburger, scroll
├── assets/             ← (future) Images and static assets
└── README.md
```

## Design System

Based on **BudMed Clinical Hybrid**:

- **Primary:** #006d3e (Green)
- **Primary Container:** #86efac (Sage Green)
- **Secondary:** #006a61 (Deep Teal)
- **Typography:** Geist
- **Radius:** Pill-shaped buttons, rounded-xl cards
- **Effects:** Glassmorphism header, smooth transitions

## Medical Disclaimer

This website is for informational purposes only and does not constitute medical advice, diagnosis, or treatment. Always consult a qualified healthcare professional.

## License

© 2026 BudMed & MedCore™. All rights reserved.
