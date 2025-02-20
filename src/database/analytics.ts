import { Types, PipelineStage, mongo } from 'mongoose';
import { LeadModel, MessageModel, ReplyModel } from '../models';
import {
  LeanMessage,
  LeanReply,
  DailyEngagement,
  LeadAggregationResult,
  GetEngagementData,
  GetWeeklyEngagementData,
  MongoId
} from './types';

const getEngagementData: GetEngagementData = async (
  userId: MongoId,
  startDate: Date,
  endDate: Date
): Promise<DailyEngagement[]> => {
  try {
    const { startOfDay: periodStart } = getDateBounds(startDate);
    const { endOfDay: periodEnd } = getDateBounds(endDate);

    // Explicitly type the pipeline stages
    const pipeline: PipelineStage[] = [
      {
        $match: {
          user: typeof userId === 'string' ? new Types.ObjectId(userId) : userId,
          createdAt: {
            $gte: periodStart,
            $lte: periodEnd
          }
        }
      } as PipelineStage,
      {
        $group: {
          _id: {
            $dateToString: {
              format: "%Y-%m-%d",
              date: "$createdAt"
            }
          },
          newLeads: { $sum: 1 },
          leadIds: { $push: "$_id" }
        }
      } as PipelineStage,
      {
        $sort: {
          "_id": 1
        }
      } as PipelineStage
    ];

    const leadsPerDay = await LeadModel.aggregate<LeadAggregationResult>(pipeline);

    const processedData = await Promise.all(leadsPerDay.map(async (dayData: { leadIds: any; _id: string | number | Date; newLeads: number; }) => {
      const messages = await MessageModel.find({
        leadId: { $in: dayData.leadIds },
        messageSent: true
      }).lean();

      const replies = await ReplyModel.find({
        lead: { $in: dayData.leadIds },
        reply: true
      }).lean();

      const engagedLeads = new Set(messages.filter(m => m.leadId).map(m => m.leadId!.toString())).size;
      const convertedLeads = new Set(replies.map((r: { lead: { toString: () => any; }; }) => r.lead?.toString())).size;

      return {
        day: new Date(dayData._id).toLocaleDateString('en-US', { weekday: 'short' }),
        "New Leads": dayData.newLeads,
        "Engaged": engagedLeads,
        "Converted": convertedLeads,
        rate: dayData.newLeads > 0 
          ? parseFloat(((convertedLeads / dayData.newLeads) * 100).toFixed(1)) 
          : 0
      };
    }));

    return fillMissingDays(processedData, startDate, endDate);
  } catch (error) {
    console.error('Error in getEngagementData:', error);
    throw error;
  }
};

// Helper functions remain the same...
const getDateBounds = (date: Date) => {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);
  
  return { startOfDay, endOfDay };
};

const fillMissingDays = (data: DailyEngagement[], startDate: Date, endDate: Date): DailyEngagement[] => {
  const result: DailyEngagement[] = [];
  const current = new Date(startDate);
  
  while (current <= endDate) {
    const dayName = current.toLocaleDateString('en-US', { weekday: 'short' });
    const existingDay = data.find(d => d.day === dayName);
    
    if (existingDay) {
      result.push(existingDay);
    } else {
      result.push({
        day: dayName,
        "New Leads": 0,
        Engaged: 0,
        Converted: 0,
        rate: 0
      });
    }
    
    current.setDate(current.getDate() + 1);
  }
  
  return result;
};


const getWeeklyEngagementData: GetWeeklyEngagementData = async (
  userId: MongoId
): Promise<DailyEngagement[]> => {
  // Calculate dates in user's timezone
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 6); // Get last 7 days including today
  
  // Debug: Log the date range
  console.log('Weekly date range:', {
    start: startDate.toISOString(),
    end: endDate.toISOString()
  });

  return await getEngagementData(userId, startDate, endDate);
};


interface DateRange {
  startDate: Date;
  endDate: Date;
}

interface PerformanceMetric {
  responseRate: {
    value: string;
    change: string;
  };
  avgResponseTime: {
    value: string;
    change: string;
  };
  conversionRate: {
    value: string;
    change: string;
  };
}

const calculatePerformanceMetrics = async (
  userId: Types.ObjectId,
  currentRange: DateRange,
  previousRange: DateRange
): Promise<PerformanceMetric> => {
  try {
    // First, let's calculate current period metrics...
    const currentMetrics = await calculatePeriodMetrics(userId, currentRange);
    const previousMetrics = await calculatePeriodMetrics(userId, previousRange);

    // Calculate percentage changes
    const responseRateChange = calculatePercentageChange(
      currentMetrics.responseRate,
      previousMetrics.responseRate
    );

    const responseTimeChange = calculatePercentageChange(
      currentMetrics.avgResponseTime,
      previousMetrics.avgResponseTime
    );

    const conversionRateChange = calculatePercentageChange(
      currentMetrics.conversionRate,
      previousMetrics.conversionRate
    );

    // return [
    //   {
    //     label: "Response Rate",
    //     value: `${currentMetrics.responseRate.toFixed(1)}%`,
    //     change: formatChange(responseRateChange),
    //   },
    //   {
    //     label: "Avg Response Time",
    //     value: `${Math.round(currentMetrics.avgResponseTime)} min`,
    //     change: formatChange(responseTimeChange),
    //   },
    //   {
    //     label: "Conversion Rate",
    //     value: `${currentMetrics.conversionRate.toFixed(1)}%`,
    //     change: formatChange(conversionRateChange),
    //   },
    // ];


    return {
    responseRate:{
      value : `${currentMetrics.responseRate.toFixed(1)}%`,
      change: formatChange(responseRateChange)
    },
    avgResponseTime:{
     value: `${Math.round(currentMetrics.avgResponseTime)} min`,
      change: formatChange(responseTimeChange)
    },
    conversionRate:{
      value: `${currentMetrics.conversionRate.toFixed(1)}%`,
      change: formatChange(conversionRateChange)
      }}
  } catch (error) {
    console.error('Error calculating performance metrics:', error);
    throw error;
  }
};

const calculatePeriodMetrics = async (userId: Types.ObjectId, dateRange: DateRange) => {
  // Calculate Response Rate
  const messageStats = await MessageModel.aggregate([
    {
      $match: {
        user: userId,
        timestamp: { $gte: dateRange.startDate, $lte: dateRange.endDate }
      }
    },
    {
      $lookup: {
        from: 'replies',
        localField: '_id',
        foreignField: 'messageID',
        as: 'replies'
      }
    },
    {
      $group: {
        _id: null,
        totalMessages: { $sum: 1 },
        messagesWithReplies: {
          $sum: {
            $cond: [{ $gt: [{ $size: '$replies' }, 0] }, 1, 0]
          }
        },
        // Calculate response times for messages with replies
        responseTimes: {
          $push: {
            $cond: [
              { $gt: [{ $size: '$replies' }, 0] },
              {
                $divide: [
                  {
                    $subtract: [
                      { $arrayElemAt: ['$replies.replyDate', 0] },
                      '$timestamp'
                    ]
                  },
                  60000 // Convert to minutes
                ]
              },
              null
            ]
          }
        }
      }
    }
  ]);

  // Calculate Conversion Rate
  const conversionStats = await LeadModel.aggregate([
    {
      $match: {
        user: userId,
        createdAt: { $gte: dateRange.startDate, $lte: dateRange.endDate }
      }
    },
    {
      $group: {
        _id: null,
        totalLeads: { $sum: 1 },
        convertedLeads: {
          $sum: {
            $cond: [{ $eq: ['$status', 'converted'] }, 1, 0]
          }
        }
      }
    }
  ]);

  const stats = messageStats[0] || { totalMessages: 0, messagesWithReplies: 0, responseTimes: [] };
  const conversions = conversionStats[0] || { totalLeads: 0, convertedLeads: 0 };

  // Calculate average response time (excluding nulls)
  const validResponseTimes = stats.responseTimes.filter((time: null) => time !== null);
  const avgResponseTime = validResponseTimes.length > 0
    ? validResponseTimes.reduce((a: any, b: any) => a + b, 0) / validResponseTimes.length
    : 0;

  return {
    responseRate: (stats.messagesWithReplies / stats.totalMessages) * 100 || 0,
    avgResponseTime: avgResponseTime || 0,
    conversionRate: (conversions.convertedLeads / conversions.totalLeads) * 100 || 0
  };
};

const calculatePercentageChange = (current: number, previous: number): number => {
  if (previous === 0) return 0;
  return ((current - previous) / previous) * 100;
};

const formatChange = (change: number): string => {
  return `${change >= 0 ? '+' : ''}${change.toFixed(1)}%`;
};

// Helper to get date ranges
const getDateRanges = (days: number): { current: DateRange; previous: DateRange } => {
  const now = new Date();
  const currentEnd = new Date(now);
  const currentStart = new Date(now);
  currentStart.setDate(currentStart.getDate() - days);

  const previousEnd = new Date(currentStart);
  const previousStart = new Date(previousEnd);
  previousStart.setDate(previousStart.getDate() - days);

  return {
    current: { startDate: currentStart, endDate: currentEnd },
    previous: { startDate: previousStart, endDate: previousEnd }
  };
};




export { getEngagementData, GetWeeklyEngagementData, getWeeklyEngagementData ,calculatePerformanceMetrics, getDateRanges };