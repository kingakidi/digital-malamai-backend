import { MigrationInterface, QueryRunner } from 'typeorm';

export class CourseVideoDetails1783900000002 implements MigrationInterface {
  name = 'CourseVideoDetails1783900000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('course_videos');
    if (!table) return;

    // Duration is captured in minutes; store it as an integer.
    const durationColumn = table.findColumnByName('duration');
    if (durationColumn && durationColumn.type !== 'int') {
      await queryRunner.query(
        `ALTER TABLE \`course_videos\` MODIFY \`duration\` int NULL`,
      );
    }

    if (!table.findColumnByName('details')) {
      await queryRunner.query(
        `ALTER TABLE \`course_videos\` ADD \`details\` text NULL`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('course_videos');
    if (!table) return;

    if (table.findColumnByName('details')) {
      await queryRunner.query(
        `ALTER TABLE \`course_videos\` DROP COLUMN \`details\``,
      );
    }

    const durationColumn = table.findColumnByName('duration');
    if (durationColumn && durationColumn.type === 'int') {
      await queryRunner.query(
        `ALTER TABLE \`course_videos\` MODIFY \`duration\` varchar(255) NULL`,
      );
    }
  }
}
