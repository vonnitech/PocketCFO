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

export const amountFitClass = 'block max-w-full min-w-0 overflow-hidden text-ellipsis whitespace-nowrap leading-none';
