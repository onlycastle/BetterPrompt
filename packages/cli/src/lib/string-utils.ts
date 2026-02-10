import stringWidth from 'string-width';

export function visualWidth(str: string): number {
  return stringWidth(str);
}

export function visualPadEnd(str: string, targetWidth: number): string {
  const padding = Math.max(0, targetWidth - stringWidth(str));
  return str + ' '.repeat(padding);
}
