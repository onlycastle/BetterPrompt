/**
 * TeamKPTPanel Component
 * Displays a KPT (Keep / Problem / Try) retrospective panel
 * with a 3-column grid layout showing aggregated team items.
 */

'use client';

import { Card, CardContent } from '../ui/Card';
import { pluralizeMembers } from './format-utils';
import type { TeamKPTAggregate, TeamKPTItem } from '../../types/enterprise';
import styles from './TeamKPTPanel.module.css';

export interface TeamKPTPanelProps {
  kpt: TeamKPTAggregate;
}

interface ColumnConfig {
  key: 'keep' | 'problem' | 'tryNext';
  label: string;
  accentClass: string;
}

const COLUMNS: ColumnConfig[] = [
  { key: 'keep', label: 'Keep', accentClass: 'accentGreen' },
  { key: 'problem', label: 'Problem', accentClass: 'accentAmber' },
  { key: 'tryNext', label: 'Try Next', accentClass: 'accentBlue' },
];

function KPTColumn({ config, items }: { config: ColumnConfig; items: TeamKPTItem[] }) {
  return (
    <div className={styles.column}>
      <div className={`${styles.columnHeader} ${styles[config.accentClass]}`}>
        <h3 className={styles.columnTitle}>{config.label}</h3>
      </div>
      {items.length === 0 ? (
        <p className={styles.emptyColumn}>No common items</p>
      ) : (
        <ul className={styles.itemList}>
          {items.map((item, index) => (
            <li key={index} className={styles.item}>
              <span className={styles.itemText}>{item.text}</span>
              <span className={styles.itemMeta}>
                {pluralizeMembers(item.memberCount)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function TeamKPTPanel({ kpt }: TeamKPTPanelProps) {
  return (
    <Card>
      <CardContent>
        <div className={styles.grid}>
          {COLUMNS.map((config) => (
            <KPTColumn key={config.key} config={config} items={kpt[config.key]} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
