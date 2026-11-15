import { DomainError } from '../errors';

export type DocumentType = 'CPF' | 'CNPJ';

const CNPJ_FIRST_WEIGHTS = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
const CNPJ_SECOND_WEIGHTS = [6, ...CNPJ_FIRST_WEIGHTS];

const hasRepeatedDigitsOnly = (digits: string) => /^(\d)\1+$/.test(digits);

const weightedSum = (digits: string, weights: number[]) =>
  weights.reduce((sum, weight, index) => sum + Number(digits[index]) * weight, 0);

const cpfCheckDigit = (digits: string, length: number) => {
  const weights = Array.from({ length }, (_, index) => length + 1 - index);
  return ((weightedSum(digits, weights) * 10) % 11) % 10;
};

const cnpjCheckDigit = (digits: string, weights: number[]) => {
  const remainder = weightedSum(digits, weights) % 11;
  return remainder < 2 ? 0 : 11 - remainder;
};

const isValidCpf = (digits: string) =>
  !hasRepeatedDigitsOnly(digits) &&
  cpfCheckDigit(digits, 9) === Number(digits[9]) &&
  cpfCheckDigit(digits, 10) === Number(digits[10]);

const isValidCnpj = (digits: string) =>
  !hasRepeatedDigitsOnly(digits) &&
  cnpjCheckDigit(digits, CNPJ_FIRST_WEIGHTS) === Number(digits[12]) &&
  cnpjCheckDigit(digits, CNPJ_SECOND_WEIGHTS) === Number(digits[13]);

export class Document {
  private constructor(
    readonly value: string,
    readonly type: DocumentType,
  ) {}

  static create(raw: string): Document {
    const digits = String(raw ?? '').replace(/\D/g, '');
    if (digits.length === 11 && isValidCpf(digits)) return new Document(digits, 'CPF');
    if (digits.length === 14 && isValidCnpj(digits)) return new Document(digits, 'CNPJ');
    throw new DomainError('Invalid CPF/CNPJ');
  }
}
