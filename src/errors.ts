export class TierNotFoundError extends Error {
  constructor(tierId: string) {
    super(`No such seat tier: "${tierId}"`);
    this.name = 'TierNotFoundError';
  }
}

export class SoldOutError extends Error {
  constructor(tierName: string, requested: number, available: number) {
    super(
      `"${tierName}" is sold out for the requested quantity: asked for ${requested}, only ${available} left.`
    );
    this.name = 'SoldOutError';
  }
}

export class InvalidRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidRequestError';
  }
}
