import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Fresh-database bootstrap migration.
 * Previous version only ALTERed tables created by DB_SYNCHRONIZE locally.
 * This version CREATE TABLEs so empty production DBs can boot.
 */
export class Schema1783612421651 implements MigrationInterface {
  name = 'Schema1783612421651';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasUsers = await queryRunner.hasTable('users');
    if (hasUsers) {
      // Local/dev DBs created via synchronize — skip CREATE.
      return;
    }

    await queryRunner.query(`
      CREATE TABLE \`roles\` (
        \`id\` varchar(36) NOT NULL,
        \`name\` varchar(255) NOT NULL,
        \`title\` varchar(255) NOT NULL,
        \`permissions\` json NOT NULL,
        \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        UNIQUE INDEX \`IDX_roles_name\` (\`name\`),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB
    `);

    await queryRunner.query(`
      CREATE TABLE \`partners\` (
        \`id\` varchar(36) NOT NULL,
        \`firstName\` varchar(255) NOT NULL,
        \`lastName\` varchar(255) NOT NULL,
        \`email\` varchar(255) NOT NULL,
        \`phoneNumber\` varchar(255) NULL,
        \`address\` varchar(255) NULL,
        \`description\` text NULL,
        \`logoUrl\` varchar(255) NULL,
        \`onboardingFee\` decimal(12,2) NULL,
        \`commissionType\` enum('percentage','fixed') NULL,
        \`commissionValue\` decimal(12,2) NULL,
        \`onboardPercentage\` decimal(5,2) NOT NULL DEFAULT 0,
        \`status\` enum('active','disabled') NOT NULL DEFAULT 'active',
        \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        UNIQUE INDEX \`IDX_partners_email\` (\`email\`),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB
    `);

    await queryRunner.query(`
      CREATE TABLE \`system_settings\` (
        \`id\` varchar(36) NOT NULL,
        \`key\` varchar(255) NOT NULL,
        \`amount\` decimal(12,2) NOT NULL,
        \`currency\` varchar(255) NOT NULL DEFAULT 'NGN',
        \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        UNIQUE INDEX \`IDX_system_settings_key\` (\`key\`),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB
    `);

    await queryRunner.query(`
      CREATE TABLE \`payment_webhook_events\` (
        \`id\` varchar(36) NOT NULL,
        \`webhookEventId\` varchar(255) NOT NULL,
        \`eventType\` varchar(255) NULL,
        \`eventStatus\` varchar(255) NULL,
        \`externalTransactionId\` varchar(255) NULL,
        \`txRef\` varchar(255) NULL,
        \`rawPayload\` json NOT NULL,
        \`processingResult\` json NULL,
        \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        UNIQUE INDEX \`IDX_payment_webhook_events_webhookEventId\` (\`webhookEventId\`),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB
    `);

    await queryRunner.query(`
      CREATE TABLE \`courses\` (
        \`id\` varchar(36) NOT NULL,
        \`slug\` varchar(255) NOT NULL,
        \`title\` varchar(255) NOT NULL,
        \`description\` text NULL,
        \`thumbnailUrl\` varchar(255) NULL,
        \`price\` decimal(12,2) NOT NULL DEFAULT 0,
        \`discount\` decimal(12,2) NOT NULL DEFAULT 0,
        \`isFree\` tinyint NOT NULL DEFAULT 0,
        \`status\` enum('draft','published','disabled') NOT NULL DEFAULT 'draft',
        \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        UNIQUE INDEX \`IDX_courses_slug\` (\`slug\`),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB
    `);

    await queryRunner.query(`
      CREATE TABLE \`users\` (
        \`id\` varchar(36) NOT NULL,
        \`firstName\` varchar(255) NOT NULL,
        \`lastName\` varchar(255) NOT NULL,
        \`email\` varchar(255) NOT NULL,
        \`phone\` varchar(255) NULL,
        \`emailVerifiedAt\` datetime NULL,
        \`phoneVerifiedAt\` datetime NULL,
        \`phoneVerificationSkippedAt\` datetime NULL,
        \`onboardingStatus\` enum('pending','email_verified','phone_verified','verified','onboarded') NULL,
        \`isActive\` tinyint NOT NULL DEFAULT 1,
        \`accountStatus\` enum('active','suspended','disabled') NOT NULL DEFAULT 'active',
        \`mustChangePassword\` tinyint NOT NULL DEFAULT 0,
        \`password\` varchar(255) NULL,
        \`roleId\` varchar(36) NOT NULL,
        \`partnerId\` varchar(36) NULL,
        \`accessCodeId\` varchar(36) NULL,
        \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        UNIQUE INDEX \`IDX_users_email\` (\`email\`),
        UNIQUE INDEX \`IDX_users_phone\` (\`phone\`),
        PRIMARY KEY (\`id\`),
        CONSTRAINT \`FK_users_role\` FOREIGN KEY (\`roleId\`) REFERENCES \`roles\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION,
        CONSTRAINT \`FK_b19cfff51c326508beea260b739\` FOREIGN KEY (\`partnerId\`) REFERENCES \`partners\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION
      ) ENGINE=InnoDB
    `);

    await queryRunner.query(`
      CREATE TABLE \`access_codes\` (
        \`id\` varchar(36) NOT NULL,
        \`partnerId\` varchar(255) NOT NULL,
        \`code\` varchar(6) NOT NULL,
        \`studentId\` varchar(36) NULL,
        \`isUsed\` tinyint NOT NULL DEFAULT 0,
        \`expiresAt\` datetime NULL,
        \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        UNIQUE INDEX \`IDX_access_codes_code_partner\` (\`code\`, \`partnerId\`),
        PRIMARY KEY (\`id\`),
        CONSTRAINT \`FK_access_codes_partner\` FOREIGN KEY (\`partnerId\`) REFERENCES \`partners\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION,
        CONSTRAINT \`FK_f8ad2a563f1257b736507988156\` FOREIGN KEY (\`studentId\`) REFERENCES \`users\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION
      ) ENGINE=InnoDB
    `);

    await queryRunner.query(`
      ALTER TABLE \`users\`
      ADD CONSTRAINT \`FK_4a719258ac59df47ce82ab7337f\`
      FOREIGN KEY (\`accessCodeId\`) REFERENCES \`access_codes\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      CREATE TABLE \`course_videos\` (
        \`id\` varchar(36) NOT NULL,
        \`courseId\` varchar(255) NOT NULL,
        \`title\` varchar(255) NOT NULL,
        \`vimeoUrl\` varchar(255) NOT NULL,
        \`position\` int NOT NULL DEFAULT 0,
        \`duration\` int NULL,
        \`details\` text NULL,
        \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        CONSTRAINT \`FK_course_videos_course\` FOREIGN KEY (\`courseId\`) REFERENCES \`courses\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION
      ) ENGINE=InnoDB
    `);

    await queryRunner.query(`
      CREATE TABLE \`payment_transactions\` (
        \`id\` varchar(36) NOT NULL,
        \`paymentPlatform\` enum('Flutterwave') NOT NULL,
        \`externalTransactionId\` varchar(255) NOT NULL,
        \`txRef\` varchar(255) NULL,
        \`flwRef\` varchar(255) NULL,
        \`paidFor\` enum('onboarding','course') NOT NULL,
        \`userId\` varchar(36) NULL,
        \`partnerId\` varchar(36) NULL,
        \`courseId\` varchar(36) NULL,
        \`amount\` decimal(12,2) NOT NULL,
        \`fees\` decimal(12,2) NOT NULL DEFAULT 0,
        \`partnerCut\` decimal(12,2) NOT NULL DEFAULT 0,
        \`platformCut\` decimal(12,2) NOT NULL DEFAULT 0,
        \`currency\` varchar(255) NOT NULL DEFAULT 'NGN',
        \`status\` enum('pending','success','failed') NOT NULL DEFAULT 'pending',
        \`metadata\` json NULL,
        \`webhookVerified\` tinyint NOT NULL DEFAULT 0,
        \`apiVerified\` tinyint NOT NULL DEFAULT 0,
        \`fulfillmentCompleted\` tinyint NOT NULL DEFAULT 0,
        \`verifiedAt\` datetime NULL,
        \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        UNIQUE INDEX \`IDX_payment_platform_external\` (\`paymentPlatform\`, \`externalTransactionId\`),
        PRIMARY KEY (\`id\`),
        CONSTRAINT \`FK_60b852936ca1e980cce98d977a2\` FOREIGN KEY (\`userId\`) REFERENCES \`users\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION,
        CONSTRAINT \`FK_b0ec6670cf1bb856744d00b4c23\` FOREIGN KEY (\`partnerId\`) REFERENCES \`partners\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION,
        CONSTRAINT \`FK_b8427d4e83b787fba4bb04c0ec5\` FOREIGN KEY (\`courseId\`) REFERENCES \`courses\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION
      ) ENGINE=InnoDB
    `);

    await queryRunner.query(`
      CREATE TABLE \`course_enrollments\` (
        \`id\` varchar(36) NOT NULL,
        \`userId\` varchar(255) NOT NULL,
        \`courseId\` varchar(255) NOT NULL,
        \`paymentTransactionId\` varchar(255) NOT NULL,
        \`enrolledAt\` datetime NOT NULL,
        \`paymentStatus\` enum('pending','success','failed') NOT NULL DEFAULT 'success',
        \`unlockedAt\` datetime NULL,
        \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        UNIQUE INDEX \`IDX_enrollments_user_course\` (\`userId\`, \`courseId\`),
        PRIMARY KEY (\`id\`),
        CONSTRAINT \`FK_enrollments_user\` FOREIGN KEY (\`userId\`) REFERENCES \`users\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION,
        CONSTRAINT \`FK_enrollments_course\` FOREIGN KEY (\`courseId\`) REFERENCES \`courses\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION,
        CONSTRAINT \`FK_enrollments_payment\` FOREIGN KEY (\`paymentTransactionId\`) REFERENCES \`payment_transactions\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION
      ) ENGINE=InnoDB
    `);

    await queryRunner.query(`
      CREATE TABLE \`notifications\` (
        \`id\` varchar(36) NOT NULL,
        \`userId\` varchar(255) NOT NULL,
        \`channel\` enum('email','whatsapp') NOT NULL,
        \`type\` enum('otp','onboarding_receipt','course_delivery','partner_welcome','staff_welcome') NOT NULL,
        \`payload\` json NOT NULL,
        \`status\` enum('pending','sent','failed') NOT NULL DEFAULT 'pending',
        \`sentAt\` datetime NULL,
        \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        CONSTRAINT \`FK_notifications_user\` FOREIGN KEY (\`userId\`) REFERENCES \`users\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION
      ) ENGINE=InnoDB
    `);

    await queryRunner.query(`
      CREATE TABLE \`otps\` (
        \`id\` varchar(36) NOT NULL,
        \`userId\` varchar(255) NOT NULL,
        \`codeHash\` varchar(255) NOT NULL,
        \`channel\` enum('email','phone') NOT NULL,
        \`purpose\` enum('verify_email','verify_phone','password_reset') NOT NULL,
        \`expiresAt\` datetime NOT NULL,
        \`verifiedAt\` datetime NULL,
        \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        CONSTRAINT \`FK_otps_user\` FOREIGN KEY (\`userId\`) REFERENCES \`users\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION
      ) ENGINE=InnoDB
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS \`otps\``);
    await queryRunner.query(`DROP TABLE IF EXISTS \`notifications\``);
    await queryRunner.query(`DROP TABLE IF EXISTS \`course_enrollments\``);
    await queryRunner.query(`DROP TABLE IF EXISTS \`payment_transactions\``);
    await queryRunner.query(`DROP TABLE IF EXISTS \`course_videos\``);
    await queryRunner.query(
      `ALTER TABLE \`users\` DROP FOREIGN KEY \`FK_4a719258ac59df47ce82ab7337f\``,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS \`access_codes\``);
    await queryRunner.query(`DROP TABLE IF EXISTS \`users\``);
    await queryRunner.query(`DROP TABLE IF EXISTS \`courses\``);
    await queryRunner.query(`DROP TABLE IF EXISTS \`payment_webhook_events\``);
    await queryRunner.query(`DROP TABLE IF EXISTS \`system_settings\``);
    await queryRunner.query(`DROP TABLE IF EXISTS \`partners\``);
    await queryRunner.query(`DROP TABLE IF EXISTS \`roles\``);
  }
}
