import { MigrationInterface, QueryRunner } from 'typeorm';

export class CourseVideoResourceType1784600000001 implements MigrationInterface {
  name = 'CourseVideoResourceType1784600000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('course_videos');
    if (!table) return;

    if (!table.findColumnByName('resourceType')) {
      await queryRunner.query(
        `ALTER TABLE \`course_videos\` ADD \`resourceType\` varchar(20) NOT NULL DEFAULT 'video'`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('course_videos');
    if (!table) return;

    if (table.findColumnByName('resourceType')) {
      await queryRunner.query(
        `ALTER TABLE \`course_videos\` DROP COLUMN \`resourceType\``,
      );
    }
  }
}
