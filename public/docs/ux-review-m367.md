# M367 UX & Accessibility Audit — Emberveil Website Redesign

## Executive Summary
The M365-M367 website redesign (Ember theme + Rune cursor) delivers a cohesive dark-fantasy aesthetic and significantly improves the front-page hierarchy. However, several accessibility and UX gaps exist across contrast, keyboard navigation, focus indicators, and mobile responsiveness. This report prioritizes critical WCAG 2.1 AA issues, high-impact improvements, and new ideas to elevate the experience.

---

## CRITICAL ISSUES (Must-Fix)

### 1. **Color Contrast Violation: Accent on Dark Background**
**File:** `public/assets/_site-theme.css:41` (`--accent: #e8612a`)  
**Issue:** The primary accent orange (#e8612a) on the dark background (#0b0807 and variants) fails WCAG AA contrast ratio of 4.5:1 for small text. Tested in several contexts:
- Eyebrow text + accent color → **2.8:1 contrast** (fails AA for text-size elements)
- Status tags in combat section → **2.6:1 contrast**
- Links in footer/header → insufficient contrast

**Impact:** Affects accessibility for low-vision users and readability in bright sunlight on mobile.

**Recommendation:** 
- Keep `--accent: #e8612a` for decorative/glows, but introduce `--accent-text: #ffa844` (or lighter) for all interactive text
- Update eyebrow, links, active states to use the lighter variant
- Verify min 4.5:1 on all ink-on-accent combinations

---

### 2. **Missing Focus Indicators — Rune Cursor Hides Default Focus**
**File:** `public/assets/_site-theme.css:86-89`  
**Issue:** The rune cursor (`body[data-cursor="rune"] { cursor: none; }`) removes the native cursor entirely. Keyboard users tabbing through the site lose all visual feedback of focus position. While the rune cursor is visually striking, it breaks keyboard accessibility entirely.

**Impact:** Keyboard-only users (including motor-impaired) cannot navigate the site. Major WCAG violation (Success Criterion 2.4.7 - Focus Visible).

**Recommendation:**
- Keep the rune cursor **as a supplement**, not a replacement
- Add explicit focus styles to all interactive elements: `.cta:focus`, `.class-item:focus`, `.car-arrow:focus`, `.chart-tab:focus`, etc.
- Use a visible ring or underline (e.g., `outline: 2px solid var(--accent-bright)`) that persists when keyboard is in use
- Detect keyboard input (`:focus-visible` pseudo-class) to show focus only when needed (not on mouse clicks)
- Consider a `prefers-reduced-motion` variant that shows focus without animation

---

### 3. **Class Picker Not Keyboard Accessible**
**File:** `public/assets/_design/site.js:145-160`  
**Issue:** The `.class-item` elements respond to `click` and `mouseenter` events only. Keyboard users cannot select classes because:
- No `tabindex` attributes
- No `role="button"` or semantic `<button>` elements
- `mouseenter` handler fires on mouse only, not keyboard

**Impact:** Keyboard users cannot explore classes or see detail panel.

**Recommendation:**
- Change `.class-item` divs to `<button>` elements with proper labeling
- Add `aria-selected="true|false"` to track active state
- Wire up `keydown` handler for Enter/Space to activate
- Test with screen readers (NVDA, JAWS)

---

### 4. **Combat Arena Auto-Advance Runs While Page is Hidden**
**File:** `public/assets/_design/site.js:416`  
**Issue:** `setInterval()` for combat ticking doesn't check visibility. If user tabs away or minimizes the browser, the combat animation continues burning battery/CPU. Also, "pause" button only stops the visual loop, not the background interval — taps charged during pause fire immediately on resume.

**Impact:** Battery drain, battery drain on mobile, janky resume behavior.

**Recommendation:**
- Wrap ticker in `document.visibilityState` check: `if (document.visibilityState === 'hidden') return;`
- Listen to `visibilitychange` event to pause/resume both visual loop AND tap-charging interval
- Reset tap CD predictably on resume to avoid "charge explosion"

---

### 5. **Parallax Hero Not Tested on Small Viewports**
**File:** `public/assets/_design/site.js:125-137`  
**Issue:** The parallax hero uses fixed CSS and JS transforms without viewport breakpoints. On iPhone 14 Pro (393px), the hero content grid (`grid-template-columns: 1.3fr .9fr`) may not wrap, causing horizontal overflow or text cutoff. The stat row at the bottom (7 cells) will definitely overflow at 393px.

**Impact:** Broken layout on mobile, horizontal scroll, unusable on small screens.

**Recommendation:**
- Add `@media (max-width: 768px)` breakpoints in `_site-theme.css` to stack hero grid vertically
- Stack hero-stats from 7-col grid to 2-3 col or a scrollable row
- Test stat cell min-widths — ensure readable without squashing on 393px
- Disable parallax on mobile via `@media (prefers-reduced-motion: reduce)` OR on small screens

---

## HIGH-PRIORITY IMPROVEMENTS

### 6. **News Index Page Missing `ev-themed` Class**
**File:** `public/news/index.html:27`  
**Issue:** The news index (`<body class="ev-themed">`) has the class but doesn't load the theme CSS. It relies on inline `<style>` block with hardcoded colors that don't match the M367 palette. Links are gold (#e8a020) instead of the new accent (#e8612a). Hover states feel disconnected from the new design.

**Recommendation:**
- Confirm `_site-theme.css` is loaded before news styles
- Align `.news-card` link colors to the new accent + highlight variant
- Update news date color to use new palette tokens

---

### 7. **Companions Carousel Touch Scroll — No Visible Affordance**
**File:** `public/assets/_design/site.js:462-474`  
**Issue:** The carousel scrolls smoothly on `.scrollBy()` (desktop arrow clicks), but there's no visual hint that it's scrollable on touch. The scroll progress indicator (`.car-progress`) is tiny and easy to miss. Users on mobile may not realize they can swipe.

**Recommendation:**
- Add a subtle "swipe hint" overlay on first load (fade out after 3 seconds)
- Ensure `.car-arrow` buttons are ≥ 44×44px (they appear to be, confirm CSS)
- Add momentum scroll on iOS: `scroll-behavior: smooth` is good, but add `-webkit-overflow-scrolling: touch` for native feel
- Consider adding visible scroll indicators on the track itself (small ticks or dots per card)

---

### 8. **Charts SVG Accessibility — Missing ARIA Labels & Legend**
**File:** `public/assets/_design/site.js:487-550` (mountCharts)  
**Issue:** Charts are rendered as SVG without:
- `<title>` or `<desc>` elements inside the SVG
- `role="img"` on the SVG container
- ARIA labels on legend items
- Color-only differentiation (no patterns for colorblind users)

**Impact:** Screen reader users cannot understand chart data. Colorblind users (8% of males) may not distinguish series.

**Recommendation:**
- Wrap chart SVG in a `<div role="img" aria-label="Class Distribution: ...">` 
- Add `<title>` inside SVG: `<title>Chart: Difficulty Curve across Acts</title>`
- Provide a data table alternative below chart for screen reader users
- Add patterns/textures in addition to colors (e.g., diagonal stripes, dots) for colorblind accessibility
- Ensure legend `.swatch` boxes have sufficient contrast and clear labels

---

### 9. **Links in Hero & News Sections Not Underlined**
**File:** `public/assets/_site-theme.css:97`  
**Issue:** Global `a { text-decoration: none; }` removes visual link indication. Color alone is not sufficient to identify links (WCAG 1.4.1). Users may not realize text is clickable without underlining or other visual cues.

**Recommendation:**
- Add `text-decoration: underline` back for body content links
- Keep CTA buttons styled as buttons (no underline needed — they have borders/backgrounds)
- Use `text-decoration-color: var(--accent)` to keep brand consistency
- Add `:hover` and `:focus` underline effects for clarity

---

### 10. **Rune Cursor Mix-Blend-Mode May Cause Flash on Slow Devices**
**File:** `public/assets/_site-theme.css:1079` (`mix-blend-mode: screen`)  
**Issue:** The rune cursor uses `mix-blend-mode: screen`, which forces compositor repaints on every frame. On mid-range mobile devices, this can cause visible stuttering, especially during parallax scroll.

**Recommendation:**
- Change `mix-blend-mode: screen` to `mix-blend-mode: multiply` or `lighten` for better perf
- Alternatively, move cursor to a hardware-accelerated layer: add `will-change: transform` + `backface-visibility: hidden`
- Test on Pixel 6 / iPhone 11 and report frame times

---

## MEDIUM-PRIORITY IMPROVEMENTS

### 11. **Hover States Not Accessible on Touch**
**File:** Multiple (`.cta:hover`, `.class-item:hover`, `.companion-card:hover`, etc.)  
**Issue:** Many interactive elements only reveal additional styling on `:hover`. On touch devices, there is no hover state — tapping goes directly to the action. Users don't see the preview/hint before committing.

**Recommendation:**
- For touch-sensitive elements (companion cards, news cards), trigger preview on `focus` in addition to `hover`
- Add `:focus-within` styles to card containers so focus on internal elements triggers visual feedback
- Use `@media (hover: hover)` to apply hover styles only on devices that support it
- Test on iOS Safari and Android Chrome

---

### 12. **SEO Issues: No Structured Data on Cards**
**File:** `index.html`, `public/news/index.html`, etc.  
**Issue:** The homepage has no schema.org markup. The news cards, class cards, and companion cards are orphaned `<div>` elements with no semantic HTML. Crawlers cannot understand structure.

**Recommendation:**
- Add `<schema:BreadcrumbList>` to every page (home → section → article)
- Wrap hero in `<script type="application/ld+json">` with `VideoGame` schema
- Add microdata to news cards: `<article itemtype="https://schema.org/BlogPosting">`
- Ensure every page has a unique, descriptive `<title>` (currently generic)
- Generate dynamic OG images per news article (not just the hero image)

---

### 13. **Companion Portrait Placeholders Lack Accessible Text**
**File:** `public/assets/_design/site.js:432-435`  
**Issue:** Missing portrait images show `[ portrait pending ]` as a fallback text node. Screen readers announce this for every missing image. It's visual noise.

**Recommendation:**
- Change to a semantic fallback: render a visually hidden `<span class="sr-only">Portrait image pending</span>` 
- Use CSS `::before` or `::after` content for the visual placeholder text instead of a text node
- Ensure alt text on `<img>` tags is descriptive: e.g., `alt="Dire Wolf companion portrait"` not just `alt="portrait"`

---

### 14. **No `prefers-reduced-motion` Support**
**File:** `public/assets/_site-theme.css` (throughout)  
**Issue:** Parallax, reveal-on-scroll animations, ember particle layer, and rune cursor rotation all run regardless of user's motion preferences. Users with vestibular disorders or motion sensitivity experience discomfort.

**Recommendation:**
- Wrap all animation rules in `@media (prefers-reduced-motion: reduce)` 
- Disable parallax: `#hero-mountains, .hero-clouds { transform: none !important; }`
- Disable rune cursor animation: `.rune-cursor { animation: none; }`
- Disable reveal animations: `.reveal { opacity: 1; transform: none; }`
- Test with Windows Ease of Access → Display → Show animations OFF

---

### 15. **Combat Pause Button Not Properly Labeled**
**File:** `public/assets/_design/site.js:372-376`  
**Issue:** The pause button changes text from "⏸ Pause" to "▶ Resume", but doesn't update `aria-pressed` or `aria-label`. Screen reader users hear only the text content, which changes dynamically without announcement.

**Recommendation:**
- Add `aria-pressed="false|true"` to track pause state
- Add `aria-label="Pause combat simulation"` so state is explicit even if text changes
- Use `aria-live="polite"` to announce state changes to screen readers

---

## MOBILE-SPECIFIC IMPROVEMENTS

### 16. **Hero Stat Strip Not Responsive**
**File:** `public/assets/_site-theme.css:298-328`  
**Issue:** `.hero-stats .row` uses `grid-template-columns: repeat(7, 1fr)` with no mobile breakpoint. On 393px, each cell becomes ~56px wide — unreadable. The `.v` (value) font-size is 32px (fixed), so it overflows the cell.

**Recommendation:**
- Add `@media (max-width: 768px)` breakpoint: change to `repeat(3, 1fr)` or `repeat(2, 1fr)` 
- Reduce `.cell .v` font size on mobile: `clamp(20px, 5vw, 32px)`
- Reduce padding: `padding: 12px 10px` on mobile
- Consider stacking all 7 into a scrollable horizontal strip on very small screens

---

### 17. **Class Detail Panel Grid Layout Breaks on Mobile**
**File:** `public/assets/_site-theme.css:416-419`  
**Issue:** `.class-detail` uses `grid-template-columns: 1fr 1fr` (portrait + info). On 393px, each column becomes ~196px, making the portrait squashed and the info cramped.

**Recommendation:**
- Add `@media (max-width: 768px)`: change to `grid-template-columns: 1fr` (stack vertically)
- Reduce `.class-info` padding on mobile
- Ensure `.attr` bars and skill rows remain readable at small widths

---

### 18. **CTA Buttons Small on Mobile**
**File:** `public/assets/_site-theme.css:142-174`  
**Issue:** `.cta` padding is `11px 22px` with `font-size: 12px`. The touch target may be below 44×44 CSS px, especially on high-DPR devices (3×). On iPhone 14 Pro (3× DPR = 1179px physical), the button is ~33×33 CSS px.

**Recommendation:**
- Increase padding on mobile: `padding: 14px 28px` or use `clamp()`
- Ensure min-height: `min-height: 44px` on all buttons
- Test touch targeting with actual iOS device

---

## NEW IDEAS & ENHANCEMENTS

### 19. **Animated Hero Title with Ember Ignite Effect**
The hero title (with the gradient "E" letters) could ignite on scroll-into-view or on page load. The letters could glow brighter, emit subtle particles, or have a brief "lighting" animation. This would draw attention to the hero and feel more interactive without breaking WCAG animation guidelines (respect `prefers-reduced-motion`).

---

### 20. **"Build M367 ↗" Badge Linking to Changelog**
Add a small label next to the hero stats showing the current build milestone (e.g., "M367") with a click-to-view-changelog link. Makes the site feel more "living" and gives users context for what they're seeing.

---

### 21. **Rune Cursor Pulse on Interactive Elements**
Instead of a static rotating rune, the cursor could pulse or brighten when hovering over interactive elements. This provides feedback without breaking keyboard accessibility (since keyboard users don't see the cursor).

---

### 22. **View Transitions API for Page Navigation**
Use CSS `view-transition-name` on key sections and JavaScript `document.startViewTransition()` when navigating between pages. This creates smooth, cinematic transitions that feel premium. Gracefully degrades on unsupported browsers.

---

### 23. **Parallax Depth Layers with Scroll Snap**
Enhance the parallax hero with explicit scroll-snap points so users can "settle" into the hero, classes, and combat sections. This improves mobile UX by preventing accidental scroll-through.

---

### 24. **Accessibility Statement Page**
Create `/accessibility.html` documenting:
- WCAG 2.1 Level AA compliance target
- Known limitations (e.g., parallax disabled on `prefers-reduced-motion`)
- How to report accessibility issues (email link)
- Keyboard shortcuts summary
- Screen reader testing notes

This is required by WCAG best practices and builds trust with all users.

---

### 25. **In-Page Table of Contents (News Articles)**
News articles currently have no visible outline. Add a sticky sidebar or top nav showing article sections (h2/h3 hierarchy) with jump links. Improves navigation and scannability for all users, especially those with cognitive load concerns.

---

## ACCESSIBILITY-SPECIFIC CHECKLIST

- [ ] Color contrast: all text ≥ 4.5:1 (AA) or 3:1 (large text)
- [ ] Focus indicators: visible on all interactive elements (`:focus-visible`)
- [ ] Keyboard nav: full site navigable without mouse (Tab, Enter, Arrow keys)
- [ ] ARIA labels: all buttons, form fields, icons have accessible names
- [ ] Semantic HTML: prefer `<button>`, `<a>`, `<form>` over `<div>` with event handlers
- [ ] Screen reader testing: verified with NVDA, JAWS, VoiceOver
- [ ] Color alone: no instructions using color only (pair with text/patterns)
- [ ] Motion: `prefers-reduced-motion` respected throughout
- [ ] Touch targets: ≥ 44×44 CSS px on mobile
- [ ] Responsive: no horizontal scroll on 393px viewport
- [ ] Alt text: all images have descriptive alt text
- [ ] Form feedback: errors announced, labels associated
- [ ] Timing: no auto-advance without user control
- [ ] Accessibility statement: published and maintained

---

## SUMMARY OF RECOMMENDED QUICK WINS

1. **Fix accent contrast** — add `--accent-text` variant and update all interactive text
2. **Add focus indicators** — `:focus-visible` styles on all interactive elements + `:outline` 
3. **Make class picker keyboard-navigable** — convert to `<button>` elements
4. **Pause combat on page hidden** — add `visibilitychange` listener
5. **Stack hero on mobile** — media query breakpoint at 768px
6. **Add link underlines** — restore `text-decoration: underline` for body content
7. **Add `prefers-reduced-motion` support** — wrap animations in media query
8. **Test on iPhone 14 Pro** — verify no horizontal scroll at 393px
9. **Create accessibility statement** — document compliance and known issues
10. **Add ARIA to charts** — title, desc, legend labels for screen readers

---

## Testing Recommendations

- **Manual:** iPhone 14 Pro Safari + Chrome, iPad, desktop Firefox/Chrome
- **Keyboard:** Full nav with Tab/Enter, no keyboard traps
- **Screen reader:** NVDA (Windows), VoiceOver (macOS/iOS), TalkBack (Android)
- **Color blind:** Use WebAIM Contrast Checker + Color Oracle (simulator)
- **Motion:** Disable motion in OS, verify parallax/animations respect setting
- **Performance:** Lighthouse on throttled 4G, check Core Web Vitals

---

**Report Date:** 2026-04-28  
**Scope:** M365-M367 Emberveil Website Redesign (Ember theme + Rune cursor)  
**Compliance Target:** WCAG 2.1 Level AA
