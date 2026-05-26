export type IndicatorType = 'revenue' | 'fixed_cost' | 'variable_cost';
export type IndicatorSubtype = 'standard' | 'depreciation' | 'interest';

export interface Center {
  id: string;
  name: string;
}

export interface Year {
  value: string; // e.g. "2026"
}

export interface Indicator {
  id: string;
  name: string;
  type: IndicatorType;
  subtype: IndicatorSubtype;
  centerIds: string[]; // Centers this indicator applies to
}

export interface MonthData {
  actual: number;
  budget: number;
}

// Data store format:
// { [centerId]: { [year]: { [indicatorId]: { [month]: { actual: number, budget: number } } } } }
export interface FinancialDataStore {
  [centerId: string]: {
    [year: string]: {
      [indicatorId: string]: {
        [month: number]: MonthData;
      };
    };
  };
}

export interface GeminiAnalysisResponse {
  analysis: string;
  recommendations: string[];
}
