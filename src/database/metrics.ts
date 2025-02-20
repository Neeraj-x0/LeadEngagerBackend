import { Types } from "mongoose";
import { LeadModel, MessageModel, ReplyModel } from "../models";

interface DateRange {
    startDate: Date;
    endDate: Date;
}

interface PeriodMetrics {
    responseRate: number;      // in percentage (%)
    avgResponseTime: number;   // in minutes
    conversionRate: number;    // in percentage (%)
}

interface PerformanceMetric {
    responseRate: { value: string; change: string };
    avgResponseTime: { value: string; change: string };
    conversionRate: { value: string; change: string };
}

/**
 * Calculates performance metrics for a given user by comparing the current week
 * (Monday to Sunday) with the previous week. It computes metrics by aggregating data
 * from Message, Reply, and Lead models.
 *
 * Metrics computed:
 * - Response Rate: (Messages with replies / Total messages) * 100
 * - Avg Response Time: Average time (in minutes) from message sent to first reply.
 *   Negative response times (if any due to data inconsistency) are filtered out.
 * - Conversion Rate: (Converted leads / Total leads) * 100
 *
 * The change percentage is calculated as:
 *    ((currentMetric - previousMetric) / previousMetric) * 100
 * If the previous metric is 0, the change is shown as "N/A".
 *
 * The final output is an array of objects with a label, value, and change.
 *
 * Example output:
 {responseRate :{value: 83.5, change: 12.5}, avgResponseTime: {value: 7, change: -15.3}, conversionRate: {value: 24.8, change: 3.7}}
 */
const calculatePerformanceMetrics = async (
    userId: Types.ObjectId
): Promise<PerformanceMetric> => {
    try {
        // Get week date ranges for current and previous weeks.
        const { current, previous } = getWeekDateRanges();

        // Get period metrics for current and previous weeks.
        const currentMetrics = await calculatePeriodMetrics(userId, current);
        const previousMetrics = await calculatePeriodMetrics(userId, previous);

        // Calculate percentage changes.
        const responseRateChange = calculatePercentageChange(currentMetrics.responseRate, previousMetrics.responseRate);
        const responseTimeChange = calculatePercentageChange(currentMetrics.avgResponseTime, previousMetrics.avgResponseTime);
        const conversionRateChange = calculatePercentageChange(currentMetrics.conversionRate, previousMetrics.conversionRate);

        // Build the final metrics array.
        const metrics: PerformanceMetric = {
            responseRate: {
                value: currentMetrics.responseRate.toFixed(1),
                change: formatChange(responseRateChange)
            },
            avgResponseTime: {
                value: currentMetrics.avgResponseTime.toFixed(1),
                change: formatChange(responseTimeChange)
            },
            conversionRate: {
                value: currentMetrics.conversionRate.toFixed(1),
                change: formatChange(conversionRateChange)
            }
        };


        return metrics;
    } catch (error) {
        console.error("Error calculating performance metrics:", error);
        throw error;
    }
};

/**
 * Aggregates metrics for a specific time period using MessageModel (with Replies)
 * and LeadModel.
 */
const calculatePeriodMetrics = async (
    userId: Types.ObjectId,
    dateRange: DateRange
): Promise<PeriodMetrics> => {
    // Aggregate Message data along with joined Replies.
    const messageStats = await MessageModel.aggregate([
        {
            $match: {
                user: userId,
                timestamp: { $gte: dateRange.startDate, $lte: dateRange.endDate }
            }
        },
        {
            $lookup: {
                from: "replies",
                localField: "_id",
                foreignField: "messageID",
                as: "replies"
            }
        },
        {
            $group: {
                _id: null,
                totalMessages: { $sum: 1 },
                messagesWithReplies: {
                    $sum: {
                        $cond: [{ $gt: [{ $size: "$replies" }, 0] }, 1, 0]
                    }
                },
                // Gather response times (in minutes) for messages with at least one reply.
                responseTimes: {
                    $push: {
                        $cond: [
                            { $gt: [{ $size: "$replies" }, 0] },
                            {
                                $divide: [
                                    { $subtract: [{ $arrayElemAt: ["$replies.replyDate", 0] }, "$timestamp"] },
                                    60000
                                ]
                            },
                            null
                        ]
                    }
                }
            }
        }
    ]);

    // Compute message-related metrics.
    const messageData = messageStats[0] || { totalMessages: 0, messagesWithReplies: 0, responseTimes: [] };
    const validResponseTimes = (messageData.responseTimes || [])
        .filter((t: number | null) => t !== null && t >= 0); // ignore negative response times
    const avgResponseTime =
        validResponseTimes.length > 0
            ? validResponseTimes.reduce((a: number, b: number) => a + b, 0) / validResponseTimes.length
            : 0;
    const responseRate = messageData.totalMessages > 0
        ? (messageData.messagesWithReplies / messageData.totalMessages) * 100
        : 0;

    // Aggregate Lead data.
    const leadStats = await LeadModel.aggregate([
        {
            $match: {
                user: userId,
                createdAt: { $gte: dateRange.startDate, $lte: dateRange.endDate } // assuming leads have a createdAt field
            }
        },
        {
            $group: {
                _id: null,
                totalLeads: { $sum: 1 },
                convertedLeads: {
                    $sum: { $cond: [{ $eq: ["$status", "converted"] }, 1, 0] }
                }
            }
        }
    ]);

    const leadData = leadStats[0] || { totalLeads: 0, convertedLeads: 0 };
    const conversionRate = leadData.totalLeads > 0
        ? (leadData.convertedLeads / leadData.totalLeads) * 100
        : 0;

    return {
        responseRate,
        avgResponseTime,
        conversionRate
    };
};

/**
 * Helper function to calculate percentage change.
 * Returns change as a percentage (can be negative or positive).
 * If previous value is 0, returns null.
 */
const calculatePercentageChange = (current: number, previous: number): number | null => {
    if (previous === 0) return null;
    return ((current - previous) / previous) * 100;
};

/**
 * Formats the change value.
 * If change is null, returns "N/A".
 * Otherwise, returns a formatted string with a + sign if positive.
 */
const formatChange = (change: number | null): string => {
    if (change === null) return "N/A";
    const sign = change >= 0 ? "+" : "";
    return `${sign}${change.toFixed(1)}%`;
};


/**
 * Returns week ranges for "current" week and "previous" week.
 * Weeks are considered from Monday (start) to Sunday (end).
 */
const getWeekDateRanges = (): { current: DateRange; previous: DateRange } => {
    const now = new Date();
    const dayOfWeek = now.getDay(); // Sunday: 0, Monday: 1, ... Saturday: 6
    // Adjust so that Monday is treated as first day. (If Sunday, treat as day 7)
    const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

    // Current week: Monday to Sunday.
    const currentMonday = new Date(now);
    currentMonday.setHours(0, 0, 0, 0);
    currentMonday.setDate(now.getDate() - daysSinceMonday);
    const currentSunday = new Date(currentMonday);
    currentSunday.setDate(currentMonday.getDate() + 6);
    currentSunday.setHours(23, 59, 59, 999);

    // Previous week is 7 days before current week.
    const previousMonday = new Date(currentMonday);
    previousMonday.setDate(currentMonday.getDate() - 7);
    const previousSunday = new Date(currentSunday);
    previousSunday.setDate(currentSunday.getDate() - 7);

    return {
        current: { startDate: currentMonday, endDate: currentSunday },
        previous: { startDate: previousMonday, endDate: previousSunday }
    };
};

export { calculatePerformanceMetrics };