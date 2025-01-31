export async function sendNotification(data: {
  leadId: string;
  title: string;
  description?: string;
}) {
  // Implement actual notification logic 
  // (WhatsApp, Email, SMS integration)
  console.log('Sending notification:', data);
}