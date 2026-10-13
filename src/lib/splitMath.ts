// Pure Bill Splitter maths, shared by the page and its checks.

// Reads one typed number that may use thousands separators or a decimal comma:
// "1,000" → 1000, "12,50" → 12.5, "1.234,56" → 1234.56, "1,234.56" → 1234.56.
function readNumber(chunk: string): number {
  const commas = (chunk.match(/,/g) ?? []).length;
  const dots = (chunk.match(/\./g) ?? []).length;
  let s = chunk;
  if (commas && dots) {
    // Whichever comes last is the decimal point; the other separates thousands
    const decimal = chunk.lastIndexOf(',') > chunk.lastIndexOf('.') ? ',' : '.';
    s = s.split(decimal === ',' ? '.' : ',').join('').replace(',', '.');
  } else if (commas) {
    // One comma followed by exactly three digits is a thousands separator, otherwise a decimal comma
    s = commas === 1 && !/,\d{3}$/.test(chunk) ? s.replace(',', '.') : s.split(',').join('');
  } else if (dots > 1) {
    s = s.split('.').join('');
  }
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

// Mini-calculator for the per-person fields: type "12+8+5" and it sums. Supports
// + - * / and decimals, evaluated safely with no eval() (the app's CSP blocks it).
// Never returns a negative amount.
export function evalAmount(expr: string): number {
  if (!expr) return 0;
  // "1 000" is one number; spaces elsewhere are just spacing
  const cleaned = expr
    .replace(/(\d)\s+(?=\d{3}(?!\d))/g, '$1')
    .replace(/[^\d.,+\-*/]/g, '');
  const tokens = cleaned.match(/[\d.,]+|[+\-*/]/g) ?? [];
  let pos = 0;

  const factor = (): number => {
    const t = tokens[pos];
    if (t === '+') { pos++; return factor(); }
    if (t === '-') { pos++; return -factor(); }
    if (t !== undefined && /\d/.test(t)) { pos++; return readNumber(t); }
    if (t !== undefined && !/[+\-*/]/.test(t)) pos++; // lone separator such as ","
    return 0; // missing operand, e.g. a trailing "12+"
  };
  const term = (): number => {
    let v = factor();
    while (tokens[pos] === '*' || tokens[pos] === '/') {
      const op = tokens[pos++];
      const f = factor();
      v = op === '*' ? v * f : (f === 0 ? 0 : v / f);
    }
    return v;
  };
  const expression = (): number => {
    let v = term();
    while (tokens[pos] === '+' || tokens[pos] === '-') {
      const op = tokens[pos++];
      v = op === '+' ? v + term() : v - term();
    }
    return v;
  };

  const result = expression();
  return Number.isFinite(result) && result > 0 ? result : 0;
}

// Rounds to whole cents.
export const toCents = (n: number) => Math.round(n * 100);

// Even split of `total` between `people` (you included), in whole cents. Everyone else pays
// the same share; you, as the one fronting the bill, cover the leftover cent or two so the
// shares always add back up to the bill exactly.
export function splitEven(total: number, people: number): { theirShare: number; yourShare: number } {
  const totalCents = toCents(total);
  if (people <= 0 || totalCents <= 0) return { theirShare: 0, yourShare: 0 };
  const theirCents = people === 1 ? 0 : Math.floor(totalCents / people);
  return { theirShare: theirCents / 100, yourShare: (totalCents - theirCents * (people - 1)) / 100 };
}
