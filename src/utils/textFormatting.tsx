/**
 * Text Formatting Utilities
 *
 * Parses markdown-style bold markers (**text**) into styled React elements.
 * Also supports paragraph separation (\n\n) and quote detection (「...」 or legacy "...").
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

  // Primary: 「...」 corner bracket markers (new, unambiguous)
  const hasCornerBrackets = text.includes('「');
  // Use 「」 if present, else fall back to legacy "..." for old DB data
  const quoteRegex = hasCornerBrackets ? /「([^」]+)」/g : /"([^"]{20,})"/g;

  const segments: Array<{ text: string; isQuote: boolean }> = [];
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
      // Corner brackets: inner text only (markers stripped)
      // Legacy quotes: full match including "..." (preserve reading flow)
      text: hasCornerBrackets ? match[1] : match[0],
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
 * Render paragraph text with soft break (\n) support
 *
 * Splits paragraph text by single \n and inserts visual spacers between segments.
 * If text has no \n, falls back to standard parseQuotesAndEmphasis (backward compatible).
 *
 * @param text - Paragraph text that may contain single \n for soft breaks
 * @param boldClassName - CSS class for bold elements
 * @param quoteClassName - CSS class for quote elements
 * @param softBreakClassName - CSS class for the soft break spacer element
 * @returns Array of React nodes with soft breaks rendered
 */
function renderParagraphWithSoftBreaks(
  text: string,
  boldClassName?: string,
  quoteClassName?: string,
  softBreakClassName?: string
): ReactNode[] {
  const segments = text.split('\n');

  // Single segment (no \n) — backward compatible path
  if (segments.length === 1) {
    return parseQuotesAndEmphasis(text, boldClassName, quoteClassName);
  }

  // Multiple segments — insert soft break spacers between them
  const result: ReactNode[] = [];
  segments.forEach((segment, index) => {
    const trimmed = segment.trim();
    if (trimmed) {
      result.push(
        <Fragment key={`soft-seg-${index}`}>
          {parseQuotesAndEmphasis(trimmed, boldClassName, quoteClassName)}
        </Fragment>
      );
    }
    if (index < segments.length - 1) {
      result.push(<br key={`soft-br-${index}`} />);
      if (softBreakClassName) {
        result.push(
          <span key={`soft-spacer-${index}`} className={softBreakClassName} />
        );
      }
    }
  });

  return result;
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
  /** CSS class for the soft break spacer within paragraphs */
  softBreakClassName?: string;
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
  softBreakClassName,
  className,
}: FormattedPersonalityTextProps) {
  if (!text) return null;

  // Split into paragraphs by \n\n (or multiple newlines)
  let paragraphs = text.split(/\n\n+/).filter((p) => p.trim());

  // Fallback for legacy data: if only 1 paragraph and text is long,
  // split by sentence boundaries into balanced paragraphs
  if (paragraphs.length === 1 && text.length > 800) {
    paragraphs = splitIntoBalancedParagraphs(text);
  }

  return (
    <div className={className}>
      {paragraphs.map((para, index) => (
        <p key={index} className={paragraphClassName}>
          {renderParagraphWithSoftBreaks(para.trim(), boldClassName, quoteClassName, softBreakClassName)}
        </p>
      ))}
    </div>
  );
}

/**
 * Split a long text into balanced paragraphs using sentence boundaries.
 * Used as fallback for legacy data that lacks \n\n paragraph separators.
 *
 * @param text - Long text string without paragraph breaks
 * @param targetParagraphs - Target number of paragraphs (default: 4-5)
 * @returns Array of paragraph strings
 */
function splitIntoBalancedParagraphs(text: string, targetParagraphs = 5): string[] {
  // Split by sentence boundaries while preserving the delimiter
  const sentences = text.split(/(?<=[.!?])\s+/).filter((s) => s.trim());

  if (sentences.length <= targetParagraphs) {
    // Not enough sentences to split meaningfully
    return sentences.length > 1 ? sentences : [text];
  }

  const sentencesPerParagraph = Math.ceil(sentences.length / targetParagraphs);
  const paragraphs: string[] = [];

  for (let i = 0; i < sentences.length; i += sentencesPerParagraph) {
    const chunk = sentences.slice(i, i + sentencesPerParagraph).join(' ');
    if (chunk.trim()) {
      paragraphs.push(chunk.trim());
    }
  }

  return paragraphs;
}
