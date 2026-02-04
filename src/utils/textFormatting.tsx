/**
 * Text Formatting Utilities
 *
 * Parses markdown-style bold markers (**text**) into styled React elements.
 * Also supports paragraph separation (\n\n) and quote detection ("...").
 * Lightweight alternative to react-markdown for simple formatting.
 *
 * @module utils/textFormatting
 */

import type { ReactNode, ElementType } from 'react';
import { Fragment } from 'react';

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

/**
 * Parse quotes within text - detects "..." patterns (20+ chars)
 * Returns an array of segments with quote flag
 *
 * @param text - Text that may contain "quoted" portions
 * @returns Array of { text, isQuote } segments
 */
function parseQuoteSegments(text: string): Array<{ text: string; isQuote: boolean }> {
  if (!text) {
    return [];
  }

  const segments: Array<{ text: string; isQuote: boolean }> = [];
  const quoteRegex = /"([^"]{20,})"/g;

  let lastIndex = 0;
  let match;

  while ((match = quoteRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({
        text: text.slice(lastIndex, match.index),
        isQuote: false,
      });
    }

    segments.push({
      text: match[0],
      isQuote: true,
    });

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    segments.push({
      text: text.slice(lastIndex),
      isQuote: false,
    });
  }

  return segments.length > 0 ? segments : [{ text, isQuote: false }];
}

/**
 * Parse text with quotes and bold markers into React elements
 *
 * @param text - Text with potential "quotes" and **bold** markers
 * @param boldClassName - CSS class for bold elements
 * @param quoteClassName - CSS class for quote elements
 * @returns Array of React nodes
 */
function parseQuotesAndEmphasis(
  text: string,
  boldClassName?: string,
  quoteClassName?: string
): ReactNode[] {
  const segments = parseQuoteSegments(text);

  return segments.flatMap((segment, segIndex) => {
    // Parse bold markers within each segment
    const boldParsed = parseEmphasis(segment.text, boldClassName);

    if (segment.isQuote && quoteClassName) {
      // Wrap the entire quote in a styled span
      return (
        <span key={`quote-${segIndex}`} className={quoteClassName}>
          {boldParsed}
        </span>
      );
    }

    // For non-quote segments, return with unique keys
    return boldParsed.map((node, nodeIndex) => (
      <Fragment key={`seg-${segIndex}-${nodeIndex}`}>{node}</Fragment>
    ));
  });
}

/**
 * Props for the FormattedPersonalityText component
 */
interface FormattedPersonalityTextProps {
  /** Text content with paragraphs (\n\n), "quotes", and **bold** markers */
  text: string;
  /** CSS class for bold elements */
  boldClassName?: string;
  /** CSS class for quote elements */
  quoteClassName?: string;
  /** CSS class for paragraph wrapper */
  paragraphClassName?: string;
  /** CSS class for the container element */
  className?: string;
}

/**
 * Component for personality summary with paragraph, quote, and bold support
 *
 * Parsing order:
 * 1. Split by \n\n into paragraphs
 * 2. Within each paragraph, detect "..." quotes (20+ chars)
 * 3. Within each segment, parse **bold** markers
 *
 * @example
 * <FormattedPersonalityText
 *   text="First paragraph about **problem-solving**.\n\nSecond paragraph with \"a memorable quote from the developer\" and more text."
 *   paragraphClassName={styles.paragraph}
 *   quoteClassName={styles.quote}
 *   boldClassName={styles.emphasis}
 * />
 */
export function FormattedPersonalityText({
  text,
  boldClassName,
  quoteClassName,
  paragraphClassName,
  className,
}: FormattedPersonalityTextProps) {
  if (!text) return null;

  // Split into paragraphs by \n\n (or multiple newlines)
  const paragraphs = text.split(/\n\n+/).filter((p) => p.trim());

  return (
    <div className={className}>
      {paragraphs.map((para, index) => (
        <p key={index} className={paragraphClassName}>
          {parseQuotesAndEmphasis(para.trim(), boldClassName, quoteClassName)}
        </p>
      ))}
    </div>
  );
}
