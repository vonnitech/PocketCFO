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
      ? 'text-5xl md:text-6xl'
      : length <= 12
        ? 'text-4xl md:text-5xl'
        : 'text-3xl md:text-4xl';
  }

  if (scale === 'summary') {
    return length <= 9 ? 'text-3xl sm:text-4xl' : length <= 12 ? 'text-2xl sm:text-3xl' : 'text-xl sm:text-2xl';
  }

  return length <= 8 ? 'text-2xl' : length <= 11 ? 'text-xl' : 'text-lg';
}

export const amountFitClass = 'block max-w-full min-w-0 whitespace-nowrap leading-none';
