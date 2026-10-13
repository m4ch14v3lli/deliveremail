export type CallOutcomeStatus = 
  | 'pending' 
  | 'interested' 
  | 'not_interested' 
  | 'waiting' 
  | 'meeting_booked'
  | 'disqualified';

export interface CallerSession {
  callerKey: string;
  name: string;
  email?: string;
  token?: string;
}

export interface CallerLead {
  id: number;
  callerKey: string;
  callerName: string;
  domain: string;
  phone?: string | null;
  companyName: string | null;
  grade: string | null;
  score: number | null;
  status: CallOutcomeStatus | string;
  notes: string | null;
  resultData?: any;
  batchId?: string;
  assignedAt?: string;
  updatedAt?: string;
}

export interface CallerStats {
  total: number;
  pending: number;
  called: number;
  interested: number;
  waiting: number;
  meetingBooked: number;
  notInterested: number;
}
