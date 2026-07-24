import { MigrationInterface, QueryRunner } from 'typeorm';

export class AccessCodeExportedAt1784300000001 implements MigrationInterface {
  name = 'AccessCodeExportedAt1784300000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('access_codes');
    if (!table?.findColumnByName('exportedAt')) {
      await queryRunner.query(`
        ALTER TABLE \`access_codes\`
        ADD \`exportedAt\` datetime NULL
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('access_codes');
    if (table?.findColumnByName('exportedAt')) {
      await queryRunner.query(`
        ALTER TABLE \`access_codes\`
        DROP COLUMN \`exportedAt\`
      `);
    }
  }
}
