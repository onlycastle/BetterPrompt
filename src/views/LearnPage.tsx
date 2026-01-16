import { useState } from 'react';
import { Youtube, Link, CheckCircle, AlertCircle, ChevronDown } from 'lucide-react';
import { Header } from '@/components/layout';
import { Card, CardHeader, CardContent } from '@/components/ui/Card';
import { Input, Button } from '@/components/ui';
import { useLearnFromYouTube, useLearnFromUrl } from '@/hooks/useLearn';
import styles from './LearnPage.module.css';

export function LearnPage() {
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
    <div className={styles.page}>
      <Header
        title="Add Knowledge"
        subtitle="Learn from YouTube videos and web content"
      />

      <div className={styles.container}>
        {/* YouTube Input */}
        <Card className={styles.formCard}>
          <CardHeader>
            <div className={styles.cardIcon} style={{ backgroundColor: 'var(--platform-youtube)' }}>
              <Youtube size={20} color="white" />
            </div>
            <div>
              <h3 className={styles.cardTitle}>YouTube Video</h3>
              <p className={styles.cardDescription}>
                Fetch transcript and analyze video content
              </p>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleYouTubeSubmit} className={styles.form}>
              <Input
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

              <Button
                type="submit"
                disabled={!youtubeUrl.trim() || youtubeMutation.isPending}
                loading={youtubeMutation.isPending}
              >
                {youtubeMutation.isPending ? 'Learning...' : 'Learn from Video'}
              </Button>
            </form>

            {youtubeMutation.isSuccess && (
              <div className={styles.successToast}>
                <CheckCircle size={16} />
                <span>
                  Successfully learned from {youtubeMutation.data.savedCount} video(s)
                </span>
              </div>
            )}

            {youtubeMutation.isError && (
              <div className={styles.errorToast}>
                <AlertCircle size={16} />
                <span>{youtubeMutation.error instanceof Error ? youtubeMutation.error.message : 'Failed to learn from video'}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Web URL Input */}
        <Card className={styles.formCard}>
          <CardHeader>
            <div className={styles.cardIcon} style={{ backgroundColor: 'var(--accent-primary)' }}>
              <Link size={20} color="white" />
            </div>
            <div>
              <h3 className={styles.cardTitle}>Web URL</h3>
              <p className={styles.cardDescription}>
                Add content from X, Reddit, LinkedIn, or any web page
              </p>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleUrlSubmit} className={styles.form}>
              <Input
                placeholder="https://x.com/user/status/..."
                value={webUrl}
                onChange={(e) => setWebUrl(e.target.value)}
                disabled={urlMutation.isPending}
              />

              <Button
                type="submit"
                disabled={!webUrl.trim() || urlMutation.isPending}
                loading={urlMutation.isPending}
              >
                {urlMutation.isPending ? 'Adding...' : 'Add URL'}
              </Button>
            </form>

            {urlMutation.isSuccess && (
              <div className={styles.successToast}>
                <CheckCircle size={16} />
                <span>Successfully added to knowledge base</span>
              </div>
            )}

            {urlMutation.isError && (
              <div className={styles.errorToast}>
                <AlertCircle size={16} />
                <span>{urlMutation.error instanceof Error ? urlMutation.error.message : 'Failed to add URL'}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tips Section */}
        <section className={styles.tipsSection}>
          <button
            className={styles.tipsToggle}
            onClick={() => setShowTips(!showTips)}
          >
            <span className={styles.tipsTitle}>Tips & Best Practices</span>
            <ChevronDown
              size={20}
              className={`${styles.tipsIcon} ${showTips ? styles.tipsIconOpen : ''}`}
            />
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
    </div>
  );
}
