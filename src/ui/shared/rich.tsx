import type { ReactNode } from 'react';

/**
 * Turns the `<b>word</b>` marks of a translated text into bold elements. Only `<b>` is known; any
 * other text stays text, so a translation cannot add markup. Keep the marks in the translation.
 */
export function rich(text: string): ReactNode[] {
  return text
    .split(/(<b>.*?<\/b>)/g)
    .map((part, i) =>
      part.startsWith('<b>') && part.endsWith('</b>') ? <b key={i}>{part.slice(3, -4)}</b> : part,
    );
}
