export const coreEntities: string[];
export type OperationalBackup = {
  schema_version: number;
  generated_at?: string;
  counts: Record<string, number>;
  entities: Record<string, unknown[]>;
};
export function validateBackup<T extends OperationalBackup>(backup: T): T;
export function decryptBackup(path: string, passphrase: string): Promise<OperationalBackup>;
export function restoreTarget(
  url: string | undefined,
  productionUrl: string | undefined,
  allowProduction?: boolean,
): string;
