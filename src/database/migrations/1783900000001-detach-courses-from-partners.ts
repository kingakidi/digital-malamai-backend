import { MigrationInterface, QueryRunner } from 'typeorm';

export class DetachCoursesFromPartners1783900000001
  implements MigrationInterface
{
  name = 'DetachCoursesFromPartners1783900000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('courses');
    if (!table) return;

    const rows: Array<{ name: string }> = await queryRunner.query(`
      SELECT DISTINCT kcu.CONSTRAINT_NAME AS name
      FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu
      INNER JOIN INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS rc
        ON rc.CONSTRAINT_SCHEMA = kcu.CONSTRAINT_SCHEMA
        AND rc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME
        AND rc.TABLE_NAME = kcu.TABLE_NAME
      WHERE kcu.TABLE_SCHEMA = DATABASE()
        AND kcu.TABLE_NAME = 'courses'
        AND kcu.COLUMN_NAME = 'partnerId'
        AND kcu.REFERENCED_TABLE_NAME IS NOT NULL
    `);

    for (const row of rows) {
      if (!row?.name) continue;
      await queryRunner.query(
        `ALTER TABLE \`courses\` DROP FOREIGN KEY \`${row.name}\``,
      );
    }

    if (table.findColumnByName('partnerCommissionValue')) {
      await queryRunner.query(
        `ALTER TABLE \`courses\` DROP COLUMN \`partnerCommissionValue\``,
      );
    }

    if (table.findColumnByName('partnerCommissionType')) {
      await queryRunner.query(
        `ALTER TABLE \`courses\` DROP COLUMN \`partnerCommissionType\``,
      );
    }

    if (table.findColumnByName('partnerId')) {
      await queryRunner.query(`ALTER TABLE \`courses\` DROP COLUMN \`partnerId\``);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('courses');
    if (!table) return;

    if (!table.findColumnByName('partnerId')) {
      await queryRunner.query(
        `ALTER TABLE \`courses\` ADD \`partnerId\` varchar(255) NULL`,
      );
    }

    if (!table.findColumnByName('partnerCommissionType')) {
      await queryRunner.query(
        `ALTER TABLE \`courses\` ADD \`partnerCommissionType\` enum('percentage','fixed') NULL`,
      );
    }

    if (!table.findColumnByName('partnerCommissionValue')) {
      await queryRunner.query(
        `ALTER TABLE \`courses\` ADD \`partnerCommissionValue\` decimal(12,2) NULL`,
      );
    }
  }
}
