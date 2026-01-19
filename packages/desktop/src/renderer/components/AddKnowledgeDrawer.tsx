/**
 * Add Knowledge Drawer
 * Slide-in panel for adding knowledge from YouTube and web URLs
 * Consolidates the Learn functionality into Knowledge section
 */

import { useState, useEffect, useRef } from 'react';
import { useLearnFromYouTube, useLearnFromUrl } from '../hooks';
import styles from './AddKnowledgeDrawer.module.css';

interface AddKnowledgeDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

type InputMode = 'youtube' | 'web';

export function AddKnowledgeDrawer({ isOpen, onClose, onSuccess }: AddKnowledgeDrawerProps) {
  const [mode, setMode] = useState<InputMode>('youtube');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [processPlaylist, setProcessPlaylist] = useState(false);
  const [webUrl, setWebUrl] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const youtubeMutation = useLearnFromYouTube();
  const urlMutation = useLearnFromUrl();

  // Focus input when drawer opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 200);
    }
  }, [isOpen, mode]);

  // Reset on close
  useEffect(() => {
    if (!isOpen) {
      setTimeout(() => {
        setYoutubeUrl('');
        setWebUrl('');
        setProcessPlaylist(false);
        youtubeMutation.reset();
        urlMutation.reset();
      }, 300);
    }
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  const handleYouTubeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!youtubeUrl.trim()) return;

    youtubeMutation.mutate(
      { url: youtubeUrl, processPlaylist },
      {
        onSuccess: () => {
          setYoutubeUrl('');
          setProcessPlaylist(false);
          onSuccess?.();
        },
      }
    );
  };

  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!webUrl.trim()) return;

    urlMutation.mutate(
      { url: webUrl },
      {
        onSuccess: () => {
          setWebUrl('');
          onSuccess?.();
        },
      }
    );
  };

  const isPending = youtubeMutation.isPending || urlMutation.isPending;

  return (
    <>
      {/* Backdrop */}
      <div
        className={`${styles.backdrop} ${isOpen ? styles.visible : ''}`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <aside
        className={`${styles.drawer} ${isOpen ? styles.open : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label="Add Knowledge"
      >
        {/* Header */}
        <header className={styles.header}>
          <div className={styles.headerContent}>
            <h2 className={styles.title}>Add Knowledge</h2>
            <p className={styles.subtitle}>Import from external sources</p>
          </div>
          <button
            className={styles.closeButton}
            onClick={onClose}
            aria-label="Close drawer"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path
                d="M15 5L5 15M5 5L15 15"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </header>

        {/* Mode Tabs */}
        <div className={styles.tabs}>
          <button
            className={`${styles.tab} ${mode === 'youtube' ? styles.active : ''}`}
            onClick={() => setMode('youtube')}
            disabled={isPending}
          >
            <span className={styles.tabIcon}>📺</span>
            YouTube
          </button>
          <button
            className={`${styles.tab} ${mode === 'web' ? styles.active : ''}`}
            onClick={() => setMode('web')}
            disabled={isPending}
          >
            <span className={styles.tabIcon}>🔗</span>
            Web URL
          </button>
        </div>

        {/* Content */}
        <div className={styles.content}>
          {mode === 'youtube' ? (
            <form onSubmit={handleYouTubeSubmit} className={styles.form}>
              <div className={styles.inputGroup}>
                <label className={styles.label}>YouTube URL</label>
                <input
                  ref={inputRef}
                  type="text"
                  className={styles.input}
                  placeholder="https://youtube.com/watch?v=..."
                  value={youtubeUrl}
                  onChange={(e) => setYoutubeUrl(e.target.value)}
                  disabled={youtubeMutation.isPending}
                />
              </div>

              <label className={styles.checkbox}>
                <input
                  type="checkbox"
                  checked={processPlaylist}
                  onChange={(e) => setProcessPlaylist(e.target.checked)}
                  disabled={youtubeMutation.isPending}
                />
                <span className={styles.checkmark} />
                <span>Process entire playlist</span>
              </label>

              <button
                type="submit"
                className={styles.submitButton}
                disabled={!youtubeUrl.trim() || youtubeMutation.isPending}
              >
                {youtubeMutation.isPending ? (
                  <>
                    <span className={styles.spinner} />
                    Learning...
                  </>
                ) : (
                  'Learn from Video'
                )}
              </button>

              {youtubeMutation.isSuccess && (
                <div className={styles.toast} data-type="success">
                  <span className={styles.toastIcon}>✓</span>
                  Successfully learned from {youtubeMutation.data.savedCount} video(s)
                </div>
              )}

              {youtubeMutation.isError && (
                <div className={styles.toast} data-type="error">
                  <span className={styles.toastIcon}>!</span>
                  {youtubeMutation.error instanceof Error
                    ? youtubeMutation.error.message
                    : 'Failed to learn from video'}
                </div>
              )}
            </form>
          ) : (
            <form onSubmit={handleUrlSubmit} className={styles.form}>
              <div className={styles.inputGroup}>
                <label className={styles.label}>Web URL</label>
                <input
                  ref={inputRef}
                  type="text"
                  className={styles.input}
                  placeholder="https://x.com/user/status/..."
                  value={webUrl}
                  onChange={(e) => setWebUrl(e.target.value)}
                  disabled={urlMutation.isPending}
                />
                <p className={styles.hint}>
                  Supports X, Reddit, LinkedIn, and any web page
                </p>
              </div>

              <button
                type="submit"
                className={styles.submitButton}
                disabled={!webUrl.trim() || urlMutation.isPending}
              >
                {urlMutation.isPending ? (
                  <>
                    <span className={styles.spinner} />
                    Adding...
                  </>
                ) : (
                  'Add to Knowledge'
                )}
              </button>

              {urlMutation.isSuccess && (
                <div className={styles.toast} data-type="success">
                  <span className={styles.toastIcon}>✓</span>
                  Successfully added to knowledge base
                </div>
              )}

              {urlMutation.isError && (
                <div className={styles.toast} data-type="error">
                  <span className={styles.toastIcon}>!</span>
                  {urlMutation.error instanceof Error
                    ? urlMutation.error.message
                    : 'Failed to add URL'}
                </div>
              )}
            </form>
          )}
        </div>

        {/* Tips */}
        <div className={styles.tips}>
          <div className={styles.tipHeader}>
            <span className={styles.tipIcon}>💡</span>
            Quick Tip
          </div>
          <p className={styles.tipText}>
            {mode === 'youtube'
              ? 'Transcripts are automatically extracted and analyzed for AI engineering insights.'
              : 'Content from tracked influencers receives a credibility boost in search rankings.'}
          </p>
        </div>
      </aside>
    </>
  );
}
