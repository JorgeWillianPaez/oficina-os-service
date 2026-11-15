import { DomainError } from '../errors';

const PLATE_PATTERN = /^[A-Z]{3}\d[A-Z0-9]\d{2}$/;

export class LicensePlate {
  private constructor(readonly value: string) {}

  static create(raw: string): LicensePlate {
    const normalized = String(raw ?? '')
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '');
    if (!PLATE_PATTERN.test(normalized)) throw new DomainError('Invalid license plate');
    return new LicensePlate(normalized);
  }
}
