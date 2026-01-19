import { TYPE_METADATA, type CodingStyleType } from '@/lib/models/coding-style';
import styles from './TypeShowcase.module.css';

const typeOrder: CodingStyleType[] = [
  'architect',
  'scientist',
  'collaborator',
  'speedrunner',
  'craftsman',
];

const shortTaglines: Record<CodingStyleType, string> = {
  architect: 'Plans before coding',
  scientist: 'Verifies everything',
  collaborator: 'Iterates through dialogue',
  speedrunner: 'Ships fast, fixes later',
  craftsman: 'Quality over speed',
};

export function TypeShowcase() {
  return (
    <section className={styles.section}>
      <h2 className={styles.headline}>
        5 Coding Styles. Yours is unique.
      </h2>

      <div className={styles.grid}>
        {typeOrder.map((type) => {
          const meta = TYPE_METADATA[type];
          return (
            <div key={type} className={styles.card}>
              <span className={styles.emoji}>{meta.emoji}</span>
              <h3 className={styles.name}>{meta.name}</h3>
              <p className={styles.tagline}>{shortTaglines[type]}</p>
            </div>
          );
        })}
      </div>

      <p className={styles.note}>
        Most developers are a mix. See your full distribution.
      </p>
    </section>
  );
}
