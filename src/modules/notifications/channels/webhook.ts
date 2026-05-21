// Stub — future outbound webhook implementation

export async function sendWebhook(_url: string, _payload: unknown): Promise<void> {
  // TODO: POST to configured webhook URLs with HMAC signature
  throw new Error('Webhook notifications not yet implemented')
}
