export interface WhatsAppProviderAdapter {
  isConfigured(): boolean;
  sendTextMessage(phone: string, body: string): Promise<void>;
}
