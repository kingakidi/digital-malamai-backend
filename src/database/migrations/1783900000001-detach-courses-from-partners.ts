import { MigrationInterface, QueryRunner } from 'typeorm';

export class DetachCoursesFromPartners1783900000001
  implements MigrationInterface
{
  name = 'DetachCoursesFromPartners1783900000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('courses');
    if (!table) return;

    const partnerFk = table.foreignKeys.find((fk) =>
      fk.columnNames.includes('partnerId'),
    );
    if (partnerFk) {
      await queryRunner.dropForeignKey('courses', partnerFk);
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
