import { ReminderModel } from '../models/Reminder';
import mongoose from 'mongoose';

export async function getTodayReminderTitles(userId: string): Promise<string[]> {
  try {
    // Validate user ID
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw new Error('Invalid user ID');
    }

    // Get today's start and end dates in UTC
    const today = new Date();
    const startOfDay = new Date(Date.UTC(
      today.getUTCFullYear(),
      today.getUTCMonth(),
      today.getUTCDate(),
      0, 0, 0, 0
    ));
    
    const endOfDay = new Date(Date.UTC(
      today.getUTCFullYear(),
      today.getUTCMonth(),
      today.getUTCDate(),
      23, 59, 59, 999
    ));

    // Query for reminders
    const reminders = await ReminderModel.find({
      user: userId,
      scheduledAt: {
        $gte: startOfDay,
        $lte: endOfDay
      },
      notificationSent: false
    })
    .select('title')  // Only select the title field
    .lean();  // Convert to plain JavaScript objects

    // Extract and return titles
    return reminders.map(reminder => reminder.title);
  } catch (error) {
    console.error('Error fetching reminder titles:', error);
    throw error;
  }
}
