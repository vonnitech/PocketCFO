---
name: PocketCFO
description: A tactile neobrutalist ledger for clear daily money decisions.
colors:
  action-yellow: "#facc15"
  capture-green: "#00C853"
  risk-red: "#E8174B"
  target-gold: "#F5C518"
  paper-base: "#F2F1EE"
  paper-surface: "#FAFAF9"
  paper-input: "#E5E3DE"
  ink-border: "#1A1A1A"
  ink-text: "#111111"
  ink-muted: "#656565"
  night-base: "#0F0F0F"
  night-surface: "#1A1A1A"
  night-input: "#242424"
  night-border: "#4A4A4A"
  night-text: "#F0F0F0"
  night-muted: "#8b8b8b"
typography:
  display:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "2.25rem"
    fontWeight: 900
    lineHeight: 1
    letterSpacing: "-0.05em"
  headline:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 900
    lineHeight: 1.1
    letterSpacing: "-0.025em"
  body:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: 1.5
    letterSpacing: "normal"
  label:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "0.625rem"
    fontWeight: 900
    lineHeight: 1.2
    letterSpacing: "0.1em"
  numeric:
    fontFamily: "Space Mono, JetBrains Mono, monospace"
    fontSize: "1rem"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "normal"
rounded:
  control: "8px"
  field: "16px"
  panel: "24px"
  feature-card: "32px"
  pill: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  2xl: "24px"
components:
  button-primary:
    backgroundColor: "{colors.ink-border}"
    textColor: "{colors.action-yellow}"
    typography: "{typography.label}"
    rounded: "{rounded.field}"
    height: "48px"
    padding: "12px 20px"
  button-capture:
    backgroundColor: "{colors.capture-green}"
    textColor: "{colors.ink-text}"
    typography: "{typography.label}"
    rounded: "{rounded.field}"
    height: "48px"
    padding: "12px 20px"
  input:
    backgroundColor: "{colors.paper-input}"
    textColor: "{colors.ink-text}"
    typography: "{typography.body}"
    rounded: "{rounded.field}"
    height: "48px"
    padding: "12px 16px"
  chip:
    backgroundColor: "{colors.paper-input}"
    textColor: "{colors.ink-muted}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "6px 12px"
  card:
    backgroundColor: "{colors.paper-surface}"
    textColor: "{colors.ink-text}"
    rounded: "{rounded.panel}"
    padding: "20px"
---

# Design System: PocketCFO

## Overview

**Creative North Star: "The Pocket Ledger"**

PocketCFO feels like a compact physical ledger rebuilt for quick decisions on a phone. Heavy outlines, offset shadows, dense labels, and paper-toned surfaces give financial information weight without making it formal or distant. The system is candid and tactile: controls look pressable, states look deliberate, and the most important number reads immediately.

Signal colors carry meaning rather than decoration. Yellow marks the primary path, green marks money captured or a safe completion, red marks loss or risk, and gold marks goals. The visual system can shift between light and dark and accepts user-selected accent pairs, but the hierarchy, contrast, and semantic distinction between actions remain stable.

**Key Characteristics:**

- Thick, high-contrast outlines and hard offset shadows.
- Warm paper neutrals in light mode and charcoal layers in dark mode.
- Black, italic, tightly tracked display type paired with small uppercase labels.
- Monospaced, tabular figures for money and calculated values.
- Compact mobile layouts with generous touch targets and bottom-sheet interactions.
- Bright signal colors reserved for actions, outcomes, targets, and risk.

## Colors

The default palette pairs warm paper and dense ink with four explicit financial signals. Theme customization may replace the primary and capture accents, but generated foreground colors must remain readable.

### Primary

- **Action Yellow:** The main action and selected-state color. Use it for the strongest next step, active navigation, and focus accents.

### Secondary

- **Capture Green:** Money successfully protected, captured, completed, or available as a positive outcome.
- **Risk Red:** Overspending, destructive actions, shortfalls, and conditions that demand attention.

### Tertiary

- **Target Gold:** Savings goals, target progress, and goal-linked emphasis distinct from routine positive states.

### Neutral

- **Paper Base:** The light-mode page canvas.
- **Paper Surface:** Raised light-mode cards, sheets, and navigation.
- **Paper Input:** Recessed fields, inactive controls, and secondary groupings.
- **Ink Border:** Structural outlines and the primary dark button surface.
- **Ink Text:** Primary light-mode content.
- **Ink Muted:** Secondary copy that still meets the intended contrast floor.
- **Night Base, Surface, and Input:** Three distinct dark-mode layers that preserve the same page, card, and field hierarchy.
- **Night Border, Text, and Muted:** Dark-mode structure and type roles.

### Named Rules

**The Signal Has a Job Rule.** Yellow means primary or selected, green means captured or successfully completed, red means risk or destructive action, and gold means a target. Do not use these colors as interchangeable decoration.

**The Theme Keeps the Hierarchy Rule.** Custom accent pairs may change brand expression, but they must preserve foreground contrast and the distinction between primary action, capture, and risk.

## Typography

**Display Font:** Inter (with system-ui and sans-serif fallbacks)

**Body Font:** Inter (with system-ui and sans-serif fallbacks)

**Label/Mono Font:** Space Mono (with JetBrains Mono and monospace fallbacks)

**Character:** Inter becomes forceful through black weights, italic display styling, tight tracking, and uppercase structure. Space Mono gives monetary figures the fixed rhythm of a receipt or ledger and keeps columns of values easy to compare.

### Hierarchy

- **Display:** Black weight, usually italic and uppercase, with tight or tighter tracking. Use for page titles and the safe-to-spend hero.
- **Headline:** Heavy uppercase type for card titles and major section transitions.
- **Title:** Bold or black uppercase type for component headings and decisive states.
- **Body:** Medium-to-bold sentence case for explanations. Keep paragraphs brief and favor direct, concrete language.
- **Label:** Extra-bold uppercase type at 9–11px with wide tracking for metadata, categories, controls, and status labels.
- **Numeric:** Bold Space Mono with tabular numerals for currency, percentages, dates when aligned, and calculated outputs.

### Named Rules

**The Ledger Number Rule.** Money and comparable calculations use the monospaced numeric voice; prose and actions use the sans-serif voice.

**The Label Earns Its Volume Rule.** Uppercase tracked labels stay short. Explanations use sentence case rather than forcing whole paragraphs into display styling.

## Layout

PocketCFO is mobile-first. Route content fills the available width, while focused controls and configuration screens commonly stop at a narrow readable measure. The persistent bottom navigation is centered and capped to a phone-sized width; secondary destinations rise from the same edge in a bottom sheet.

The spacing rhythm uses 4px increments with 8px, 12px, 16px, 20px, and 24px as the recurring steps. Dense groups use 8–12px gaps; cards use 16–24px internal padding; page sections typically separate by 20–24px. Keep related controls close, then use a visibly larger break before a new decision group.

Responsive layouts collapse to one column first. Add columns only when each item remains readable and touchable. Fixed-width values and action buttons should shrink last; flexible text regions need `min-width: 0` and truncation where overflow would break the row. Account for safe-area insets around the top header, bottom navigation, and sheets.

## Elevation & Depth

Depth is structural and deliberately graphic. Resting surfaces use thick borders; important cards and primary controls add hard, zero-blur offset shadows. A press or hover removes the shadow and translates the element toward it, making the control feel physically depressed. Dark mode may tint large structural shadows with the capture color while keeping small control shadows tied to their semantic accent.

### Shadow Vocabulary

- **Standard lift** (`5px 5px 0 0 rgba(0, 0, 0, 1)`): Default emphatic card or control elevation.
- **Compact lift** (`3px 3px 0 0 rgba(0, 0, 0, 1)`): Buttons, chips, and compact interactive elements.
- **Feature lift** (`8px 8px 0 0 var(--shadow-color)`): Large signature cards such as the shared `BrutalCard`.
- **Signal lift** (`5px 5px 0 0` in capture, target, or risk color): A semantic emphasis whose shadow reinforces the state.

### Named Rules

**The Shadow Is Structure Rule.** Use zero-blur offset shadows to establish importance or interaction. Do not add ambient blur, glass, or decorative glow as a default material.

**The Press Completes the Shadow Rule.** Interactive raised controls move into their shadow and lose it on hover, press, or active feedback.

## Shapes

The system combines thick rectilinear construction with generous corners. Small controls use 8px corners, fields and buttons use 16px, sheets and navigation use 24px, and signature cards may reach 32px. Pills are reserved for categories, compact choices, badges, and progress tracks.

Borders are usually 2–4px and visually carry the component. Outer cards take the heaviest strokes; internal dividers and secondary controls step down. Bottom sheets round only their top edge, reinforcing that they rise from below. Circular forms are reserved for icon actions, avatars, indicators, and true progress rings.

## Components

### Buttons

- **Shape:** Tactile rounded rectangles, usually 16px corners and a 48px minimum height for primary actions.
- **Primary:** Ink background with action-yellow text, a heavy border, uppercase label, and compact offset yellow shadow.
- **Capture:** Capture-green background with a readable generated foreground when the action protects or confirms money.
- **Risk:** Risk-red or a red-tinted surface for destructive actions and financial danger; confirmation language remains factual.
- **Hover / Focus:** Translate by roughly 2px into the shadow on hover or press. Keep a visible high-contrast focus treatment and honor reduced motion.
- **Secondary / Ghost:** Paper-input or transparent surfaces with a 2–4px border. Increase border contrast on hover instead of adding soft elevation.

### Chips

- **Style:** Compact uppercase labels inside 2px pill borders. Unselected chips sit on the input surface with muted text.
- **State:** Selected chips use an ink surface, action-yellow text, and a small yellow offset shadow. Color-coded status chips may use a semantic fill when their meaning is explicit.

### Cards / Containers

- **Corner Style:** 24px for common panels; 32px for signature feature cards.
- **Background:** Surface color over the page base. Recessed sections use the input color.
- **Shadow Strategy:** Flat for routine grouping, standard lift for emphasis, and feature lift for the most important content.
- **Border:** 3–4px on primary structures, 2px on nested controls and dividers.
- **Internal Padding:** 16–24px, varied to match information density.

### Inputs / Fields

- **Style:** Recessed input background or transparent fill, heavy outline, 16px corners, bold text, and monospaced styling for amounts.
- **Focus:** Shift the fill or border contrast without changing layout. Currency symbols and units remain visually attached to the field.
- **Error / Disabled:** Risk color identifies errors. Disabled controls reduce opacity while preserving readable labels and their original geometry.

### Navigation

The main navigation is a floating bottom pill with five equal touch targets. Active destinations use action yellow with ink text; inactive destinations use muted text and transparent borders. The More control opens a full-width bottom sheet containing grouped destinations, display controls, account context, and sign-out. Icons keep a consistent 2px stroke so selection changes color and surface rather than icon weight.

### Safe-to-Spend Hero

The daily number is the primary product artifact. Give it the strongest numeric hierarchy on the dashboard, keep its explanation close, and ensure spend limits and pacing never create a competing or contradictory figure elsewhere. Privacy mode must obscure it wherever it appears.

### Bottom Sheets

Sheets use a dimmed backdrop, a 4px top border, rounded top corners, a drag handle, safe-area bottom padding, and a spring entrance from the bottom. Use them for compact mobile actions that originate near the bottom edge; keep critical information and the primary action visible without unnecessary nesting.

## Do's and Don'ts

### Do:

- **Do** make the safe-to-spend amount the clearest number on the dashboard.
- **Do** use the same semantic color for the same financial meaning across screens.
- **Do** preserve the paper, ink, thick-border, and hard-shadow construction in both light and dark themes.
- **Do** use monospaced tabular numerals for money and comparable calculations.
- **Do** keep touch targets generous and layout rows resilient to long labels and localized values.
- **Do** treat user-selected themes as controlled substitutions for primary and capture accents while retaining contrast.
- **Do** honor reduced-motion preferences and visible keyboard focus.

### Don't:

- **Don't** introduce soft glass panels, diffuse SaaS shadows, gradient text, or low-contrast gray-on-color copy.
- **Don't** use yellow, green, red, or gold decoratively when it would weaken their financial meaning.
- **Don't** multiply card containers without a grouping reason or nest equally heavy cards inside one another.
- **Don't** present two daily-availability numbers that apply different calculations or unexplained modifiers.
- **Don't** change icon weight, border thickness, or corner scale arbitrarily between selected and unselected states.
- **Don't** use moralizing success or failure language for spending behavior.
