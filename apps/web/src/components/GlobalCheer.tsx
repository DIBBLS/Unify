import { useEffect } from 'react';
import { useCheer } from './Cheer';
import { onCheerEverywhere } from '../lib/cheerBus';

// Shows cheers sent from anywhere (lib/cheerBus) over whatever screen is up.
export default function GlobalCheer() {
  const [node, cheer] = useCheer();
  useEffect(() => onCheerEverywhere((r) => cheer(r.kind, { text: r.text, sub: r.sub })), [cheer]);
  return <>{node}</>;
}
