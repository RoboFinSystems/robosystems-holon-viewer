# RoboSystems branding assets

Branding for `robosystems-holon-viewer`, copied from the RoboSystems app
(`../robosystems-app`). This file is a reference for the human to wire into
CSS later — it documents the copied font/logo files and the color palette as
CSS custom properties ready to paste into a `globals.css`.

Source of truth for the palette: `../robosystems-app/tailwind.config.ts`.
Source of truth for the gradient: `../robosystems-app/src/lib/core/auth-core/config.ts`.

---

## Fonts

Font files live under `public/fonts/`, preserving the app's subdirectory
structure. Paths below are relative to `public/` (i.e. how they resolve at
runtime as `/fonts/...`).

### Space Grotesk — body / sans (`font-family: 'Space Grotesk'`)

Used for `body`, `sans` in the design system. Static weights:

| Weight             | File                                                     |
| ------------------ | -------------------------------------------------------- |
| 300 (Light)        | `/fonts/SpaceGrotesk/SpaceGrotesk-Light.ttf`             |
| 400 (Regular)      | `/fonts/SpaceGrotesk/SpaceGrotesk-Regular.ttf`           |
| 500 (Medium)       | `/fonts/SpaceGrotesk/SpaceGrotesk-Medium.ttf`            |
| 600 (SemiBold)     | `/fonts/SpaceGrotesk/SpaceGrotesk-SemiBold.ttf`          |
| 700 (Bold)         | `/fonts/SpaceGrotesk/SpaceGrotesk-Bold.ttf`              |
| variable (300–700) | `/fonts/SpaceGrotesk/SpaceGrotesk-VariableFont_wght.ttf` |

License: `/fonts/SpaceGrotesk/OFL.txt`

### Orbitron — heading (`font-family: 'Orbitron'`)

Used for `heading` (headings fall back to Space Grotesk). Static weights:

| Weight             | File                                             |
| ------------------ | ------------------------------------------------ |
| 400 (Regular)      | `/fonts/Orbitron/Orbitron-Regular.ttf`           |
| 500 (Medium)       | `/fonts/Orbitron/Orbitron-Medium.ttf`            |
| 600 (SemiBold)     | `/fonts/Orbitron/Orbitron-SemiBold.ttf`          |
| 700 (Bold)         | `/fonts/Orbitron/Orbitron-Bold.ttf`              |
| 800 (ExtraBold)    | `/fonts/Orbitron/Orbitron-ExtraBold.ttf`         |
| 900 (Black)        | `/fonts/Orbitron/Orbitron-Black.ttf`             |
| variable (400–900) | `/fonts/Orbitron/Orbitron-VariableFont_wght.ttf` |

License: `/fonts/Orbitron/OFL.txt`

### JetBrains Mono — mono (`font-family: 'JetBrains Mono'`)

The design system's `mono` stack starts with `JetBrains Mono`, but the
RoboSystems app does **not** ship JetBrains Mono font files in
`public/fonts/` (it relies on system availability / a separate source), so
no font files were copied. The full mono fallback stack is:

```
'JetBrains Mono', ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas,
'Liberation Mono', monospace
```

If a bundled JetBrains Mono is desired, add the `.ttf`/`.woff2` files under
`public/fonts/JetBrainsMono/` and add matching `@font-face` rules.

### Font-family stacks (from tailwind config)

```css
--rs-font-sans:
  'Space Grotesk', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue',
  Arial, 'Noto Sans', sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol',
  'Noto Color Emoji';
--rs-font-heading: 'Orbitron', 'Space Grotesk', ui-sans-serif, system-ui, sans-serif;
--rs-font-mono:
  'JetBrains Mono', ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'Liberation Mono',
  monospace;
```

Example `@font-face` (repeat per weight; `src` paths shown for Space Grotesk):

```css
@font-face {
  font-family: 'Space Grotesk';
  font-weight: 400;
  font-style: normal;
  font-display: swap;
  src: url('/fonts/SpaceGrotesk/SpaceGrotesk-Regular.ttf') format('truetype');
}
```

---

## Logos

Logo images live under `public/images/logos/` (resolve at runtime as
`/images/logos/...`).

| Logo                     | File                            |
| ------------------------ | ------------------------------- |
| RoboSystems primary logo | `/images/logos/robosystems.png` |
| RoboSystems logo (black) | `/images/logos/logo_black.png`  |

---

## Color palette (CSS custom properties)

Hex values read from `../robosystems-app/tailwind.config.ts`. Paste into a
`:root { ... }` block in `globals.css`.

```css
:root {
  /* Primary — brand blue (50–950) */
  --rs-primary-50: #eff6ff;
  --rs-primary-100: #dbeafe;
  --rs-primary-200: #bfdbfe;
  --rs-primary-300: #93bbfd;
  --rs-primary-400: #6098fa;
  --rs-primary-500: #3b7af5;
  --rs-primary-600: #2563eb;
  --rs-primary-700: #1d4ed8;
  --rs-primary-800: #1b3a57; /* brand primary (dark blue) */
  --rs-primary-900: #1e3a8a;
  --rs-primary-950: #172e47;

  /* Secondary — cyan (50–950) */
  --rs-secondary-50: #ecfeff;
  --rs-secondary-100: #cffafe;
  --rs-secondary-200: #a5f3fc;
  --rs-secondary-300: #67e8f9;
  --rs-secondary-400: #22d3ee;
  --rs-secondary-500: #06b6d4; /* brand secondary (cyan) */
  --rs-secondary-600: #0891b2;
  --rs-secondary-700: #0e7490;
  --rs-secondary-800: #155e75;
  --rs-secondary-900: #164e63;
  --rs-secondary-950: #083344;

  /* Accent — indigo (50–950) */
  --rs-accent-50: #eef2ff;
  --rs-accent-100: #e0e7ff;
  --rs-accent-200: #c7d2fe;
  --rs-accent-300: #a5b4fc;
  --rs-accent-400: #818cf8;
  --rs-accent-500: #6366f1; /* brand accent (indigo) */
  --rs-accent-600: #4f46e5;
  --rs-accent-700: #4338ca;
  --rs-accent-800: #3730a3;
  --rs-accent-900: #312e81;
  --rs-accent-950: #1e1b4b;

  /* Semantic (app-invariant) */
  --rs-success: #00d4aa; /* teal-green */
  --rs-warning: #ff6b35; /* orange */
  --rs-error: #dc2626; /* red */
  --rs-info: #3b7af5; /* primary blue */

  /* Gray (50–950) */
  --rs-gray-50: #f9fafb;
  --rs-gray-100: #f3f4f6;
  --rs-gray-200: #e5e7eb;
  --rs-gray-300: #d1d5db;
  --rs-gray-400: #9ca3af;
  --rs-gray-500: #6b7280;
  --rs-gray-600: #4b5563;
  --rs-gray-700: #374151;
  --rs-gray-800: #1f2937;
  --rs-gray-900: #111827;
  --rs-gray-950: #030712;

  /* Brand gradient (cyan -> blue -> indigo) */
  --rs-gradient-brand: linear-gradient(135deg, #06b6d4, #3b7af5 55%, #6366f1);
}
```

### Notes

- The `secondary-500` (#06B6D4 cyan), `primary-500` (#3B7AF5 blue), and
  `accent-500` (#6366F1 indigo) are the three stops of the brand gradient.
- `--rs-warning` (#FF6B35) matches the `amber-500` step in the app's shared
  semantic amber scale; if a full warning scale is needed, the amber scale in
  the tailwind config runs `amber-50 #FFF5F0` … `amber-950 #731F08`.
- `accent` is deliberately indigo (not violet) to stay distinct from
  RoboLedger's violet primary.
