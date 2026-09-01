export type AppStatusTone = 'green' | 'amber' | 'neutral';
export type AppStatusLabel = 'Available' | 'Setup required' | 'Not detected';

export function appStatus(running: boolean, vcamStatus?: string): { label: AppStatusLabel; tone: AppStatusTone } {
  if (vcamStatus === 'available') return { label: 'Available', tone: 'green' };
  if (running) return { label: 'Setup required', tone: 'amber' };
  return { label: 'Not detected', tone: 'neutral' };
}
