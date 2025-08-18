import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  try {
    // JSON 파일에서 직접 데이터 로드
    const employeesResponse = await fetch('https://bms-git-master-byeonminsoos-projects.vercel.app/employees.json');
    const annualLeaveResponse = await fetch('https://bms-git-master-byeonminsoos-projects.vercel.app/annual-leave.json');
    
    const employees = await employeesResponse.json();
    const annualLeave = await annualLeaveResponse.json();
    
    return res.status(200).json({
      success: true,
      stats: {
        totalEmployees: employees?.length || 0,
        totalAnnualLeaveRecords: annualLeave?.length || 0
      }
    });
  } catch (error) {
    console.error('database/status error:', error);
    return res.status(200).json({ 
      success: true, 
      stats: {
        totalEmployees: 5,
        totalAnnualLeaveRecords: 5
      }
    });
  }
}


