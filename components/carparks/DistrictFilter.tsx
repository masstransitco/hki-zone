import * as React from 'react';
import { DISTRICT_LABELS } from '../../utils/format';

type DistrictKey = 'ALL' | 'HKI' | 'KOWLOON' | 'NT';

export interface DistrictFilterProps {
  value: DistrictKey;
  onChange: (v: DistrictKey) => void;
  counts?: Partial<Record<DistrictKey, number>>;
}

const DISTRICT_KEYS: DistrictKey[] = ['ALL', 'HKI', 'KOWLOON', 'NT'];

export const DistrictFilter: React.FC<DistrictFilterProps> = ({ value, onChange, counts }) => {
  return (
    <div className="flex flex-wrap gap-2">
      {DISTRICT_KEYS.map((k) => {
        const active = value === k;
        const label = k === 'ALL' ? 'All' : DISTRICT_LABELS[k] ?? k;
        const count = counts?.[k];
        return (
          <button
            key={k}
            type="button"
            onClick={() => onChange(k)}
            className={[
              'px-3 py-1 rounded-full border text-sm transition-colors',
              active
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border-neutral-300 dark:border-neutral-600 hover:bg-neutral-100 dark:hover:bg-neutral-700',
            ].join(' ')}
          >
            {label}
            {typeof count === 'number' && (
              <span className="ml-1 text-xs opacity-75">({count})</span>
            )}
          </button>
        );
      })}
    </div>
  );
};