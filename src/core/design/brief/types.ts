export type DesignConstraintType = "preference" | "requirement" | "reference";
export type CreativeFreedom = "guided" | "balanced" | "creative";

export interface DesignBriefField<T = string | string[] | null> {
  value: T;
  source: "developer" | "not-provided" | "creative-freedom";
  type?: DesignConstraintType; // only for explicit requirements
}

export interface DesignBrief {
  schemaVersion: "1";
  createdAt: string;
  updatedAt: string;
  purpose: DesignBriefField<string | null>;
  audience: DesignBriefField<string | null>;
  visualDirection: DesignBriefField<string[] | null>;
  brandColors: DesignBriefField<string[] | null>;
  desiredFeeling: DesignBriefField<string[] | null>;
  creativeFreedom: CreativeFreedom;
}

export interface DesignBriefAgentOutput {
  schemaVersion: "1";
  configured: boolean;
  creativeFreedom: CreativeFreedom;
  purpose: string | null;
  audience: string | null;
  visualDirection: string[] | null;
  brandColors: string[] | null;
  desiredFeeling: string[] | null;
  constraints: Array<{ field: string; value: unknown; type: DesignConstraintType }>;
  agentInstructions: string;
}
