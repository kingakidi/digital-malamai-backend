import { MigrationInterface, QueryRunner } from "typeorm";

export class Schema1783612421651 implements MigrationInterface {
    name = 'Schema1783612421651'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX \`FK_f8ad2a563f1257b736507988156\` ON \`access_codes\``);
        await queryRunner.query(`ALTER TABLE \`users\` CHANGE \`phone\` \`phone\` varchar(255) NULL`);
        await queryRunner.query(`ALTER TABLE \`users\` CHANGE \`emailVerifiedAt\` \`emailVerifiedAt\` datetime NULL`);
        await queryRunner.query(`ALTER TABLE \`users\` CHANGE \`phoneVerifiedAt\` \`phoneVerifiedAt\` datetime NULL`);
        await queryRunner.query(`ALTER TABLE \`users\` CHANGE \`phoneVerificationSkippedAt\` \`phoneVerificationSkippedAt\` datetime NULL`);
        await queryRunner.query(`ALTER TABLE \`users\` CHANGE \`onboardingStatus\` \`onboardingStatus\` enum ('pending', 'email_verified', 'phone_verified', 'verified', 'onboarded') NULL`);
        await queryRunner.query(`ALTER TABLE \`users\` CHANGE \`password\` \`password\` varchar(255) NULL`);
        await queryRunner.query(`ALTER TABLE \`users\` CHANGE \`partnerId\` \`partnerId\` varchar(36) NULL`);
        await queryRunner.query(`ALTER TABLE \`users\` CHANGE \`accessCodeId\` \`accessCodeId\` varchar(36) NULL`);
        await queryRunner.query(`ALTER TABLE \`partners\` CHANGE \`phoneNumber\` \`phoneNumber\` varchar(255) NULL`);
        await queryRunner.query(`ALTER TABLE \`partners\` CHANGE \`address\` \`address\` varchar(255) NULL`);
        await queryRunner.query(`ALTER TABLE \`partners\` CHANGE \`description\` \`description\` text NULL`);
        await queryRunner.query(`ALTER TABLE \`partners\` CHANGE \`logoUrl\` \`logoUrl\` varchar(255) NULL`);
        await queryRunner.query(`ALTER TABLE \`partners\` CHANGE \`onboardingFee\` \`onboardingFee\` decimal(12,2) NULL`);
        await queryRunner.query(`ALTER TABLE \`partners\` CHANGE \`commissionType\` \`commissionType\` enum ('percentage', 'fixed') NULL`);
        await queryRunner.query(`ALTER TABLE \`partners\` CHANGE \`commissionValue\` \`commissionValue\` decimal(12,2) NULL`);
        await queryRunner.query(`ALTER TABLE \`access_codes\` CHANGE \`studentId\` \`studentId\` varchar(36) NULL`);
        await queryRunner.query(`ALTER TABLE \`access_codes\` CHANGE \`expiresAt\` \`expiresAt\` datetime NULL`);
        await queryRunner.query(`ALTER TABLE \`course_videos\` CHANGE \`duration\` \`duration\` varchar(255) NULL`);
        await queryRunner.query(`ALTER TABLE \`courses\` CHANGE \`description\` \`description\` text NULL`);
        await queryRunner.query(`ALTER TABLE \`courses\` CHANGE \`thumbnailUrl\` \`thumbnailUrl\` varchar(255) NULL`);
        await queryRunner.query(`ALTER TABLE \`courses\` CHANGE \`partnerCommissionType\` \`partnerCommissionType\` enum ('percentage', 'fixed') NULL`);
        await queryRunner.query(`ALTER TABLE \`courses\` CHANGE \`partnerCommissionValue\` \`partnerCommissionValue\` decimal(12,2) NULL`);
        await queryRunner.query(`ALTER TABLE \`payment_transactions\` CHANGE \`txRef\` \`txRef\` varchar(255) NULL`);
        await queryRunner.query(`ALTER TABLE \`payment_transactions\` CHANGE \`flwRef\` \`flwRef\` varchar(255) NULL`);
        await queryRunner.query(`ALTER TABLE \`payment_transactions\` CHANGE \`partnerId\` \`partnerId\` varchar(36) NULL`);
        await queryRunner.query(`ALTER TABLE \`payment_transactions\` CHANGE \`courseId\` \`courseId\` varchar(36) NULL`);
        await queryRunner.query(`ALTER TABLE \`payment_transactions\` DROP COLUMN \`metadata\``);
        await queryRunner.query(`ALTER TABLE \`payment_transactions\` ADD \`metadata\` json NULL`);
        await queryRunner.query(`ALTER TABLE \`payment_transactions\` CHANGE \`verifiedAt\` \`verifiedAt\` datetime NULL`);
        await queryRunner.query(`ALTER TABLE \`course_enrollments\` CHANGE \`unlockedAt\` \`unlockedAt\` datetime NULL`);
        await queryRunner.query(`ALTER TABLE \`notifications\` CHANGE \`sentAt\` \`sentAt\` datetime NULL`);
        await queryRunner.query(`ALTER TABLE \`otps\` CHANGE \`verifiedAt\` \`verifiedAt\` datetime NULL`);
        await queryRunner.query(`ALTER TABLE \`payment_webhook_events\` CHANGE \`eventType\` \`eventType\` varchar(255) NULL`);
        await queryRunner.query(`ALTER TABLE \`payment_webhook_events\` CHANGE \`eventStatus\` \`eventStatus\` varchar(255) NULL`);
        await queryRunner.query(`ALTER TABLE \`payment_webhook_events\` CHANGE \`externalTransactionId\` \`externalTransactionId\` varchar(255) NULL`);
        await queryRunner.query(`ALTER TABLE \`payment_webhook_events\` CHANGE \`txRef\` \`txRef\` varchar(255) NULL`);
        await queryRunner.query(`ALTER TABLE \`payment_webhook_events\` DROP COLUMN \`processingResult\``);
        await queryRunner.query(`ALTER TABLE \`payment_webhook_events\` ADD \`processingResult\` json NULL`);
        await queryRunner.query(`ALTER TABLE \`users\` ADD CONSTRAINT \`FK_b19cfff51c326508beea260b739\` FOREIGN KEY (\`partnerId\`) REFERENCES \`partners\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`users\` ADD CONSTRAINT \`FK_4a719258ac59df47ce82ab7337f\` FOREIGN KEY (\`accessCodeId\`) REFERENCES \`access_codes\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`access_codes\` ADD CONSTRAINT \`FK_f8ad2a563f1257b736507988156\` FOREIGN KEY (\`studentId\`) REFERENCES \`users\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`payment_transactions\` ADD CONSTRAINT \`FK_b0ec6670cf1bb856744d00b4c23\` FOREIGN KEY (\`partnerId\`) REFERENCES \`partners\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`payment_transactions\` ADD CONSTRAINT \`FK_b8427d4e83b787fba4bb04c0ec5\` FOREIGN KEY (\`courseId\`) REFERENCES \`courses\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`payment_transactions\` DROP FOREIGN KEY \`FK_b8427d4e83b787fba4bb04c0ec5\``);
        await queryRunner.query(`ALTER TABLE \`payment_transactions\` DROP FOREIGN KEY \`FK_b0ec6670cf1bb856744d00b4c23\``);
        await queryRunner.query(`ALTER TABLE \`access_codes\` DROP FOREIGN KEY \`FK_f8ad2a563f1257b736507988156\``);
        await queryRunner.query(`ALTER TABLE \`users\` DROP FOREIGN KEY \`FK_4a719258ac59df47ce82ab7337f\``);
        await queryRunner.query(`ALTER TABLE \`users\` DROP FOREIGN KEY \`FK_b19cfff51c326508beea260b739\``);
        await queryRunner.query(`ALTER TABLE \`payment_webhook_events\` DROP COLUMN \`processingResult\``);
        await queryRunner.query(`ALTER TABLE \`payment_webhook_events\` ADD \`processingResult\` longtext COLLATE "utf8mb4_bin" NULL DEFAULT 'NULL'`);
        await queryRunner.query(`ALTER TABLE \`payment_webhook_events\` CHANGE \`txRef\` \`txRef\` varchar(255) NULL DEFAULT 'NULL'`);
        await queryRunner.query(`ALTER TABLE \`payment_webhook_events\` CHANGE \`externalTransactionId\` \`externalTransactionId\` varchar(255) NULL DEFAULT 'NULL'`);
        await queryRunner.query(`ALTER TABLE \`payment_webhook_events\` CHANGE \`eventStatus\` \`eventStatus\` varchar(255) NULL DEFAULT 'NULL'`);
        await queryRunner.query(`ALTER TABLE \`payment_webhook_events\` CHANGE \`eventType\` \`eventType\` varchar(255) NULL DEFAULT 'NULL'`);
        await queryRunner.query(`ALTER TABLE \`otps\` CHANGE \`verifiedAt\` \`verifiedAt\` datetime NULL DEFAULT 'NULL'`);
        await queryRunner.query(`ALTER TABLE \`notifications\` CHANGE \`sentAt\` \`sentAt\` datetime NULL DEFAULT 'NULL'`);
        await queryRunner.query(`ALTER TABLE \`course_enrollments\` CHANGE \`unlockedAt\` \`unlockedAt\` datetime NULL DEFAULT 'NULL'`);
        await queryRunner.query(`ALTER TABLE \`payment_transactions\` CHANGE \`verifiedAt\` \`verifiedAt\` datetime NULL DEFAULT 'NULL'`);
        await queryRunner.query(`ALTER TABLE \`payment_transactions\` DROP COLUMN \`metadata\``);
        await queryRunner.query(`ALTER TABLE \`payment_transactions\` ADD \`metadata\` longtext COLLATE "utf8mb4_bin" NULL DEFAULT 'NULL'`);
        await queryRunner.query(`ALTER TABLE \`payment_transactions\` CHANGE \`courseId\` \`courseId\` varchar(36) NULL DEFAULT 'NULL'`);
        await queryRunner.query(`ALTER TABLE \`payment_transactions\` CHANGE \`partnerId\` \`partnerId\` varchar(36) NULL DEFAULT 'NULL'`);
        await queryRunner.query(`ALTER TABLE \`payment_transactions\` CHANGE \`flwRef\` \`flwRef\` varchar(255) NULL DEFAULT 'NULL'`);
        await queryRunner.query(`ALTER TABLE \`payment_transactions\` CHANGE \`txRef\` \`txRef\` varchar(255) NULL DEFAULT 'NULL'`);
        await queryRunner.query(`ALTER TABLE \`courses\` CHANGE \`partnerCommissionValue\` \`partnerCommissionValue\` decimal(12,2) NULL DEFAULT 'NULL'`);
        await queryRunner.query(`ALTER TABLE \`courses\` CHANGE \`partnerCommissionType\` \`partnerCommissionType\` enum ('percentage', 'fixed') NULL DEFAULT 'NULL'`);
        await queryRunner.query(`ALTER TABLE \`courses\` CHANGE \`thumbnailUrl\` \`thumbnailUrl\` varchar(255) NULL DEFAULT 'NULL'`);
        await queryRunner.query(`ALTER TABLE \`courses\` CHANGE \`description\` \`description\` text NULL DEFAULT 'NULL'`);
        await queryRunner.query(`ALTER TABLE \`course_videos\` CHANGE \`duration\` \`duration\` varchar(255) NULL DEFAULT 'NULL'`);
        await queryRunner.query(`ALTER TABLE \`access_codes\` CHANGE \`expiresAt\` \`expiresAt\` datetime NULL DEFAULT 'NULL'`);
        await queryRunner.query(`ALTER TABLE \`access_codes\` CHANGE \`studentId\` \`studentId\` varchar(36) NULL DEFAULT 'NULL'`);
        await queryRunner.query(`ALTER TABLE \`partners\` CHANGE \`commissionValue\` \`commissionValue\` decimal(12,2) NULL DEFAULT 'NULL'`);
        await queryRunner.query(`ALTER TABLE \`partners\` CHANGE \`commissionType\` \`commissionType\` enum ('percentage', 'fixed') NULL DEFAULT 'NULL'`);
        await queryRunner.query(`ALTER TABLE \`partners\` CHANGE \`onboardingFee\` \`onboardingFee\` decimal(12,2) NULL DEFAULT 'NULL'`);
        await queryRunner.query(`ALTER TABLE \`partners\` CHANGE \`logoUrl\` \`logoUrl\` varchar(255) NULL DEFAULT 'NULL'`);
        await queryRunner.query(`ALTER TABLE \`partners\` CHANGE \`description\` \`description\` text NULL DEFAULT 'NULL'`);
        await queryRunner.query(`ALTER TABLE \`partners\` CHANGE \`address\` \`address\` varchar(255) NULL DEFAULT 'NULL'`);
        await queryRunner.query(`ALTER TABLE \`partners\` CHANGE \`phoneNumber\` \`phoneNumber\` varchar(255) NULL DEFAULT 'NULL'`);
        await queryRunner.query(`ALTER TABLE \`users\` CHANGE \`accessCodeId\` \`accessCodeId\` varchar(36) NULL DEFAULT 'NULL'`);
        await queryRunner.query(`ALTER TABLE \`users\` CHANGE \`partnerId\` \`partnerId\` varchar(36) NULL DEFAULT 'NULL'`);
        await queryRunner.query(`ALTER TABLE \`users\` CHANGE \`password\` \`password\` varchar(255) NULL DEFAULT 'NULL'`);
        await queryRunner.query(`ALTER TABLE \`users\` CHANGE \`onboardingStatus\` \`onboardingStatus\` enum ('pending', 'email_verified', 'phone_verified', 'verified', 'onboarded') NULL DEFAULT 'NULL'`);
        await queryRunner.query(`ALTER TABLE \`users\` CHANGE \`phoneVerificationSkippedAt\` \`phoneVerificationSkippedAt\` datetime NULL DEFAULT 'NULL'`);
        await queryRunner.query(`ALTER TABLE \`users\` CHANGE \`phoneVerifiedAt\` \`phoneVerifiedAt\` datetime NULL DEFAULT 'NULL'`);
        await queryRunner.query(`ALTER TABLE \`users\` CHANGE \`emailVerifiedAt\` \`emailVerifiedAt\` datetime NULL DEFAULT 'NULL'`);
        await queryRunner.query(`ALTER TABLE \`users\` CHANGE \`phone\` \`phone\` varchar(255) NULL DEFAULT 'NULL'`);
        await queryRunner.query(`CREATE INDEX \`FK_f8ad2a563f1257b736507988156\` ON \`access_codes\` (\`studentId\`)`);
    }

}
