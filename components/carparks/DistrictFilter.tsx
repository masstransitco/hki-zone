import * as React from 'react';
import { DISTRICT_LABELS } from '../../utils/format';
import { ChevronDown } from 'lucide-react';
import { useLanguage } from '../language-provider';

type DistrictKey = 'ALL' | 'HKI' | 'KOWLOON' | 'NT';

export interface DistrictFilterProps {
  value: DistrictKey;
  onChange: (v: DistrictKey) => void;
  counts?: Partial<Record<DistrictKey, number>>;
}

const DISTRICT_KEYS: DistrictKey[] = ['ALL', 'HKI', 'KOWLOON', 'NT'];

export const DistrictFilter: React.FC<DistrictFilterProps> = ({ value, onChange, counts }) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);
  const { t } = useLanguage();
  
  // Get display label for current value
  const getLabel = (key: DistrictKey) => {
    switch (key) {
      case 'ALL':
        return t('parking.allDistricts');
      case 'HKI':
        return t('parking.hongKongIsland');
      case 'KOWLOON':
        return t('parking.kowloon');
      case 'NT':
        return t('parking.newTerritories');
      default:
        return key;
    }
  };
  
  // Close dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  return (
    <div className="relative inline-block" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-neutral-700 dark:text-neutral-300 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-600 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors"
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <span>{getLabel(value)}</span>
        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      
      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-48 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg shadow-lg overflow-hidden z-10">
          {DISTRICT_KEYS.map((k) => {
            const label = getLabel(k);
            const count = counts?.[k];
            const isActive = value === k;
            
            return (
              <button
                key={k}
                type="button"
                onClick={() => {
                  onChange(k);
                  setIsOpen(false);
                }}
                className={`w-full px-4 py-2 text-sm text-left hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors flex items-center justify-between ${
                  isActive ? 'bg-neutral-50 dark:bg-neutral-700 font-medium' : ''
                }`}
              >
                <span className={isActive ? 'text-neutral-900 dark:text-neutral-100' : 'text-neutral-700 dark:text-neutral-300'}>
                  {label}
                </span>
                {typeof count === 'number' && (
                  <span className="text-xs text-neutral-500 dark:text-neutral-400">
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};