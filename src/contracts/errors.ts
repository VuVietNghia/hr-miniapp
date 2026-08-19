export class ContractError extends Error {
  public constructor(
    public readonly errorCode: string,
    message: string,
    public readonly status = 400,
  ) {
    super(message);
    this.name = 'ContractError';
  }
}
