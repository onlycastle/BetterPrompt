/**
 * Text Formatting Utilities
 *
 * Parses markdown-style bold markers (**text**) into styled React elements.
 * Lightweight alternative to react-markdown for simple bold-only formatting.
 *
 * @module utils/textFormatting
 */

import type { ReactNode, ElementType } from 'react';

/**
 * Parse text with **bold markers** into React elements
 *
 * @param text - Plain text that may contain **bold** markers
 * @param boldClassName - Optional CSS class for bold elements
 * @returns Array of React nodes with bold text properly styled
 *
 * @example
 * parseEmphasis("Your **strategic mind** is impressive")
 * // Returns: ["Your ", <strong>strategic mind</strong>, " is impressive"]
 */
export function parseEmphasis(text: string, boldClassName?: string): ReactNode[] {
  if (!text) return [];

  // Match **text** pattern - captures the full marker including **
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

/**
 * Props for the FormattedText component
 */
interface FormattedTextProps {
  /** Text content that may contain **bold** markers */
  text: string;
  /** CSS class to apply to bold elements */
  boldClassName?: string;
  /** HTML element to render as (default: 'span') */
  as?: ElementType;
  /** CSS class for the container element */
  className?: string;
}

/**
 * Component wrapper for formatted text with bold marker support
 *
 * @example
 * <FormattedText
 *   text="Your **strategic approach** is evident"
 *   as="p"
 *   className={styles.content}
 *   boldClassName={styles.emphasis}
 * />
 */
export function FormattedText({
  text,
  boldClassName,
  as: Component = 'span',
  className,
}: FormattedTextProps) {
  return <Component className={className}>{parseEmphasis(text, boldClassName)}</Component>;
}
