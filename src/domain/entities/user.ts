export type Role = 'ADMIN' | 'CUSTOMER';

export class User {
  constructor(
    readonly id: string,
    readonly email: string,
    readonly passwordHash: string,
    readonly role: Role,
  ) {}
}
