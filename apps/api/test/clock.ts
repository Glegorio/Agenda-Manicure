import { Clock } from '../src/clock/clock.js';

/** Relógio de teste: fica parado até `set`/`advance` (sem depender do relógio real). */
export class FixedClock extends Clock {
  private current: Date;

  constructor(start: Date | string) {
    super();
    this.current = new Date(start);
  }

  now(): Date {
    return new Date(this.current);
  }

  set(instant: Date | string): void {
    this.current = new Date(instant);
  }

  advance({ minutes = 0, seconds = 0 }: { minutes?: number; seconds?: number }): void {
    this.current = new Date(this.current.getTime() + (minutes * 60 + seconds) * 1000);
  }
}
