'use client';

import styles from './PublicResultPage.module.css';

export function ShareButton() {
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(window.location.href);
      }}
      className={styles.shareButton}
    >
      Copy Link
    </button>
  );
}
