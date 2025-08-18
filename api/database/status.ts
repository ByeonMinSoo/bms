import type { VercelRequest, VercelResponse } from '@vercel/node';
import { simpleVectorDatabase } from '../../src/database/simple-vector-database';

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  try {
    const employees = await simpleVectorDatabase.getAllEmployees();
    const annualLeave = await simpleVectorDatabase.getAllAnnualLeaveRecords();
    return res.status(200).json({
      success: true,
      stats: {
        totalEmployees: employees?.length || 0,
        totalAnnualLeaveRecords: annualLeave?.length || 0
      }
    });
  } catch (error) {
    console.error('database/status error:', error);
    return res.status(200).json({ success: false });
  }
}


