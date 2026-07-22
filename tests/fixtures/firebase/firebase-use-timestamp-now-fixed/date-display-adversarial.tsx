import { Timestamp } from 'firebase/firestore';

// Adversarial 1: new Date() used for display formatting, not Firestore — should NOT flag
export function formatTimestamp(ts: Timestamp): string {
  return new Date(ts.seconds * 1000).toLocaleDateString();
}

// Adversarial 2: new Date(value) with an argument is a conversion, not a "now" timestamp — should NOT flag
export function fromEpoch(ms: number): Date {
  return new Date(ms);
}
