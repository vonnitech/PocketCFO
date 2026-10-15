export type AmountDisplayScale = 'compact' | 'summary' | 'hero';

/**
 * Keeps formatted money on one line by stepping the type size down according
 * to the rendered string length. Currency symbols, separators and signs all
 * count because they consume real space in the card.
 */
export function amountTextSize(text: string, scale: AmountDisplayScale = 'compact'): string {
  const length = text.length;

  if (scale === 'hero') {
    return length <= 9
      ? 'text-3xl min-[420px]:text-5xl md:text-6xl'
      : length <= 12
        ? 'text-2xl min-[420px]:text-4xl md:text-5xl'
        : length <= 16
          ? 'text-xl min-[420px]:text-3xl md:text-4xl'
          : 'text-base min-[420px]:text-2xl md:text-3xl';
  }

  if (scale === 'summary') {
    return length <= 9
      ? 'text-3xl sm:text-4xl'
      : length <= 12
        ? 'text-xl min-[420px]:text-2xl sm:text-3xl'
      : length <= 16
          ? 'text-sm min-[420px]:text-xl sm:text-2xl'
          : 'text-[10px] min-[420px]:text-sm sm:text-lg';
  }

  return length <= 8
    ? 'text-2xl'
    : length <= 11
      ? 'text-base min-[420px]:text-xl'
      : length <= 14
        ? 'text-xs min-[420px]:text-base'
        : length <= 18
          ? 'text-[10px] min-[420px]:text-xs'
          : 'text-[9px] min-[420px]:text-[10px]';
}

/**
 * Keeps a formatted amount on one line inside a fixed-width card.
 *
 * Nineteen of the twenty places this class is used render the amount in italic,
 * and an italic glyph paints past the width the browser reserves for it. Any
 * clipping box therefore shaves the last character of a right-aligned figure:
 * $289.00 rendered with the final zero cut in half. On a screen whose whole job
 * is showing people money, that reads as a broken number rather than a font
 * artefact.
 *
 * Fixed with right padding, which moves the ink inward, and NOT with
 * `overflow-clip-margin`, which was tried first and does not work here.
 *
 * The reason is worth recording so nobody reaches for it again. These amounts
 * sit inside a wrapper that carries its own `overflow-hidden`, in eighteen
 * places across the app. A clip margin only relaxes clipping on the element it
 * is set on; the ancestor still clips at its own edge, so the glyph was shaved
 * exactly as before. Padding is immune to that, because the text never reaches
 * the ancestor's edge in the first place.
 *
 * 0.2em clears a heavy italic's lean with room to spare, and in em so it tracks
 * the type size this module steps up and down. The cost is that right-aligned
 * figures sit a few pixels further left, which is a fair trade for not printing
 * a cut-off number in a money app.
 */
export const amountFitClass = 'block max-w-full min-w-0 overflow-hidden text-ellipsis whitespace-nowrap leading-none pr-[0.2em]';
