export type SplitPreset = string;

export interface CustomSplitPreset {
  id: string;
  name: string;
  participantIds: string[];
}

export interface SquadMember {
  id: string;
  name: string;
  avatarUrl?: string; // Optional avatar
  isActive: boolean;  // Toggled ON or OFF for the current split
}

export interface SplitBreakdown {
  activeMemberCount: number;
  baseSharePerPerson: number;     // e.g., $30.00
  flipObligationPerPerson: number; // e.g., $6.00 (The 20% capture)
  totalHitPerPerson: number;      // e.g., $36.00
}

export interface SplitTransaction {
  id: string;
  timestamp: string;               // ISO string for serialization
  presetUsed: SplitPreset;
  totalBill: number;
  
  // The Squad State at the time of execution
  participants: SquadMember[];
  
  // The Financial Math
  breakdown: SplitBreakdown;
  
  // The User's Personal Hit (What hits their Safe Spend)
  personalDeduction: number;
  personalFlipCaptured: number;
  
  isSettled: boolean;              // Did they actually drop it in the group chat?
}
