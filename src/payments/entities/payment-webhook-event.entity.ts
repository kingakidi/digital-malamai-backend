import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

@Entity('payment_webhook_events')
@Unique(['webhookEventId'])
export class PaymentWebhookEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  webhookEventId: string;

  @Column({ type: 'varchar', nullable: true })
  eventType: string | null;

  @Column({ type: 'varchar', nullable: true })
  eventStatus: string | null;

  @Column({ type: 'varchar', nullable: true })
  externalTransactionId: string | null;

  @Column({ type: 'varchar', nullable: true })
  txRef: string | null;

  @Column({ type: 'json' })
  rawPayload: Record<string, unknown>;

  @Column({ type: 'json', nullable: true })
  processingResult: Record<string, unknown> | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
