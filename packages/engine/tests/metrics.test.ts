import { describe, it, expect } from 'vitest';
import { MetricsCollector } from '../src/MetricsCollector.js';

describe('MetricsCollector', () => {
  it('starts at a clean default snapshot', () => {
    const m = new MetricsCollector();
    const s = m.snapshot();
    expect(s.fps).toBe(0);
    expect(s.processingMs).toBe(0);
    expect(s.droppedFrames).toBe(0);
    expect(s.qualityScale).toBe(1);
  });

  it('tracks dropped frames and quality scale', () => {
    const m = new MetricsCollector();
    m.markDropped();
    m.markDropped();
    m.setQualityScale(0.5);
    const s = m.snapshot();
    expect(s.droppedFrames).toBe(2);
    expect(s.qualityScale).toBe(0.5);
  });

  it('computes averaged processing time over the window', () => {
    const m = new MetricsCollector();
    for (let i = 0; i < 10; i++) m.tickFrame(8);
    const s = m.snapshot();
    expect(s.processingMs).toBeGreaterThanOrEqual(7.9);
    expect(s.processingMs).toBeLessThanOrEqual(8.1);
  });

  it('resets to defaults', () => {
    const m = new MetricsCollector();
    m.markDropped();
    m.setQualityScale(0.25);
    m.reset();
    const s = m.snapshot();
    expect(s.droppedFrames).toBe(0);
    expect(s.qualityScale).toBe(1);
  });
});
