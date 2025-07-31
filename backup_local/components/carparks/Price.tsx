import * as React from 'react';
import { derivePrice } from '../../utils/format';

export function Price({ row }: { row: any }) {
  const { label } = derivePrice(row);
  return <span>{label}</span>;
}