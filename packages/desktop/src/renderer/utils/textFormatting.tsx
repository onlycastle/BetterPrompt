/**
 * Text Formatting Utilities
 *
 * Parses markdown-style bold markers (**text**) into styled React elements.
 * Lightweight alternative to react-markdown for simple bold-only formatting.
 */

import type { ReactNode, ElementType } from 'react';

/**
 * Parse text with **bold markers** into React elements
 */
export function parseEmphasis(text: string, boldClassName?: string): ReactNode[] {
  if (!text) return [];

  // Match **text** pattern
  const parts = text.split(/(\*\*[^*]+\*\*)/g);

  return parts
    .map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        const content = part.slice(2, -2);
        return (
          <strong key={index} className={boldClassName}>
            {content}
          </strong>
        );
      }
      return part;
    })
    .filter((part) => part !== '');
}

interface FormattedTextProps {
  text: string;
  boldClassName?: string;
  as?: ElementType;
  className?: string;
}

/**
 * Component wrapper for formatted text with bold marker support
 */
export function FormattedText({
  text,
  boldClassName,
  as: Component = 'span',
  className,
}: FormattedTextProps) {
  return <Component className={className}>{parseEmphasis(text, boldClassName)}</Component>;
}
