/**
 * Learn Page
 * Add knowledge from YouTube videos and web URLs
 */

import { useState } from 'react';
import { useLearnFromYouTube, useLearnFromUrl } from '../hooks';
import styles from './LearnPage.module.css';

export default function LearnPage() {
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [processPlaylist, setProcessPlaylist] = useState(false);
  const [webUrl, setWebUrl] = useState('');
  const [showTips, setShowTips] = useState(false);

  const youtubeMutation = useLearnFromYouTube();
  const urlMutation = useLearnFromUrl();

  const handleYouTubeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!youtubeUrl.trim()) return;

    youtubeMutation.mutate(
      { url: youtubeUrl, processPlaylist },
      {
        onSuccess: () => {
          setYoutubeUrl('');
          setProcessPlaylist(false);
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
        },
      }
    );
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>Add Knowledge</h1>
        <p className={styles.subtitle}>Learn from YouTube videos and web content</p>
      </header>

      <div className={styles.cards}>
        {/* YouTube Input */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <div className={styles.cardIcon} data-type="youtube">📺</div>
            <div>
              <h3 className={styles.cardTitle}>YouTube Video</h3>
              <p className={styles.cardDescription}>
                Fetch transcript and analyze video content
              </p>
            </div>
          </div>
          <form onSubmit={handleYouTubeSubmit} className={styles.form}>
            <input
              type="text"
              className={styles.input}
              placeholder="https://youtube.com/watch?v=..."
              value={youtubeUrl}
              onChange={(e) => setYoutubeUrl(e.target.value)}
              disabled={youtubeMutation.isPending}
            />

            <label className={styles.checkbox}>
              <input
                type="checkbox"
                checked={processPlaylist}
                onChange={(e) => setProcessPlaylist(e.target.checked)}
                disabled={youtubeMutation.isPending}
              />
              <span>Process entire playlist</span>
            </label>

            <button
              type="submit"
              className={styles.submitButton}
              disabled={!youtubeUrl.trim() || youtubeMutation.isPending}
            >
              {youtubeMutation.isPending ? 'Learning...' : 'Learn from Video'}
            </button>
          </form>

          {youtubeMutation.isSuccess && (
            <div className={styles.successToast}>
              <span>✓</span>
              Successfully learned from {youtubeMutation.data.savedCount} video(s)
            </div>
          )}

          {youtubeMutation.isError && (
            <div className={styles.errorToast}>
              <span>⚠</span>
              {youtubeMutation.error instanceof Error
                ? youtubeMutation.error.message
                : 'Failed to learn from video'}
            </div>
          )}
        </div>

        {/* Web URL Input */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <div className={styles.cardIcon} data-type="web">🔗</div>
            <div>
              <h3 className={styles.cardTitle}>Web URL</h3>
              <p className={styles.cardDescription}>
                Add content from X, Reddit, LinkedIn, or any web page
              </p>
            </div>
          </div>
          <form onSubmit={handleUrlSubmit} className={styles.form}>
            <input
              type="text"
              className={styles.input}
              placeholder="https://x.com/user/status/..."
              value={webUrl}
              onChange={(e) => setWebUrl(e.target.value)}
              disabled={urlMutation.isPending}
            />

            <button
              type="submit"
              className={styles.submitButton}
              disabled={!webUrl.trim() || urlMutation.isPending}
            >
              {urlMutation.isPending ? 'Adding...' : 'Add URL'}
            </button>
          </form>

          {urlMutation.isSuccess && (
            <div className={styles.successToast}>
              <span>✓</span>
              Successfully added to knowledge base
            </div>
          )}

          {urlMutation.isError && (
            <div className={styles.errorToast}>
              <span>⚠</span>
              {urlMutation.error instanceof Error
                ? urlMutation.error.message
                : 'Failed to add URL'}
            </div>
          )}
        </div>
      </div>

      {/* Tips Section */}
      <section className={styles.tipsSection}>
        <button
          className={styles.tipsToggle}
          onClick={() => setShowTips(!showTips)}
        >
          <span>Tips & Best Practices</span>
          <span className={`${styles.tipsIcon} ${showTips ? styles.open : ''}`}>▼</span>
        </button>

        {showTips && (
          <div className={styles.tipsContent}>
            <div className={styles.tipCard}>
              <strong>YouTube:</strong> Paste a video or playlist URL to automatically
              fetch the transcript and analyze the content for AI engineering insights.
            </div>
            <div className={styles.tipCard}>
              <strong>Web URLs:</strong> Add links from X (Twitter), Reddit, LinkedIn,
              or any web page. Content will be marked as pending for analysis.
            </div>
            <div className={styles.tipCard}>
              <strong>Influencer Tracking:</strong> Content from tracked influencers
              (Andrej Karpathy, Simon Willison, etc.) receives a credibility boost.
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
