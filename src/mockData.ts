import { Center, Year, Indicator, FinancialDataStore } from "./types";

export const INITIAL_CENTERS: Center[] = [
  { id: "c1", name: "Trung tâm Miền Bắc" },
  { id: "c2", name: "Trung tâm Miền Trung" },
  { id: "c3", name: "Trung tâm Miền Nam" },
];

export const INITIAL_YEARS: Year[] = [
  { value: "2026" },
  { value: "2025" },
];

export const INITIAL_INDICATORS: Indicator[] = [
  { id: "i1", name: "Doanh thu Bán hàng", type: "revenue", subtype: "standard", centerIds: ["c1", "c2", "c3"] },
  { id: "i2", name: "Doanh thu khác", type: "revenue", subtype: "standard", centerIds: ["c1", "c2", "c3"] },
  { id: "i3", name: "Lương nhân viên", type: "fixed_cost", subtype: "standard", centerIds: ["c1", "c2", "c3"] },
  { id: "i4", name: "Tiền thuê văn phòng", type: "fixed_cost", subtype: "standard", centerIds: ["c1", "c2", "c3"] },
  { id: "i5", name: "Khấu hao TSCĐ", type: "fixed_cost", subtype: "depreciation", centerIds: ["c1", "c2", "c3"] },
  { id: "i6", name: "Lãi vay ngân hàng", type: "fixed_cost", subtype: "interest", centerIds: ["c1", "c3"] }, // Miền trung không có lãi vay
  { id: "i7", name: "Marketing", type: "variable_cost", subtype: "standard", centerIds: ["c1", "c2", "c3"] },
];

// Helper to generate mock data
export function generateDefaultFinancialData(): FinancialDataStore {
  const store: FinancialDataStore = {};

  INITIAL_CENTERS.forEach((center) => {
    store[center.id] = {};
    INITIAL_YEARS.forEach((year) => {
      store[center.id][year.value] = {};
      INITIAL_INDICATORS.forEach((indicator) => {
        // Only generate if applied to center
        if (indicator.centerIds.includes(center.id)) {
          store[center.id][year.value][indicator.id] = {};
          
          for (let month = 1; month <= 12; month++) {
            let actual = 0;
            let budget = 0;

            const baseSeed = center.id === "c1" ? 1.2 : center.id === "c2" ? 0.8 : 1.0;
            const seasonalFactor = 1 + Math.sin((month / 12) * Math.PI) * 0.25; // higher in middle of year
            const yearFactor = year.value === "2026" ? 1.15 : 1.0;

            if (indicator.id === "i1") {
              // Doanh thu Bán hàng
              budget = Math.round(450000000 * baseSeed * yearFactor);
              // Actual fluctuates slightly around budget
              const fluctuation = 0.85 + Math.random() * 0.3; // -15% to +15%
              actual = Math.round(budget * fluctuation * seasonalFactor);
            } else if (indicator.id === "i2") {
              // Doanh thu khác
              budget = Math.round(15000000 * baseSeed);
              actual = Math.round(budget * (0.6 + Math.random() * 0.8));
            } else if (indicator.id === "i3") {
              // Lương nhân viên (Fixed)
              budget = Math.round(150000000 * baseSeed * yearFactor);
              actual = budget; // Fixed salary is usually matching budget
            } else if (indicator.id === "i4") {
              // Tiền thuê văn phòng (Fixed)
              budget = center.id === "c1" ? 45000000 : center.id === "c2" ? 30000000 : 40000000;
              actual = budget;
            } else if (indicator.id === "i5") {
              // Khấu hao (Fixed)
              budget = center.id === "c1" ? 22000000 : center.id === "c2" ? 15000000 : 20000000;
              actual = budget;
            } else if (indicator.id === "i6") {
              // Lãi vay ngân hàng (Fixed)
              budget = center.id === "c1" ? 12000000 : 8000000;
              actual = budget;
            } else if (indicator.id === "i7") {
              // Marketing (Variable)
              budget = Math.round(50000000 * baseSeed);
              const actualFactor = month % 2 === 0 ? 0.8 : month % 3 === 0 ? 1.3 : 1.0; // campaign peaks
              actual = Math.round(budget * actualFactor * (0.9 + Math.random() * 0.2));
            }

            store[center.id][year.value][indicator.id][month] = {
              actual: actual,
              budget: budget,
            };
          }
        }
      });
    });
  });

  return store;
}
