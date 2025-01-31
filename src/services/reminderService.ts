import { ReminderModel } from '../models';
import { sendNotification } from './notificationService';

export async function processReminders() {
  const now = new Date();
  const reminders = await ReminderModel.find({
    scheduledAt: { $lte: now },
    notificationSent: false
  });

  for (const reminder of reminders) {
    await sendNotification({
      leadId: reminder.leadId.toString(),
      title: reminder.title,
      description: reminder.description ?? ''
    });

    reminder.notificationSent = true;
    await reminder.save();
  }
}