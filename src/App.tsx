import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Building2,
  TrendingUp,
  Coins,
  DollarSign,
  Percent,
  Settings,
  Database,
  FileSpreadsheet,
  Plus,
  Trash2,
  ChevronRight,
  ChevronDown,
  CheckCircle2,
  Calendar,
  X,
  Edit2,
  Check,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  HelpCircle,
  GripVertical,
  Download,
  Upload,
  Presentation
} from "lucide-react";
import * as XLSX from "xlsx";
import pptxgen from "pptxgenjs";
import { Center, Year, Indicator, FinancialDataStore, MonthData, IndicatorType } from "./types";
import {
  INITIAL_CENTERS,
  INITIAL_INDICATORS,
  INITIAL_YEARS,
  generateDefaultFinancialData,
} from "./mockData";

export default function App() {
  // --- STATE ---
  const [centers, setCenters] = useState<Center[]>([]);
  const [years, setYears] = useState<Year[]>([]);
  const [indicators, setIndicators] = useState<Indicator[]>([]);
  const [financialData, setFinancialData] = useState<FinancialDataStore>({});

  // Active Selections
  const [selectedCenterId, setSelectedCenterId] = useState<string>("");
  const [selectedYear, setSelectedYear] = useState<string>("");
  const [selectedMonth, setSelectedMonth] = useState<number>(5); // Default to Month 5 (May)
  const [currentTab, setCurrentTab] = useState<"report" | "input" | "config">("report");

  // Notifications
  const [toastMessage, setToastMessage] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);

  // Setup / Entry form additions
  const [newCenterName, setNewCenterName] = useState("");
  const [newYearValue, setNewYearValue] = useState("");
  const [editingCenterId, setEditingCenterId] = useState<string | null>(null);
  const [editingCenterName, setEditingCenterName] = useState("");
  const [editingYearValue, setEditingYearValue] = useState<string | null>(null);
  const [editingYearNewValue, setEditingYearNewValue] = useState("");
  
  // Indicator Creation / Modification State
  const [newIndName, setNewIndName] = useState("");
  const [newIndType, setNewIndType] = useState<"revenue" | "fixed_cost" | "variable_cost">("revenue");
  const [newIndSubtype, setNewIndSubtype] = useState<"standard" | "depreciation" | "interest">("standard");
  const [newIndCenters, setNewIndCenters] = useState<string[]>(INITIAL_CENTERS.map(c => c.id));
  const [editingIndicatorId, setEditingIndicatorId] = useState<string | null>(null);

  // Manual/Input Form data changes
  const [inputValues, setInputValues] = useState<{ [indId: string]: { actual: string; budget: string } }>({});
  const [inputGridType, setInputGridType] = useState<"actual" | "budget">("actual");
  const [draftGrid, setDraftGrid] = useState<{ [indId: string]: { [month: number]: { actual: string; budget: string } } }>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Analysis comments/explanations state
  const [explanations, setExplanations] = useState<{ [key: string]: string }>({});

  // Active Popup Modal indicator state for writing comment
  const [activePopupIndicator, setActivePopupIndicator] = useState<{
    id: string;
    name: string;
    pct: number;
    variance: number;
    isCategory?: boolean;
    categoryKey?: string;
  } | null>(null);
  const [popupCommentText, setPopupCommentText] = useState("");

  // Drag and drop state
  const [draggedIndicatorId, setDraggedIndicatorId] = useState<string | null>(null);
  const [dragOverIndicatorId, setDragOverIndicatorId] = useState<string | null>(null);

  const handleIndicatorDragAndDrop = (draggedId: string, targetId: string) => {
    if (draggedId === targetId) return;

    const draggedIndex = indicators.findIndex((i) => i.id === draggedId);
    const targetIndex = indicators.findIndex((i) => i.id === targetId);

    if (draggedIndex === -1 || targetIndex === -1) return;

    const draggedIndicator = indicators[draggedIndex];
    const targetIndicator = indicators[targetIndex];

    // Ensure dragging is restricted to indicators within the same type for structural logic sanity
    if (draggedIndicator.type !== targetIndicator.type) {
      showToast("Chỉ có thể thay đổi vị trí các chỉ tiêu trong cùng một nhóm!", "error");
      return;
    }

    const updatedIndicators = [...indicators];
    // Remove dragged item
    updatedIndicators.splice(draggedIndex, 1);
    // Find where the target is in the updated array
    const targetNewIndex = updatedIndicators.findIndex((i) => i.id === targetId);
    // Insert before/after
    updatedIndicators.splice(targetNewIndex, 0, draggedIndicator);

    setIndicators(updatedIndicators);
    handleSaveToLocalStorage(centers, years, updatedIndicators, financialData);
    showToast("Đã thay đổi thứ tự vị trí hiển thị thành công!", "success");
  };

  // Helpers for formatting percentage & checking fluctuation (> 10% or < -10%)
  const isFluctuated = (pctValue: number) => {
    return Math.abs(pctValue) > 10;
  };

  const getVariancePercent = (actualYTD: number, budgetYTD: number) => {
    const diff = actualYTD - budgetYTD;
    if (budgetYTD !== 0) {
      return (diff / budgetYTD) * 100;
    }
    if (actualYTD !== 0) {
      return actualYTD > 0 ? 100 : -100;
    }
    return 0;
  };

  const formatPercent = (pctValue: number) => {
    const sign = pctValue >= 0 ? "+" : "";
    return `${sign}${pctValue.toFixed(1).replace(".", ",")}%`;
  };

  // --- INITIALIZATION ---
  useEffect(() => {
    // Load from LocalStorage
    const storedCenters = localStorage.getItem("finance_centers");
    const storedYears = localStorage.getItem("finance_years");
    const storedIndicators = localStorage.getItem("finance_indicators");
    const storedData = localStorage.getItem("finance_data");
    const storedExplanations = localStorage.getItem("finance_explanations");

    if (storedExplanations) {
      try {
        setExplanations(JSON.parse(storedExplanations));
      } catch (e) {
        console.error("Error parsing explanations:", e);
      }
    }

    if (storedCenters && storedYears && storedIndicators && storedData) {
      const c = JSON.parse(storedCenters);
      const y = JSON.parse(storedYears);
      const ind = JSON.parse(storedIndicators);
      const d = JSON.parse(storedData);
      
      setCenters(c);
      setYears(y);
      setIndicators(ind);
      setFinancialData(d);

      setNewIndCenters(c.map((item: Center) => item.id));

      if (c.length > 0) setSelectedCenterId(c[0].id);
      if (y.length > 0) setSelectedYear(y[0].value);
    } else {
      // Initialize with presets
      localStorage.setItem("finance_centers", JSON.stringify(INITIAL_CENTERS));
      localStorage.setItem("finance_years", JSON.stringify(INITIAL_YEARS));
      localStorage.setItem("finance_indicators", JSON.stringify(INITIAL_INDICATORS));
      const defaultData = generateDefaultFinancialData();
      localStorage.setItem("finance_data", JSON.stringify(defaultData));

      setCenters(INITIAL_CENTERS);
      setYears(INITIAL_YEARS);
      setIndicators(INITIAL_INDICATORS);
      setFinancialData(defaultData);

      setNewIndCenters(INITIAL_CENTERS.map((item) => item.id));

      setSelectedCenterId(INITIAL_CENTERS[0].id);
      setSelectedYear(INITIAL_YEARS[0].value);
      showToast("Khởi tạo hệ thống dữ liệu thành công!", "success");
    }
  }, []);

  // Sync state to LocalStorage
  const handleSaveToLocalStorage = (
    updatedCenters: Center[],
    updatedYears: Year[],
    updatedIndicators: Indicator[],
    updatedData: FinancialDataStore,
    updatedExplanations?: { [key: string]: string }
  ) => {
    localStorage.setItem("finance_centers", JSON.stringify(updatedCenters));
    localStorage.setItem("finance_years", JSON.stringify(updatedYears));
    localStorage.setItem("finance_indicators", JSON.stringify(updatedIndicators));
    localStorage.setItem("finance_data", JSON.stringify(updatedData));
    if (updatedExplanations) {
      localStorage.setItem("finance_explanations", JSON.stringify(updatedExplanations));
    }
  };

  // Toast Helper
  const showToast = (text: string, type: "success" | "error" | "info" = "success") => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3000);
  };

  // --- CALCULATIONS FOR KPIs & TABLES ---
  const currentCenter = useMemo(() => {
    return centers.find((c) => c.id === selectedCenterId) || null;
  }, [centers, selectedCenterId]);

  // List of indicators applied to the selected center
  const activeIndicators = useMemo(() => {
    return indicators.filter((ind) => ind.centerIds.includes(selectedCenterId));
  }, [indicators, selectedCenterId]);

  // Split indicators by category
  const revenueIndicators = useMemo(() => activeIndicators.filter(i => i.type === 'revenue'), [activeIndicators]);
  const fixedCostIndicators = useMemo(() => activeIndicators.filter(i => i.type === 'fixed_cost'), [activeIndicators]);
  const variableCostIndicators = useMemo(() => activeIndicators.filter(i => i.type === 'variable_cost'), [activeIndicators]);

  // Main compute engine for monthly and accumulated results of individual indicators
  const computedTableRows = useMemo(() => {
    if (!selectedCenterId || !selectedYear) return [];

    const centerData = financialData[selectedCenterId]?.[selectedYear] || {};

    return activeIndicators.map((ind) => {
      const indData = centerData[ind.id] || {};
      
      // Current Month actual & budget
      const currentMonthData = indData[selectedMonth] || { actual: 0, budget: 0 };
      const actualMonth = currentMonthData.actual;
      const budgetMonth = currentMonthData.budget;

      // YTD (Cumulative) up to selectedMonth
      let actualYTD = 0;
      let budgetYTD = 0;
      for (let m = 1; m <= selectedMonth; m++) {
        const mData = indData[m] || { actual: 0, budget: 0 };
        actualYTD += mData.actual;
        budgetYTD += mData.budget;
      }

      const variance = actualYTD - budgetYTD;
      const variancePercent = getVariancePercent(actualYTD, budgetYTD);

      return {
        id: ind.id,
        name: ind.name,
        type: ind.type,
        subtype: ind.subtype,
        actualMonth,
        budgetMonth,
        actualYTD,
        budgetYTD,
        variance,
        variancePercent,
      };
    });
  }, [activeIndicators, financialData, selectedCenterId, selectedYear, selectedMonth]);

  // Compute metrics for Aggregate Categories (I. Revenue, II. Cost, 1. Fixed, 2. Variable, III. Profit, IV. EBITDA)
  const totals = useMemo(() => {
    const rows = computedTableRows;
    
    const initTotal = () => ({ actualMonth: 0, budgetMonth: 0, actualYTD: 0, budgetYTD: 0 });

    const rev = initTotal();
    const fixed = initTotal();
    const variable = initTotal();
    const depr = initTotal(); // to track for EBITDA
    const interest = initTotal(); // to track for EBITDA

    rows.forEach((r) => {
      if (r.type === "revenue") {
        rev.actualMonth += r.actualMonth;
        rev.budgetMonth += r.budgetMonth;
        rev.actualYTD += r.actualYTD;
        rev.budgetYTD += r.budgetYTD;
      } else if (r.type === "fixed_cost") {
        fixed.actualMonth += r.actualMonth;
        fixed.budgetMonth += r.budgetMonth;
        fixed.actualYTD += r.actualYTD;
        fixed.budgetYTD += r.budgetYTD;

        if (r.subtype === "depreciation") {
          depr.actualMonth += r.actualMonth;
          depr.actualYTD += r.actualYTD;
        } else if (r.subtype === "interest") {
          interest.actualMonth += r.actualMonth;
          interest.actualYTD += r.actualYTD;
        }
      } else if (r.type === "variable_cost") {
        variable.actualMonth += r.actualMonth;
        variable.budgetMonth += r.budgetMonth;
        variable.actualYTD += r.actualYTD;
        variable.budgetYTD += r.budgetYTD;
      }
    });

    const totalCost = {
      actualMonth: fixed.actualMonth + variable.actualMonth,
      budgetMonth: fixed.budgetMonth + variable.budgetMonth,
      actualYTD: fixed.actualYTD + variable.actualYTD,
      budgetYTD: fixed.budgetYTD + variable.budgetYTD,
    };

    const profit = {
      actualMonth: rev.actualMonth - totalCost.actualMonth,
      budgetMonth: rev.budgetMonth - totalCost.budgetMonth,
      actualYTD: rev.actualYTD - totalCost.actualYTD,
      budgetYTD: rev.budgetYTD - totalCost.budgetYTD,
    };

    const ebitda = {
      actualMonth: profit.actualMonth + depr.actualMonth + interest.actualMonth,
      budgetMonth: profit.budgetMonth + depr.actualMonth + interest.actualMonth,
      actualYTD: profit.actualYTD + depr.actualYTD + interest.actualYTD,
      budgetYTD: profit.budgetYTD + depr.actualYTD + interest.actualYTD,
    };

    // Count indicators with poor performances (cost exceeding budget, or revenue missing budget)
    let badIndicatorsCount = 0;
    rows.forEach((r) => {
      if (r.type === "revenue") {
        if (r.actualYTD < r.budgetYTD) badIndicatorsCount++;
      } else {
        if (r.actualYTD > r.budgetYTD) badIndicatorsCount++;
      }
    });

    return {
      revenue: rev,
      fixedCost: fixed,
      variableCost: variable,
      totalCost,
      profit,
      ebitda,
      badIndicatorsCount,
    };
  }, [computedTableRows]);

  // Initializing Data input view with sensible current database states
  useEffect(() => {
    if (!selectedCenterId || !selectedYear) return;
    const centerData = financialData[selectedCenterId]?.[selectedYear] || {};
    
    const initialInputs: { [indId: string]: { actual: string; budget: string } } = {};
    activeIndicators.forEach((ind) => {
      const data = centerData[ind.id]?.[selectedMonth] || { actual: 0, budget: 0 };
      initialInputs[ind.id] = {
        actual: data.actual === 0 ? "0" : data.actual.toString(),
        budget: data.budget === 0 ? "0" : data.budget.toString(),
      };
    });
    setInputValues(initialInputs);
  }, [selectedCenterId, selectedYear, selectedMonth, activeIndicators, financialData]);

  // Format Helper for Currency (VND)
  const formatCurrency = (val: number, isShort = false) => {
    if (isShort) {
      if (Math.abs(val) >= 1000000000) {
        return `${(val / 1000000000).toFixed(2).replace(/\.00$/, "")} tỷ`;
      }
      if (Math.abs(val) >= 1000000) {
        return `${(val / 1000000).toFixed(1).replace(/\.0$/, "")} tr`;
      }
      return val.toLocaleString("vi-VN");
    }
    return val.toLocaleString("vi-VN");
  };

  // Formatting large inputs as typing
  const formatInputLabel = (valString: string) => {
    const num = parseInt(valString, 10);
    if (isNaN(num)) return "";
    return `(${formatCurrency(num, true)})`;
  };

  const formatDraftCellValue = (valString: string) => {
    if (!valString || valString === "0") return "";
    const clean = valString.replace(/[^0-9]/g, "");
    if (!clean) return "";
    const num = parseInt(clean, 10);
    if (isNaN(num)) return "";
    return num.toLocaleString("vi-VN");
  };

  // Helper to fetch fluctuated rows both from individual indicators and category totals
  const getFluctuatedItems = () => {
    const list: Array<{
      id: string;
      name: string;
      variancePercent: number;
      variance: number;
      typeString: string;
      isCategory?: boolean;
    }> = [];

    // Individual Indicators
    computedTableRows.forEach((row) => {
      if (isFluctuated(row.variancePercent)) {
        list.push({
          id: row.id,
          name: row.name,
          variancePercent: row.variancePercent,
          variance: row.variance,
          typeString: row.type === "revenue" ? "Doanh thu" : "Chi phí",
          isCategory: false
        });
      }
    });

    // Parent Categories (exceeding 10% fluctuation)
    const revPct = getVariancePercent(totals.revenue.actualYTD, totals.revenue.budgetYTD);
    if (isFluctuated(revPct)) {
      list.push({
        id: "revenue",
        name: "I. DOANH THU",
        variancePercent: revPct,
        variance: totals.revenue.actualYTD - totals.revenue.budgetYTD,
        typeString: "Tổng hợp Doanh thu",
        isCategory: true
      });
    }

    const costPct = getVariancePercent(totals.totalCost.actualYTD, totals.totalCost.budgetYTD);
    if (isFluctuated(costPct)) {
      list.push({
        id: "cost",
        name: "II. CHI PHÍ",
        variancePercent: costPct,
        variance: totals.totalCost.actualYTD - totals.totalCost.budgetYTD,
        typeString: "Tổng hợp Chi phí",
        isCategory: true
      });
    }

    const fixedPct = getVariancePercent(totals.fixedCost.actualYTD, totals.fixedCost.budgetYTD);
    if (isFluctuated(fixedPct)) {
      list.push({
        id: "fixed_cost",
        name: "1. CHI PHÍ CỐ ĐỊNH",
        variancePercent: fixedPct,
        variance: totals.fixedCost.actualYTD - totals.fixedCost.budgetYTD,
        typeString: "Tổng hợp Định phí",
        isCategory: true
      });
    }

    const varPct = getVariancePercent(totals.variableCost.actualYTD, totals.variableCost.budgetYTD);
    if (isFluctuated(varPct)) {
      list.push({
        id: "variable_cost",
        name: "2. CHI PHÍ BIẾN ĐỔI",
        variancePercent: varPct,
        variance: totals.variableCost.actualYTD - totals.variableCost.budgetYTD,
        typeString: "Tổng hợp Biến phí",
        isCategory: true
      });
    }

    const profitPct = getVariancePercent(totals.profit.actualYTD, totals.profit.budgetYTD);
    if (isFluctuated(profitPct)) {
      list.push({
        id: "profit",
        name: "III. LỢI NHUẬN RÒNG",
        variancePercent: profitPct,
        variance: totals.profit.actualYTD - totals.profit.budgetYTD,
        typeString: "Tổng hợp Lợi nhuận",
        isCategory: true
      });
    }

    const ebitdaPct = getVariancePercent(totals.ebitda.actualYTD, totals.ebitda.budgetYTD);
    if (isFluctuated(ebitdaPct)) {
      list.push({
        id: "ebitda",
        name: "IV. EBITDA",
        variancePercent: ebitdaPct,
        variance: totals.ebitda.actualYTD - totals.ebitda.budgetYTD,
        typeString: "Tổng hợp EBITDA",
        isCategory: true
      });
    }

    return list;
  };

  // Render function for TH-KH (LK) cell - Always neutral dark grey/black as requested by the user
  const renderVarianceCell = (actualYTD: number, budgetYTD: number, isCost: boolean = false) => {
    const diff = actualYTD - budgetYTD;
    return (
      <span className="text-slate-900 font-medium font-sans text-xs">
        {diff >= 0 ? "+" : ""}
        {formatCurrency(diff)}
      </span>
    );
  };

  // Render function for % TH/KH cell - clean text/badge layout
  const renderPercentCell = (actualYTD: number, budgetYTD: number) => {
    const rawPct = getVariancePercent(actualYTD, budgetYTD);
    const isFluc = isFluctuated(rawPct);

    if (isFluc) {
      return (
        <span 
          className="inline-flex items-center px-1.5 py-0.5 rounded text-[10.5px] font-sans font-bold text-red-600 bg-red-50 ring-1 ring-red-200 shadow-3xs"
          title="Biến động lớn (>10%)"
        >
          <span>{formatPercent(rawPct)}</span>
        </span>
      );
    }

    return (
      <span className="font-sans text-xs text-slate-650">
        {formatPercent(rawPct)}
      </span>
    );
  };

  // Render function for Analysis cell (cột Phân tích)
  const renderAnalysisCell = (id: string, name: string, pct: number, variance: number, isCategory = false) => {
    const commentKey = `${selectedCenterId}_${selectedYear}_${selectedMonth}_${id}`;
    const comment = explanations[commentKey];

    const handleEditClick = () => {
      setPopupCommentText(comment || "");
      setActivePopupIndicator({
        id,
        name,
        pct,
        variance,
        isCategory
      });
    };

    return (
      <div className="flex justify-center items-center">
        <button
          onClick={handleEditClick}
          className={`flex items-center justify-center p-1.5 rounded-md border transition-all cursor-pointer shadow-3xs hover:scale-105 ${
            comment
              ? "text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border-emerald-250"
              : "text-slate-500 bg-slate-50 hover:bg-slate-100 border-slate-200"
          }`}
          title={comment ? `Thuyết minh: ${comment}` : "Nhập giải trình/phân tích"}
        >
          <Edit2 className="w-3.5 h-3.5 text-current" />
          {comment && (
            <span className="ml-1 w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
          )}
        </button>
      </div>
    );
  };

  // --- OPERATIONS ACTIONS ---

  // 1. Center Managers
  const handleAddCenter = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCenterName.trim()) return;

    const newId = "c_" + Date.now();
    const updatedCenters = [...centers, { id: newId, name: newCenterName.trim() }];
    
    const updatedStore = { ...financialData };
    updatedStore[newId] = {};
    years.forEach((y) => {
      updatedStore[newId][y.value] = {};
      indicators.forEach((ind) => {
        updatedStore[newId][y.value][ind.id] = {};
        for (let m = 1; m <= 12; m++) {
          updatedStore[newId][y.value][ind.id][m] = { actual: 0, budget: 0 };
        }
      });
    });

    setCenters(updatedCenters);
    setFinancialData(updatedStore);
    setSelectedCenterId(newId);
    setNewCenterName("");
    
    // Default mode: all centers applied
    setNewIndCenters(updatedCenters.map(c => c.id));

    handleSaveToLocalStorage(updatedCenters, years, indicators, updatedStore);
    showToast(`Đã thêm trung tâm: ${newCenterName.trim()}`, "success");
  };

  const handleUpdateCenter = (id: string) => {
    const trimmed = editingCenterName.trim();
    if (!trimmed) {
      showToast("Tên trung tâm không được để trống!", "error");
      return;
    }
    const updatedCenters = centers.map((c) => (c.id === id ? { ...c, name: trimmed } : c));
    setCenters(updatedCenters);
    setEditingCenterId(null);
    setEditingCenterName("");
    
    setNewIndCenters(updatedCenters.map(c => c.id));

    handleSaveToLocalStorage(updatedCenters, years, indicators, financialData);
    showToast(`Đã cập nhật trung tâm thành: ${trimmed}`, "success");
  };

  const handleDeleteCenter = (id: string, name: string) => {
    if (centers.length <= 1) {
      showToast("Không thể xóa trung tâm duy nhất còn lại!", "error");
      return;
    }
    if (!confirm(`Bạn chắc chắn muốn xóa trung tâm "${name}"? Toàn bộ số liệu sẽ bị xóa.`)) return;

    const updatedCenters = centers.filter((c) => c.id !== id);
    const updatedStore = { ...financialData };
    delete updatedStore[id];

    setCenters(updatedCenters);
    setFinancialData(updatedStore);
    if (selectedCenterId === id) {
      setSelectedCenterId(updatedCenters[0].id);
    }
    if (editingCenterId === id) {
      setEditingCenterId(null);
      setEditingCenterName("");
    }
    
    setNewIndCenters(updatedCenters.map(c => c.id));

    handleSaveToLocalStorage(updatedCenters, years, indicators, updatedStore);
    showToast(`Đã xóa trung tâm: ${name}`);
  };

  // 2. Year Managers
  const handleAddYear = (e: React.FormEvent) => {
    e.preventDefault();
    const yr = newYearValue.trim();
    if (!yr || !/^\d{4}$/.test(yr)) {
      showToast("Năm khai báo phải gồm 4 chữ số!", "error");
      return;
    }
    if (years.some((y) => y.value === yr)) {
      showToast("Năm hoạt động này đã tồn tại!", "error");
      return;
    }

    const updatedYears = [...years, { value: yr }].sort((a, b) => b.value.localeCompare(a.value));
    
    const updatedStore = { ...financialData };
    centers.forEach((c) => {
      if (!updatedStore[c.id]) updatedStore[c.id] = {};
      updatedStore[c.id][yr] = {};
      indicators.forEach((ind) => {
        updatedStore[c.id][yr][ind.id] = {};
        for (let m = 1; m <= 12; m++) {
          updatedStore[c.id][yr][ind.id][m] = { actual: 0, budget: 0 };
        }
      });
    });

    setYears(updatedYears);
    setFinancialData(updatedStore);
    setSelectedYear(yr);
    setNewYearValue("");
    handleSaveToLocalStorage(centers, updatedYears, indicators, updatedStore);
    showToast(`Khởi tạo thành công năm tài khóa: ${yr}`);
  };

  const handleUpdateYear = (oldValue: string) => {
    const trimmed = editingYearNewValue.trim();
    if (!trimmed || !/^\d{4}$/.test(trimmed)) {
      showToast("Năm khai báo phải gồm 4 chữ số!", "error");
      return;
    }
    if (trimmed !== oldValue && years.some((y) => y.value === trimmed)) {
      showToast("Năm hoạt động này đã tồn tại!", "error");
      return;
    }

    const updatedYears = years.map((y) => (y.value === oldValue ? { value: trimmed } : y)).sort((a, b) => b.value.localeCompare(a.value));
    
    const updatedStore = { ...financialData };
    centers.forEach((c) => {
      if (updatedStore[c.id] && updatedStore[c.id][oldValue]) {
        updatedStore[c.id][trimmed] = updatedStore[c.id][oldValue];
        delete updatedStore[c.id][oldValue];
      }
    });

    setYears(updatedYears);
    setFinancialData(updatedStore);
    if (selectedYear === oldValue) {
      setSelectedYear(trimmed);
    }
    setEditingYearValue(null);
    setEditingYearNewValue("");
    handleSaveToLocalStorage(centers, updatedYears, indicators, updatedStore);
    showToast(`Đã cập nhật năm tài khoá thành: ${trimmed}`, "success");
  };

  const handleDeleteYear = (value: string) => {
    if (years.length <= 1) {
      showToast("Không thể xóa năm duy nhất!", "error");
      return;
    }
    if (!confirm(`Bạn có chắc muốn xóa năm tài khóa ${value}?`)) return;

    const updatedYears = years.filter((y) => y.value !== value);
    const updatedStore = { ...financialData };
    centers.forEach((c) => {
      if (updatedStore[c.id]) {
        delete updatedStore[c.id][value];
      }
    });

    setYears(updatedYears);
    setFinancialData(updatedStore);
    if (selectedYear === value) {
      setSelectedYear(updatedYears[0].value);
    }
    if (editingYearValue === value) {
      setEditingYearValue(null);
      setEditingYearNewValue("");
    }
    handleSaveToLocalStorage(centers, updatedYears, indicators, updatedStore);
    showToast(`Đã xóa tài khóa: ${value}`);
  };

  // 3. Indicator Managers (Doanh thu, Chi phí cố định, Chi phí biến đổi)
  const handleSaveIndicator = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newIndName.trim()) {
      showToast("Vui lòng nhập tên hạng mục chỉ tiêu!", "error");
      return;
    }
    if (newIndCenters.length === 0) {
      showToast("Vui lòng chọn ít nhất một trung tâm áp dụng!", "error");
      return;
    }

    const updatedStore = { ...financialData };

    if (editingIndicatorId) {
      // Edit
      const updatedInds = indicators.map((ind) => {
        if (ind.id === editingIndicatorId) {
          return {
            ...ind,
            name: newIndName.trim(),
            type: newIndType,
            subtype: newIndSubtype,
            centerIds: newIndCenters,
          };
        }
        return ind;
      });

      // Synchronize database records for new assignments
      centers.forEach((c) => {
        if (!updatedStore[c.id]) updatedStore[c.id] = {};
        years.forEach((y) => {
          if (!updatedStore[c.id][y.value]) updatedStore[c.id][y.value] = {};
          
          if (newIndCenters.includes(c.id)) {
            if (!updatedStore[c.id][y.value][editingIndicatorId]) {
              updatedStore[c.id][y.value][editingIndicatorId] = {};
              for (let m = 1; m <= 12; m++) {
                updatedStore[c.id][y.value][editingIndicatorId][m] = { actual: 0, budget: 0 };
              }
            }
          } else {
            delete updatedStore[c.id][y.value][editingIndicatorId];
          }
        });
      });

      setIndicators(updatedInds);
      setEditingIndicatorId(null);
      setNewIndName("");
      setNewIndCenters(centers.map(c => c.id));
      setFinancialData(updatedStore);
      handleSaveToLocalStorage(centers, years, updatedInds, updatedStore);
      showToast("Đã cập nhật hạng mục chỉ tiêu thành công!");
    } else {
      // Create
      const newId = "ind_" + Date.now();
      const newIndicator: Indicator = {
        id: newId,
        name: newIndName.trim(),
        type: newIndType,
        subtype: newIndSubtype,
        centerIds: newIndCenters,
      };

      const updatedInds = [...indicators, newIndicator];

      centers.forEach((c) => {
        if (!updatedStore[c.id]) updatedStore[c.id] = {};
        years.forEach((y) => {
          if (!updatedStore[c.id][y.value]) updatedStore[c.id][y.value] = {};
          if (newIndCenters.includes(c.id)) {
            updatedStore[c.id][y.value][newId] = {};
            for (let m = 1; m <= 12; m++) {
              updatedStore[c.id][y.value][newId][m] = { actual: 0, budget: 0 };
            }
          }
        });
      });

      setIndicators(updatedInds);
      setNewIndName("");
      setNewIndCenters(centers.map(c => c.id));
      setFinancialData(updatedStore);
      handleSaveToLocalStorage(centers, years, updatedInds, updatedStore);
      showToast(`Đã thêm chỉ tiêu: ${newIndName.trim()}`);
    }
  };

  const handleEditIndicatorClick = (ind: Indicator) => {
    setEditingIndicatorId(ind.id);
    setNewIndName(ind.name);
    setNewIndType(ind.type);
    setNewIndSubtype(ind.subtype);
    setNewIndCenters(ind.centerIds);
    // Switch scroll back slightly if config is long
    window.scrollTo({ top: 300, behavior: "smooth" });
  };

  const handleDeleteIndicator = (id: string, name: string) => {
    if (!confirm(`Bạn chắc muốn xóa chỉ tiêu "${name}" cùng toàn bộ số liệu đi kèm?`)) return;

    const updatedInds = indicators.filter((i) => i.id !== id);
    const updatedStore = { ...financialData };

    centers.forEach((c) => {
      years.forEach((y) => {
        if (updatedStore[c.id]?.[y.value]) {
          delete updatedStore[c.id][y.value][id];
        }
      });
    });

    setIndicators(updatedInds);
    setFinancialData(updatedStore);
    if (editingIndicatorId === id) {
      setEditingIndicatorId(null);
      setNewIndName("");
      setNewIndCenters(centers.map(c => c.id));
    }
    handleSaveToLocalStorage(centers, years, updatedInds, updatedStore);
    showToast(`Đã xóa chỉ tiêu: ${name}`);
  };

  const toggleIndCenterSelection = (cId: string) => {
    if (newIndCenters.includes(cId)) {
      setNewIndCenters(newIndCenters.filter((id) => id !== cId));
    } else {
      setNewIndCenters([...newIndCenters, cId]);
    }
  };

  // 4. Data Entry Submit
  const handleInputChange = (indId: string, field: "actual" | "budget", val: string) => {
    const numbersOnly = val.replace(/[^0-9]/g, "");
    setInputValues((prev) => ({
      ...prev,
      [indId]: {
        ...prev[indId],
        [field]: numbersOnly,
      },
    }));
  };

  const handleSaveDataEntry = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCenterId || !selectedYear) return;

    const updatedStore = { ...financialData };
    if (!updatedStore[selectedCenterId]) updatedStore[selectedCenterId] = {};
    if (!updatedStore[selectedCenterId][selectedYear]) updatedStore[selectedCenterId][selectedYear] = {};

    activeIndicators.forEach((ind) => {
      if (!updatedStore[selectedCenterId][selectedYear][ind.id]) {
        updatedStore[selectedCenterId][selectedYear][ind.id] = {};
      }

      const inputs = inputValues[ind.id] || { actual: "0", budget: "0" };
      const actualNum = parseInt(inputs.actual, 10) || 0;
      const budgetNum = parseInt(inputs.budget, 10) || 0;

      updatedStore[selectedCenterId][selectedYear][ind.id][selectedMonth] = {
        actual: actualNum,
        budget: budgetNum,
      };
    });

    setFinancialData(updatedStore);
    handleSaveToLocalStorage(centers, years, indicators, updatedStore);
    showToast(`Đã ghi sổ dữ liệu Tháng ${selectedMonth}/${selectedYear} của ${currentCenter?.name}!`, "success");
    setCurrentTab("report");
  };

  // Auto fill realistic inputs helper
  const handleAutoFillMockValues = () => {
    const baseSeed = selectedCenterId === "c1" ? 1.25 : selectedCenterId === "c2" ? 0.8 : 1.05;
    const yearFactor = selectedYear === "2026" ? 1.15 : 1.0;
    const monthFactor = 1 + Math.sin((selectedMonth / 12) * Math.PI) * 0.22;

    const updatedInputs = { ...inputValues };

    activeIndicators.forEach((ind) => {
      let b = 0;
      if (ind.id === "i1") b = 480000000;
      else if (ind.id === "i2") b = 25000000;
      else if (ind.id === "i3") b = 160000000;
      else if (ind.id === "i4") b = selectedCenterId === "c1" ? 45000000 : selectedCenterId === "c2" ? 30000000 : 40000000;
      else if (ind.id === "i5") b = selectedCenterId === "c1" ? 22000000 : selectedCenterId === "c2" ? 15000000 : 20000000;
      else if (ind.id === "i6") b = selectedCenterId === "c1" ? 12000000 : 8000000;
      else if (ind.id === "i7") b = 45000000;
      else b = 35000000; // custom fallback

      b = Math.round(b * baseSeed * yearFactor);
      let a = b;
      
      if (ind.type === "revenue") {
        a = Math.round(b * (0.88 + Math.random() * 0.24) * monthFactor);
      } else if (ind.type === "variable_cost") {
        a = Math.round(b * (0.85 + Math.random() * 0.3));
      }

      updatedInputs[ind.id] = {
        actual: a.toString(),
        budget: b.toString(),
      };
    });

    setInputValues(updatedInputs);
    showToast("Đã nhập số liệu mẫu tự động gợi ý!", "info");
  };

  // Synchronize draftGrid state with financialData when center/year/indicators change or input tab is activated
  useEffect(() => {
    if (selectedCenterId && selectedYear) {
      const grid: { [indId: string]: { [month: number]: { actual: string; budget: string } } } = {};
      indicators.forEach((ind) => {
        grid[ind.id] = {};
        for (let m = 1; m <= 12; m++) {
          const val = financialData[selectedCenterId]?.[selectedYear]?.[ind.id]?.[m] || { actual: 0, budget: 0 };
          grid[ind.id][m] = {
            actual: String(val.actual || 0),
            budget: String(val.budget || 0),
          };
        }
      });
      setDraftGrid(grid);
    }
  }, [selectedCenterId, selectedYear, indicators, financialData, currentTab]);

  const handleDraftGridCellChange = (indId: string, month: number, field: "actual" | "budget", val: string) => {
    const cleanNum = val.replace(/[^0-9]/g, ""); // Only permit digits
    setDraftGrid((prev) => ({
      ...prev,
      [indId]: {
        ...prev[indId],
        [month]: {
          ...prev[indId]?.[month],
          [field]: cleanNum,
        },
      },
    }));
  };

  const getDraftRowTotal = (indId: string, field: "actual" | "budget") => {
    let sum = 0;
    for (let m = 1; m <= 12; m++) {
      const cellVal = draftGrid[indId]?.[m]?.[field] || "0";
      sum += parseInt(cellVal, 10) || 0;
    }
    return sum;
  };

  const handleAutoFillGridMockValues = () => {
    const baseSeed = selectedCenterId === "c1" ? 1.25 : selectedCenterId === "c2" ? 0.8 : 1.05;
    const yearFactor = selectedYear === "2026" ? 1.15 : 1.0;

    const newGrid = { ...draftGrid };

    indicators.forEach((ind) => {
      newGrid[ind.id] = {};
      
      let baseB = 0;
      if (ind.id === "i1") baseB = 480000000;
      else if (ind.id === "i2") baseB = 25000000;
      else if (ind.id === "i3") baseB = 160000000;
      else if (ind.id === "i4") baseB = selectedCenterId === "c1" ? 45000000 : selectedCenterId === "c2" ? 30000000 : 40000000;
      else if (ind.id === "i5") baseB = selectedCenterId === "c1" ? 22000000 : selectedCenterId === "c2" ? 15000000 : 20000000;
      else if (ind.id === "i6") baseB = selectedCenterId === "c1" ? 12000000 : 8000000;
      else if (ind.id === "i7") baseB = 45000000;
      else baseB = 35000000; // fallbacks

      baseB = Math.round(baseB * baseSeed * yearFactor);

      for (let m = 1; m <= 12; m++) {
        const monthFactor = 1 + Math.sin((m / 12) * Math.PI) * 0.22;
        const b = Math.round(baseB / 12 * monthFactor);
        let a = b;
        
        if (ind.type === "revenue") {
          a = Math.round(b * (0.85 + Math.random() * 0.3));
        } else {
          a = Math.round(b * (0.9 + Math.random() * 0.2));
        }

        newGrid[ind.id][m] = {
          actual: String(a),
          budget: String(b),
        };
      }
    });

    setDraftGrid(newGrid);
    showToast("Tự sinh số liệu mẫu 12 tháng hoàn tất! Bấm 'Ghi sổ dữ liệu' để lưu.", "info");
  };

  const handleSaveGridDataEntry = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCenterId || !selectedYear) return;

    const updatedStore = { ...financialData };
    if (!updatedStore[selectedCenterId]) updatedStore[selectedCenterId] = {};
    if (!updatedStore[selectedCenterId][selectedYear]) updatedStore[selectedCenterId][selectedYear] = {};

    indicators.forEach((ind) => {
      if (!updatedStore[selectedCenterId][selectedYear][ind.id]) {
        updatedStore[selectedCenterId][selectedYear][ind.id] = {};
      }
      for (let m = 1; m <= 12; m++) {
        const draft = draftGrid[ind.id]?.[m] || { actual: "0", budget: "0" };
        const actualNum = parseInt(draft.actual, 10) || 0;
        const budgetNum = parseInt(draft.budget, 10) || 0;
        updatedStore[selectedCenterId][selectedYear][ind.id][m] = {
          actual: actualNum,
          budget: budgetNum,
        };
      }
    });

    setFinancialData(updatedStore);
    handleSaveToLocalStorage(centers, years, indicators, updatedStore);
    showToast(`Đã ghi sổ thành công số liệu cả năm ${selectedYear} cho Trung tâm ${currentCenter?.name}!`, "success");
    setCurrentTab("report");
  };

  const handleExportExcelTemplate = () => {
    if (!selectedCenterId || !selectedYear) return;

    try {
      const wb = XLSX.utils.book_new();

      // Sheet 1: THỰC TẾ
      const actualAOA = [
        ["HỆ THỐNG PHÂN TÍCH TÀI CHÍNH - BIẾN ĐỘNG CHI TIÊU & EBITDA"],
        [`Năm:`, selectedYear, `Trung tâm:`, currentCenter?.name, `Mã trung tâm:`, selectedCenterId],
        [`Bảng nhập liệu:`, `Thực tế`],
        [],
        ["Mã chỉ tiêu", "Tên chỉ tiêu", "Tháng 1", "Tháng 2", "Tháng 3", "Tháng 4", "Tháng 5", "Tháng 6", "Tháng 7", "Tháng 8", "Tháng 9", "Tháng 10", "Tháng 11", "Tháng 12", "Tổng"]
      ];

      indicators.forEach((ind) => {
        const row = [ind.id, ind.name];
        let total = 0;
        for (let m = 1; m <= 12; m++) {
          const val = financialData[selectedCenterId]?.[selectedYear]?.[ind.id]?.[m]?.actual || 0;
          row.push(val);
          total += val;
        }
        row.push(total);
        actualAOA.push(row);
      });

      // Sheet 2: KẾ HOẠCH
      const budgetAOA = [
        ["HỆ THỐNG PHÂN TÍCH TÀI CHÍNH - BIẾN ĐỘNG CHI TIÊU & EBITDA"],
        [`Năm:`, selectedYear, `Trung tâm:`, currentCenter?.name, `Mã trung tâm:`, selectedCenterId],
        [`Bảng nhập liệu:`, `Kế hoạch`],
        [],
        ["Mã chỉ tiêu", "Tên chỉ tiêu", "Tháng 1", "Tháng 2", "Tháng 3", "Tháng 4", "Tháng 5", "Tháng 6", "Tháng 7", "Tháng 8", "Tháng 9", "Tháng 10", "Tháng 11", "Tháng 12", "Tổng"]
      ];

      indicators.forEach((ind) => {
        const row = [ind.id, ind.name];
        let total = 0;
        for (let m = 1; m <= 12; m++) {
          const val = financialData[selectedCenterId]?.[selectedYear]?.[ind.id]?.[m]?.budget || 0;
          row.push(val);
          total += val;
        }
        row.push(total);
        budgetAOA.push(row);
      });

      // Append worksheets: depending on active input type, the corresponding sheet is placed FIRST to open by default in Excel
      if (inputGridType === "budget") {
        const wsBudget = XLSX.utils.aoa_to_sheet(budgetAOA);
        XLSX.utils.book_append_sheet(wb, wsBudget, "Kế hoạch");

        const wsActual = XLSX.utils.aoa_to_sheet(actualAOA);
        XLSX.utils.book_append_sheet(wb, wsActual, "Thực tế");
      } else {
        const wsActual = XLSX.utils.aoa_to_sheet(actualAOA);
        XLSX.utils.book_append_sheet(wb, wsActual, "Thực tế");

        const wsBudget = XLSX.utils.aoa_to_sheet(budgetAOA);
        XLSX.utils.book_append_sheet(wb, wsBudget, "Kế hoạch");
      }

      XLSX.writeFile(wb, `Template_Hach_Toan_${selectedYear}_${currentCenter?.name.replace(/\s+/g, "_")}.xlsx`);
      showToast("Tải mẫu Excel nhập liệu thành công! Bạn có thể điền thông tin và tải lên lại.", "success");
    } catch (err) {
      console.error(err);
      showToast("Có lỗi xảy ra khi tạo tệp Excel template!", "error");
    }
  };

  const handleImportExcelTemplate = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = evt.target?.result;
        if (!data) return;
        const workbook = XLSX.read(data, { type: "binary" });
        
        const newDraftGrid = { ...draftGrid };
        let pointsImported = 0;

        const firstSheetName = workbook.SheetNames[0];
        const isSingleSheet = workbook.SheetNames.length === 1;

        workbook.SheetNames.forEach((sheetName) => {
          const normNFC = sheetName.normalize("NFC").toLowerCase();
          const normNFD = sheetName.normalize("NFD").toLowerCase();

          const isActualSheet = normNFC.includes("thực tế") || normNFC.includes("thuc te") || normNFC.includes("actual") ||
                                normNFD.includes("thực tế") || normNFD.includes("thuc te") || normNFD.includes("actual");
          const isBudgetSheet = normNFC.includes("kế hoạch") || normNFC.includes("ke hoach") || normNFC.includes("budget") || normNFC.includes("plan") ||
                                normNFD.includes("kế hoạch") || normNFD.includes("ke hoach") || normNFD.includes("budget") || normNFD.includes("plan");

          // Determine target field(s) for this sheet
          const targetFields: ("actual" | "budget")[] = [];

          if (isActualSheet) targetFields.push("actual");
          if (isBudgetSheet) targetFields.push("budget");

          // Fallback: If sheet name is not explicitly recognized, map it directly to the user's active entry tab
          if (targetFields.length === 0 && (isSingleSheet || sheetName === firstSheetName)) {
            targetFields.push(inputGridType);
          }

          if (targetFields.length === 0) return;

          const worksheet = workbook.Sheets[sheetName];
          const range = XLSX.utils.decode_range(worksheet["!ref"] || "");
          
          // Row index 1 has meta definitions
          let excelCenterId = "";
          let excelYear = "";

          for (let r = 0; r <= 3; r++) {
            for (let c = 0; c <= range.e.c; c++) {
              const val = worksheet[XLSX.utils.encode_cell({ r, c })]?.v;
              if (val === "Mã trung tâm:" || val === "Mã trung tâm") {
                excelCenterId = String(worksheet[XLSX.utils.encode_cell({ r, c: c + 1 })]?.v || "").trim();
              }
              if (val === "Năm:" || val === "Năm") {
                excelYear = String(worksheet[XLSX.utils.encode_cell({ r, c: c + 1 })]?.v || "").trim();
              }
            }
          }

          if (excelCenterId && excelCenterId !== selectedCenterId) {
            showToast(`Cảnh báo: Tệp tin dành cho trung tâm khác (${excelCenterId}). Vui lòng kiểm tra lại!`, "error");
          }

          // Loop rows from row 4 (index 4)
          for (let r = 4; r <= range.e.r; r++) {
            const indIdRaw = worksheet[XLSX.utils.encode_cell({ r, c: 0 })]?.v;
            if (!indIdRaw) continue;

            const indId = String(indIdRaw).trim();
            const exists = indicators.some((i) => i.id === indId);
            if (!exists) continue;

            if (!newDraftGrid[indId]) {
              newDraftGrid[indId] = {};
            }

            // Months 1 to 12
            for (let m = 1; m <= 12; m++) {
              const colIndex = 1 + m;
              const cellObj = worksheet[XLSX.utils.encode_cell({ r, c: colIndex })];
              const rawVal = cellObj ? String(cellObj.v).replace(/[^0-9.-]/g, "") : "0";
              const parsedVal = Math.round(parseFloat(rawVal)) || 0;
              const safeVal = parsedVal >= 0 ? parsedVal : 0;

              if (!newDraftGrid[indId][m]) {
                newDraftGrid[indId][m] = { actual: "0", budget: "0" };
              }

              targetFields.forEach((field) => {
                newDraftGrid[indId][m][field] = String(safeVal);
                pointsImported++;
              });
            }
          }
        });

        if (pointsImported > 0) {
          setDraftGrid(newDraftGrid);
          showToast(`Tải dữ liệu từ Excel thành công! (${pointsImported} chỉ số đã giải nén). Bấm 'Ghi sổ dữ liệu' để lưu.`, "success");
        } else {
          showToast("Không tìm thấy dữ liệu chỉ tiêu thích hợp nào. Vui lòng kiểm tra định dạng tệp tải lên!", "error");
        }
      } catch (err) {
        console.error(err);
        showToast("Có lỗi xảy ra khi đọc file Excel!", "error");
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = "";
  };

  // Helper to compile financial data and fluctuated indicators for ANY center (used for PowerPoint export)
  const getCenterData = (centerId: string) => {
    // Get indicators applied to this center
    const centerInds = indicators.filter((ind) => ind.centerIds.includes(centerId));
    const centerDataStore = financialData[centerId]?.[selectedYear] || {};

    const tableRows = centerInds.map((ind) => {
      const indData = centerDataStore[ind.id] || {};
      const currentMonthData = indData[selectedMonth] || { actual: 0, budget: 0 };
      const actualMonth = currentMonthData.actual;
      const budgetMonth = currentMonthData.budget;

      let actualYTD = 0;
      let budgetYTD = 0;
      for (let m = 1; m <= selectedMonth; m++) {
        const mData = indData[m] || { actual: 0, budget: 0 };
        actualYTD += mData.actual;
        budgetYTD += mData.budget;
      }

      const variance = actualYTD - budgetYTD;
      const variancePercent = getVariancePercent(actualYTD, budgetYTD);

      return {
        id: ind.id,
        name: ind.name,
        type: ind.type,
        subtype: ind.subtype,
        actualMonth,
        budgetMonth,
        actualYTD,
        budgetYTD,
        variance,
        variancePercent,
      };
    });

    const initTotal = () => ({ actualMonth: 0, budgetMonth: 0, actualYTD: 0, budgetYTD: 0 });

    const rev = initTotal();
    const fixed = initTotal();
    const variable = initTotal();
    const depr = initTotal();
    const interest = initTotal();

    tableRows.forEach((r) => {
      if (r.type === "revenue") {
        rev.actualMonth += r.actualMonth;
        rev.budgetMonth += r.budgetMonth;
        rev.actualYTD += r.actualYTD;
        rev.budgetYTD += r.budgetYTD;
      } else if (r.type === "fixed_cost") {
        fixed.actualMonth += r.actualMonth;
        fixed.budgetMonth += r.budgetMonth;
        fixed.actualYTD += r.actualYTD;
        fixed.budgetYTD += r.budgetYTD;

        if (r.subtype === "depreciation") {
          depr.actualMonth += r.actualMonth;
          depr.actualYTD += r.actualYTD;
        } else if (r.subtype === "interest") {
          interest.actualMonth += r.actualMonth;
          interest.actualYTD += r.actualYTD;
        }
      } else if (r.type === "variable_cost") {
        variable.actualMonth += r.actualMonth;
        variable.budgetMonth += r.budgetMonth;
        variable.actualYTD += r.actualYTD;
        variable.budgetYTD += r.budgetYTD;
      }
    });

    const totalCost = {
      actualMonth: fixed.actualMonth + variable.actualMonth,
      budgetMonth: fixed.budgetMonth + variable.budgetMonth,
      actualYTD: fixed.actualYTD + variable.actualYTD,
      budgetYTD: fixed.budgetYTD + variable.budgetYTD,
    };

    const profit = {
      actualMonth: rev.actualMonth - totalCost.actualMonth,
      budgetMonth: rev.budgetMonth - totalCost.budgetMonth,
      actualYTD: rev.actualYTD - totalCost.actualYTD,
      budgetYTD: rev.budgetYTD - totalCost.budgetYTD,
    };

    const ebitda = {
      actualMonth: profit.actualMonth + depr.actualMonth + interest.actualMonth,
      budgetMonth: profit.budgetMonth + depr.actualMonth + interest.actualMonth,
      actualYTD: profit.actualYTD + depr.actualYTD + interest.actualYTD,
      budgetYTD: profit.budgetYTD + depr.actualYTD + interest.actualYTD,
    };

    const fluctuatedList: Array<{
      id: string;
      name: string;
      variancePercent: number;
      variance: number;
      typeString: string;
      isCategory?: boolean;
    }> = [];

    tableRows.forEach((row) => {
      if (isFluctuated(row.variancePercent)) {
        fluctuatedList.push({
          id: row.id,
          name: row.name,
          variancePercent: row.variancePercent,
          variance: row.variance,
          typeString: row.type === "revenue" ? "Doanh thu" : "Chi phí",
          isCategory: false,
        });
      }
    });

    // Parent category variances
    const revPct = getVariancePercent(rev.actualYTD, rev.budgetYTD);
    if (isFluctuated(revPct)) {
      fluctuatedList.push({
        id: "revenue",
        name: "I. DOANH THU",
        variancePercent: revPct,
        variance: rev.actualYTD - rev.budgetYTD,
        typeString: "Tổng hợp Doanh thu",
        isCategory: true,
      });
    }

    const costPct = getVariancePercent(totalCost.actualYTD, totalCost.budgetYTD);
    if (isFluctuated(costPct)) {
      fluctuatedList.push({
        id: "cost",
        name: "II. CHI PHÍ",
        variancePercent: costPct,
        variance: totalCost.actualYTD - totalCost.budgetYTD,
        typeString: "Tổng hợp Chi phí",
        isCategory: true,
      });
    }

    const fixedPct = getVariancePercent(fixed.actualYTD, fixed.budgetYTD);
    if (isFluctuated(fixedPct)) {
      fluctuatedList.push({
        id: "fixed_cost",
        name: "1. CHI PHÍ CỐ ĐỊNH",
        variancePercent: fixedPct,
        variance: fixed.actualYTD - fixed.budgetYTD,
        typeString: "Tổng hợp Định phí",
        isCategory: true,
      });
    }

    const varPct = getVariancePercent(variable.actualYTD, variable.budgetYTD);
    if (isFluctuated(varPct)) {
      fluctuatedList.push({
        id: "variable_cost",
        name: "2. CHI PHÍ BIẾN ĐỔI",
        variancePercent: varPct,
        variance: variable.actualYTD - variable.budgetYTD,
        typeString: "Tổng hợp Biến phí",
        isCategory: true,
      });
    }

    const profitPct = getVariancePercent(profit.actualYTD, profit.budgetYTD);
    if (isFluctuated(profitPct)) {
      fluctuatedList.push({
        id: "profit",
        name: "III. LỢI NHUẬN RÒNG",
        variancePercent: profitPct,
        variance: profit.actualYTD - profit.budgetYTD,
        typeString: "Tổng hợp Lợi nhuận",
        isCategory: true,
      });
    }

    const ebitdaPct = getVariancePercent(ebitda.actualYTD, ebitda.budgetYTD);
    if (isFluctuated(ebitdaPct)) {
      fluctuatedList.push({
        id: "ebitda",
        name: "IV. EBITDA",
        variancePercent: ebitdaPct,
        variance: ebitda.actualYTD - ebitda.budgetYTD,
        typeString: "Tổng hợp EBITDA",
        isCategory: true,
      });
    }

    return {
      tableRows,
      totals: {
        revenue: rev,
        fixedCost: fixed,
        variableCost: variable,
        totalCost,
        profit,
        ebitda,
      },
      fluctuatedItems: fluctuatedList,
    };
  };

  // Client-side high-fidelity PowerPoint generator
  const handleExportPPTX = (targetCenterId: string) => {
    try {
      const pptx = new pptxgen();
      pptx.layout = "LAYOUT_16x9";

      const primaryColor = "1E293B"; // Slate 800
      const secondaryColor = "475569"; // Slate 600
      const accentBlue = "2563EB"; // Blue 600
      const accentGreen = "059669"; // Emerald 600
      const accentRed = "DC2626"; // Red 600
      const bgLight = "F8FAFC"; // Slate 50
      const borderCell = "E2E8F0";
      const fontMain = "Calibri";

      const isAll = targetCenterId === "all";

      // 1. COVER SLIDE
      const coverSlide = pptx.addSlide();
      coverSlide.background = { color: "0F172A" }; // Premium dark bg

      // Minimal decorative accent line
      coverSlide.addText("", {
        x: 0.8,
        y: 1.2,
        w: 1.2,
        h: 0.05,
        fill: { color: "38BDF8" }
      });

      coverSlide.addText("HỆ THỐNG QUẢN TRỊ HIỆU QUẢ HOẠT ĐỘNG FINANCE DEP", {
        x: 0.8,
        y: 1.4,
        w: 8.4,
        h: 0.3,
        fontSize: 10,
        bold: true,
        color: "38BDF8",
        fontFace: fontMain,
      });

      const coverTitle = isAll
        ? "BÁO CÁO KẾT QUẢ TÀI CHÍNH TỔNG HỢP\nTOÀN BỘ CÁC TRUNG TÂM PHÂN PHỐI"
        : `BÁO CÁO KẾT QUẢ HOẠT ĐỘNG CHI TIẾT\n${centers.find((c) => c.id === targetCenterId)?.name.toUpperCase()}`;

      coverSlide.addText(coverTitle, {
        x: 0.8,
        y: 1.85,
        w: 8.4,
        h: 1.5,
        fontSize: 22,
        bold: true,
        color: "FFFFFF",
        fontFace: fontMain,
        align: "left",
      });

      // Date & Meta
      coverSlide.addText(`Giai đoạn phân tích: Tháng ${selectedMonth} / Năm ${selectedYear} (Lũy kế YTD ${selectedMonth} tháng)`, {
        x: 0.8,
        y: 3.5,
        w: 8.4,
        h: 0.4,
        fontSize: 11.5,
        color: "94A3B8",
        fontFace: fontMain,
      });

      coverSlide.addText(`Ban lập: Phòng Kế Hoạch Tài Chính • Ngày trích xuất: ${new Date().toLocaleDateString("vi-VN")}`, {
        x: 0.8,
        y: 4.5,
        w: 8.4,
        h: 0.4,
        fontSize: 9.0,
        color: "64748B",
        italic: true,
        fontFace: fontMain,
      });

      // 2. DATA SLIDES DEFINITIONS
      const centersToExport = isAll ? centers : centers.filter((c) => c.id === targetCenterId);

      centersToExport.forEach((center) => {
        const data = getCenterData(center.id);
        if (!data) return;

        // Initialize Table AOA matrix properly
        const allRows: any[] = [];
        const cellMargin = [0.02, 0.04, 0.02, 0.04]; // Extremely compact padding to prevent row overflow

        // Build elegant Column Headers row with compact sizing
        const headerRow = [
          { text: "CHỈ TIÊU BÁO CÁO", options: { bold: true, color: "FFFFFF", fill: { color: primaryColor }, fontSize: 7.8, align: "left", margin: cellMargin } },
          { text: "THỰC HIỆN THÁNG", options: { bold: true, color: "FFFFFF", fill: { color: primaryColor }, fontSize: 7.8, align: "right", margin: cellMargin } },
          { text: "KẾ HOẠCH THÁNG", options: { bold: true, color: "FFFFFF", fill: { color: primaryColor }, fontSize: 7.8, align: "right", margin: cellMargin } },
          { text: "LŨY KẾ THỰC HIỆN (YTD)", options: { bold: true, color: "FFFFFF", fill: { color: primaryColor }, fontSize: 7.8, align: "right", margin: cellMargin } },
          { text: "LŨY KẾ KẾ HOẠCH (YTD)", options: { bold: true, color: "FFFFFF", fill: { color: primaryColor }, fontSize: 7.8, align: "right", margin: cellMargin } },
          { text: "CHÊNH LỆCH YTD", options: { bold: true, color: "FFFFFF", fill: { color: primaryColor }, fontSize: 7.8, align: "right", margin: cellMargin } },
          { text: "LỆCH % YTD", options: { bold: true, color: "FFFFFF", fill: { color: primaryColor }, fontSize: 7.8, align: "right", margin: cellMargin } },
        ];

        const addRowToPPTXTable = (
          name: string,
          rowVals: { actualMonth: number; budgetMonth: number; actualYTD: number; budgetYTD: number },
          isBold = false,
          bgColor?: string,
          isCostColor = false
        ) => {
          const diffYTD = rowVals.actualYTD - rowVals.budgetYTD;
          const pctYTD = getVariancePercent(rowVals.actualYTD, rowVals.budgetYTD);

          // Customize variant colors based on performance
          let varianceTextColor = "1E293B";
          if (Math.abs(pctYTD) > 10) {
            varianceTextColor = isCostColor
              ? (pctYTD > 0 ? "B91C1C" : "047857") // Red for over budget cost, Green for saved
              : (pctYTD < 0 ? "B91C1C" : "047857"); // Red for missed revenue, Green for surplus
          }

          const cellBorder = { pt: 0.5, color: borderCell };

          // Highly optimized, responsive text sizing to prevent line wraps and page overflowing
          let fontSize = 6.6; // default for detail indicators (highly compact)
          if (isBold) {
            if (bgColor === "F8FAFC") {
              fontSize = 7.2; // level-2 headers (Chi phí cố định, Chi phí biến đổi)
            } else {
              fontSize = 7.8; // level-1 headers (Doanh thu, Chi phí, Lợi nhuận, EBITDA)
            }
          }

          allRows.push([
            { text: name, options: { bold: isBold, fill: bgColor ? { color: bgColor } : undefined, fontSize, align: "left", border: cellBorder, margin: cellMargin } },
            { text: formatCurrency(rowVals.actualMonth), options: { bold: isBold, fill: bgColor ? { color: bgColor } : undefined, fontSize, align: "right", border: cellBorder, margin: cellMargin } },
            { text: formatCurrency(rowVals.budgetMonth), options: { bold: isBold, fill: bgColor ? { color: bgColor } : undefined, fontSize, align: "right", border: cellBorder, margin: cellMargin } },
            { text: formatCurrency(rowVals.actualYTD), options: { bold: isBold, fill: bgColor ? { color: bgColor } : undefined, fontSize, align: "right", border: cellBorder, margin: cellMargin } },
            { text: formatCurrency(rowVals.budgetYTD), options: { bold: isBold, fill: bgColor ? { color: bgColor } : undefined, fontSize, align: "right", border: cellBorder, margin: cellMargin } },
            { text: `${diffYTD >= 0 ? "+" : ""}${formatCurrency(diffYTD)}`, options: { bold: isBold, fill: bgColor ? { color: bgColor } : undefined, fontSize, align: "right", border: cellBorder, margin: cellMargin } },
            { text: formatPercent(pctYTD), options: { bold: true, color: varianceTextColor, fill: bgColor ? { color: bgColor } : undefined, fontSize, align: "right", border: cellBorder, margin: cellMargin } },
          ]);
        };

        // I. Revenue Section
        addRowToPPTXTable("I. DOANH THU", data.totals.revenue, true, "F1F5F9", false);
        data.tableRows.forEach((row) => {
          if (row.type === "revenue") {
            addRowToPPTXTable(`  - ${row.name}`, row, false, undefined, false);
          }
        });

        // II. Cost Section
        addRowToPPTXTable("II. CHI PHÍ", data.totals.totalCost, true, "F1F5F9", true);

        // Fixed Costs
        addRowToPPTXTable("  1. CHI PHÍ CỐ ĐỊNH", data.totals.fixedCost, true, "F8FAFC", true);
        data.tableRows.forEach((row) => {
          if (row.type === "fixed_cost") {
            addRowToPPTXTable(`    + ${row.name}`, row, false, undefined, true);
          }
        });

        // Variable Costs
        addRowToPPTXTable("  2. CHI PHÍ BIẾN ĐỔI", data.totals.variableCost, true, "F8FAFC", true);
        data.tableRows.forEach((row) => {
          if (row.type === "variable_cost") {
            addRowToPPTXTable(`    + ${row.name}`, row, false, undefined, true);
          }
        });

        // III. Net Profit
        addRowToPPTXTable("III. LỢI NHUẬN RÒNG", data.totals.profit, true, "ECFDF5", false);

        // IV. EBITDA
        addRowToPPTXTable("IV. EBITDA", data.totals.ebitda, true, "EFF6FF", false);

        // Pagination for Bảng số liệu - chunk allRows into pages
        const maxRowsPerSlide = 15;
        const totalPages = Math.ceil(allRows.length / maxRowsPerSlide);

        for (let pageIndex = 0; pageIndex < totalPages; pageIndex++) {
          const dataSlide = pptx.addSlide();
          dataSlide.background = { color: "FFFFFF" };

          const pageStr = totalPages > 1 ? ` (Trang ${pageIndex + 1}/${totalPages})` : "";

          // Top Header Title and Subtitle
          dataSlide.addText(`BÁO CÁO KẾT QUẢ KPI & HIỆU QUẢ TÀI CHÍNH - ${center.name.toUpperCase()}${pageStr}`, {
            x: 0.5,
            y: 0.3,
            w: 6.5,
            h: 0.4,
            fontSize: 14,
            bold: true,
            color: primaryColor,
            fontFace: fontMain,
          });

          dataSlide.addText(`Tài khóa ${selectedYear} • Trích xuất lũy kế ${selectedMonth} tháng đầu năm`, {
            x: 0.5,
            y: 0.65,
            w: 6.5,
            h: 0.3,
            fontSize: 8.5,
            color: "475569",
            italic: true,
            fontFace: fontMain,
          });

          dataSlide.addText("Đơn vị: Đồng (VND)", {
            x: 7.0,
            y: 0.35,
            w: 2.5,
            h: 0.3,
            fontSize: 8.5,
            color: "64748B",
            align: "right",
            bold: true,
            fontFace: fontMain,
          });

          const chunk = allRows.slice(pageIndex * maxRowsPerSlide, (pageIndex + 1) * maxRowsPerSlide);
          const slideTableData = [headerRow, ...chunk];

          // Mount structured table chunk on slide
          dataSlide.addTable(slideTableData, {
            x: 0.5,
            y: 1.0,
            w: 9.0,
            rowH: 0.22,
            colW: [2.7, 1.05, 1.05, 1.05, 1.05, 1.05, 1.05],
          });
        }

        // SLIDE B: Commentary and Variance Explanations
        const fluctuatedList = data.fluctuatedItems;

        if (fluctuatedList.length === 0) {
          const commentSlide = pptx.addSlide();
          commentSlide.background = { color: bgLight };

          // Sub Header Title
          commentSlide.addText(`GIẢI TRÌNH BIẾN ĐỘNG CHỈ TIÊU - ${center.name.toUpperCase()}`, {
            x: 0.5,
            y: 0.3,
            w: 9.0,
            h: 0.4,
            fontSize: 14,
            bold: true,
            color: primaryColor,
            fontFace: fontMain,
          });

          commentSlide.addText("Tổng hợp phân tích nguyên nhân biến động vượt ngưỡng cảnh báo 10% trong năm nay", {
            x: 0.5,
            y: 0.65,
            w: 9.0,
            h: 0.3,
            fontSize: 8.5,
            color: "475569",
            italic: true,
            fontFace: fontMain,
          });

          // Centered happy placeholder
          commentSlide.addText("CHỈ TIÊU TỐT • KHÔNG CÓ BIẾN ĐỘNG VƯỢT NGƯỠNG", {
            x: 0.8,
            y: 2.0,
            w: 8.4,
            h: 0.6,
            fontSize: 18,
            bold: true,
            color: "059669",
            align: "center",
            fontFace: fontMain,
          });

          commentSlide.addText("Toàn bộ các chỉ tiêu doanh thu và chi phí YTD nằm trong tầm kiểm soát dưới mục tiêu cảnh báo (>10%).\nKhông phát hiện bất cứ rủi ro tài chính đột xuất nào.", {
            x: 0.8,
            y: 2.7,
            w: 8.4,
            h: 1.0,
            fontSize: 11,
            color: "64748B",
            align: "center",
            fontFace: fontMain,
          });
        } else {
          // Pagination for Commentary - Display all fluctuated items paginated (8 items per slide in a tight 4x2 grid)
          const itemsPerPage = 8;
          const totalCommPages = Math.ceil(fluctuatedList.length / itemsPerPage);

          for (let pDef = 0; pDef < totalCommPages; pDef++) {
            const commentSlide = pptx.addSlide();
            commentSlide.background = { color: bgLight };

            const pageStr = totalCommPages > 1 ? ` (Trang ${pDef + 1}/${totalCommPages})` : "";

            // Sub Header Title
            commentSlide.addText(`GIẢI TRÌNH BIẾN ĐỘNG CHỈ TIÊU - ${center.name.toUpperCase()}${pageStr}`, {
              x: 0.5,
              y: 0.3,
              w: 9.0,
              h: 0.4,
              fontSize: 14,
              bold: true,
              color: primaryColor,
              fontFace: fontMain,
            });

            commentSlide.addText("Tổng hợp phân tích nguyên nhân biến động vượt ngưỡng cảnh báo 10% trong năm nay", {
              x: 0.5,
              y: 0.65,
              w: 9.0,
              h: 0.3,
              fontSize: 8.5,
              color: "475569",
              italic: true,
              fontFace: fontMain,
            });

            const currentItems = fluctuatedList.slice(pDef * itemsPerPage, (pDef + 1) * itemsPerPage);

            const cWidth = 4.35;
            const cHeight = 0.85;
            const c1X = 0.5;
            const c2X = 5.15;
            const cStartY = 1.0;
            const cRowGap = 0.95;

            currentItems.forEach((item, index) => {
              const col = index % 2;
              const rowIndex = Math.floor(index / 2);
              const cardX = col === 0 ? c1X : c2X;
              const cardY = cStartY + rowIndex * cRowGap;

              const cKey = `${center.id}_${selectedYear}_${selectedMonth}_${item.id}`;
              const cTextText = explanations[cKey] || "Chưa cập nhật nội dung giải trình nội bộ.";

              // Card Background block
              commentSlide.addText("", {
                x: cardX,
                y: cardY,
                w: cWidth,
                h: cHeight,
                fill: { color: "FFFFFF" },
              });

              // Card Header Text
              commentSlide.addText(`${item.name} (${item.typeString})`, {
                x: cardX + 0.15,
                y: cardY + 0.06,
                w: cWidth - 0.3,
                h: 0.20,
                fontSize: 9.0,
                bold: true,
                color: "0F172A",
                fontFace: fontMain,
              });

              // Card metric pill
              const varianceColor = item.variancePercent >= 0 ? "059669" : "DC2626";
              commentSlide.addText(`Biến động YTD: ${item.variance >= 0 ? "+" : ""}${formatCurrency(item.variance)} | Tỷ lệ lệch: ${formatPercent(item.variancePercent)}`, {
                x: cardX + 0.15,
                y: cardY + 0.26,
                w: cWidth - 0.3,
                h: 0.18,
                fontSize: 8.0,
                bold: true,
                color: varianceColor,
                fontFace: fontMain,
              });

              // Card text commentary
              commentSlide.addText(`Giải trình: ${cTextText}`, {
                x: cardX + 0.15,
                y: cardY + 0.44,
                w: cWidth - 0.3,
                h: 0.38,
                fontSize: 7.5,
                color: explanations[cKey] ? "475569" : "94A3B8",
                italic: !explanations[cKey],
                fontFace: fontMain,
                valign: "top",
              });
            });

            // Clean bottom footnote/legend
            commentSlide.addText(`Hiển thị các chỉ số có biến động thực tế so với kế hoạch vượt ngưỡng kiểm soát 10%.`, {
              x: 0.5,
              y: 4.7,
              w: 9.0,
              h: 0.3,
              fontSize: 8.0,
              color: "94A3B8",
              italic: true,
              fontFace: fontMain,
            });
          }
        }
      });

      // 3. OUTRO SLIDE
      const outroSlide = pptx.addSlide();
      outroSlide.background = { color: "0F172A" }; // dark background

      outroSlide.addText("XIN TRÂN TRỌNG CẢM ƠN!", {
        x: 0.8,
        y: 1.8,
        w: 8.4,
        h: 0.6,
        fontSize: 24,
        bold: true,
        color: "FFFFFF",
        align: "center",
        fontFace: fontMain,
      });

      outroSlide.addText("HỆ THỐNG KIỂM SOÁT KPI VÀ BÁO CÁO PHÂN TÍCH TÀI CHÍNH TỰ ĐỘNG", {
        x: 0.8,
        y: 2.5,
        w: 8.4,
        h: 0.4,
        fontSize: 10,
        bold: true,
        color: "38BDF8",
        align: "center",
        fontFace: fontMain,
      });

      outroSlide.addText(`Báo cáo trích xuất trực tiếp từ Cơ sở dữ liệu Nội bộ lúc ${new Date().toLocaleTimeString("vi-VN")} ngày ${new Date().toLocaleDateString("vi-VN")}`, {
        x: 0.8,
        y: 3.4,
        w: 8.4,
        h: 0.4,
        fontSize: 8.5,
        color: "64748B",
        align: "center",
        fontFace: fontMain,
        italic: true,
      });

      // Dynamic safe filename
      const finalFilename = isAll
        ? `Bao_cao_tai_chinh_Tong_hop_T${selectedMonth}_${selectedYear}.pptx`
        : `Bao_cao_tai_chinh_${centers.find((c) => c.id === targetCenterId)?.name.replace(/\s+/g, "_")}_T${selectedMonth}_${selectedYear}.pptx`;

      pptx.writeFile({ fileName: finalFilename });
      showToast(`Xuất PowerPoint tự động thành công: ${finalFilename}`, "success");
    } catch (err) {
      console.error("Powerpoint generation failed:", err);
      showToast("Có lỗi xảy ra khi tạo tệp báo cáo PowerPoint!", "error");
    }
  };

  // Client-side rule-based financial analysis commentary (Instant, useful, fully local)
  const getRowAnalysisText = (row: any) => {
    if (row.type === "revenue") {
      if (row.budgetYTD === 0) return "Chưa lập ngân sách";
      const pct = (row.actualYTD / row.budgetYTD) * 100;
      if (pct >= 105) return `Xuất sắc (Vượt KH ${Math.round(pct - 100)}%)`;
      if (pct >= 98 && pct < 105) return "Đạt mục tiêu tăng trưởng";
      const gap = Math.round(100 - pct);
      return `Hụt chỉ tiêu (Giảm ${gap}%)`;
    } else {
      // Cost comparison
      if (row.budgetYTD === 0) return "Chưa lập ngân sách";
      const pct = (row.actualYTD / row.budgetYTD) * 100;
      if (pct <= 92) return `Tối ưu tốt (Tiết kiệm ${Math.round(100 - pct)}%)`;
      if (pct <= 100) return "Trong hạn mức chi phí";
      if (pct <= 108) return `Vượt nhẹ định mức (+${Math.round(pct - 100)}%)`;
      return `Vượt định biên lớn (+${Math.round(pct - 100)}%)`;
    }
  };

  const getAggregateAnalysisText = (type: "revenue" | "cost" | "profit" | "ebitda") => {
    let act = 0;
    let bud = 0;

    if (type === "revenue") {
      act = totals.revenue.actualYTD;
      bud = totals.revenue.budgetYTD;
      if (bud === 0) return "Chưa thiết lập kế hoạch";
      const ratio = act / bud;
      if (ratio >= 1.0) return `Vượt kế hoạch (+${Math.round((ratio - 1) * 100)}%)`;
      return `Hụt kế hoạch (-${Math.round((1 - ratio) * 100)}%)`;
    } else if (type === "cost") {
      act = totals.totalCost.actualYTD;
      bud = totals.totalCost.budgetYTD;
      if (bud === 0) return "Chưa thiết lập kế hoạch";
      const ratio = act / bud;
      if (ratio <= 1.0) return `Tiết kiệm chi phí (-${Math.round((1 - ratio) * 100)}%)`;
      return `Vượt định mức (+${Math.round((ratio - 1) * 100)}%)`;
    } else if (type === "profit") {
      act = totals.profit.actualYTD;
      bud = totals.profit.budgetYTD;
      if (bud === 0) return "Tốt";
      if (act >= bud) return "Hiệu quả lợi nhuận vượt KH";
      return "Chưa đạt kỳ vọng lợi nhuận";
    } else {
      act = totals.ebitda.actualYTD;
      bud = totals.ebitda.budgetYTD;
      if (bud === 0) return "Tốt";
      if (act >= bud) return "Chỉ số EBITDA khỏe mạnh";
      return "Cần cắt giảm chi phí để bù EBITDA";
    }
  };

  return (
    <div className="min-h-screen bg-[#F0F2F5] font-sans text-slate-800 antialiased selection:bg-blue-600 selection:text-white">
      
      {/* HEADER / NAVIGATION BAR (Exact Theme styling matching screenshot spec) */}
      <header className="sticky top-0 z-40 w-full bg-[#1e293b] text-white shadow-md border-b border-slate-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-600 rounded-lg text-white shadow-inner flex items-center justify-center">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight uppercase">FINANCE ANALYSIS PRO</h1>
              <div className="flex items-center space-x-1.5 mt-0.5">
                <span className="inline-block w-1.5 h-1.5 bg-[#4ade80] rounded-full animate-pulse"></span>
                <p className="text-[10px] text-[#4ade80] tracking-wider uppercase font-mono">BỘ NHỚ CỤC BỘ / AUTO-SAVE ENABLED</p>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {/* Nav pills */}
            <nav className="flex space-x-1 bg-slate-800 p-1 rounded-lg border border-slate-700">
              <button
                type="button"
                onClick={() => setCurrentTab("report")}
                className={`flex items-center space-x-1.5 px-4 py-2 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                  currentTab === "report"
                    ? "bg-[#2563eb] text-white shadow-sm font-bold"
                    : "text-slate-300 hover:text-white hover:bg-slate-700/50"
                }`}
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Báo cáo</span>
              </button>
              <button
                type="button"
                onClick={() => setCurrentTab("input")}
                className={`flex items-center space-x-1.5 px-4 py-2 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                  currentTab === "input"
                    ? "bg-[#2563eb] text-white shadow-sm font-bold"
                    : "text-slate-300 hover:text-white hover:bg-slate-700/50"
                }`}
              >
                <Database className="w-4 h-4" />
                <span>Nhập liệu</span>
              </button>
              <button
                type="button"
                onClick={() => setCurrentTab("config")}
                className={`flex items-center space-x-1.5 px-4 py-2 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                  currentTab === "config"
                    ? "bg-[#2563eb] text-white shadow-sm font-bold"
                    : "text-slate-300 hover:text-white hover:bg-slate-700/50"
                }`}
              >
                <Settings className="w-4 h-4" />
                <span>Khai báo</span>
              </button>
            </nav>

            {/* Profile avatar circle */}
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-700 text-blue-300 font-bold border border-slate-600 text-xs">
              U
            </div>
          </div>
        </div>
      </header>

      {/* SUB-HEADER / CONTROLS PANEL (White bar with bottom border as per screenshot format) */}
      <section className="bg-white border-b border-slate-200 py-3 shadow-sm sticky top-16 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
          
          <div className="flex flex-wrap items-center gap-6">
            {/* Year selector styled beautifully inside sub-header */}
            <div className="flex items-center space-x-2 shrink-0">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">NĂM PHÂN TÍCH:</span>
              <div className="relative">
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  className="appearance-none bg-slate-50 border border-slate-200 rounded-md pl-3 pr-8 py-1.5 text-xs font-bold text-slate-700 hover:border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-sm transition-colors cursor-pointer"
                >
                  {years.map((y) => (
                    <option key={y.value} value={y.value}>
                      {y.value}
                    </option>
                  ))}
                </select>
                <span className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none text-slate-500">
                  <ChevronDown className="w-3.5 h-3.5" />
                </span>
              </div>
            </div>

            {/* Centers Tab Buttons visually listed in the middle */}
            <div className="flex items-center p-0.5 rounded-lg border-b-2 border-transparent">
              <div className="flex space-x-4">
                {centers.map((c) => {
                  const isActive = selectedCenterId === c.id;
                  return (
                    <button
                      key={c.id}
                      onClick={() => setSelectedCenterId(c.id)}
                      className={`relative py-1 px-3 text-xs font-bold transition-all cursor-pointer ${
                        isActive
                          ? "text-blue-600 font-extrabold"
                          : "text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      {c.name}
                      {isActive && (
                        <span className="absolute bottom-[-14px] left-0 right-0 h-0.5 bg-blue-600 rounded-full"></span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Month Selector DROPDOWN in exact alignment: "THÁNG XEM" dropdown menu as requested */}
          <div className="flex items-center space-x-2 self-end md:self-auto shrink-0">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">THÁNG XEM:</span>
            <div className="relative">
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(parseInt(e.target.value, 10))}
                className="appearance-none bg-white border border-slate-200 rounded-md pl-4 pr-10 py-1.5 text-xs font-bold text-slate-700 hover:border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-sm min-w-[130px] transition-colors cursor-pointer"
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <option key={m} value={m}>
                    Tháng {m}
                  </option>
                ))}
              </select>
              <span className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-slate-500">
                <ChevronDown className="w-3.5 h-3.5" />
              </span>
            </div>
          </div>

        </div>
      </section>

      {/* MAIN LAYOUT CANVAS */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        
        {/* TOAST SYSTEM CO-ORDINATE */}
        {toastMessage && (
          <div className="fixed bottom-5 right-5 z-50 flex items-center space-x-2 bg-slate-900 text-white px-4 py-3 rounded-lg shadow-lg border border-slate-700 animate-slide-up">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <p className="text-xs font-semibold">{toastMessage.text}</p>
          </div>
        )}

        {/* ======================= TAB 1: BÁO CÁO (REPORT) ======================= */}
        {currentTab === "report" && (
          <div className="space-y-6 animate-fade-in">
            
            {/* KPI METRIC CARDS (Matches layout & exact label formats in screenshot) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              
              {/* CARD 1: TỔNG DOANH THU */}
              <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm flex flex-col justify-between">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">TỔNG DOANH THU (YTD)</span>
                  <h3 className="text-2xl font-bold text-slate-900 tracking-tight leading-none mt-2">
                    {totals.revenue.actualYTD === 0 ? "0" : formatCurrency(totals.revenue.actualYTD, true)}
                  </h3>
                </div>
                <div className="mt-4 pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                  {totals.revenue.actualYTD >= totals.revenue.budgetYTD ? (
                    <span className="font-bold text-emerald-600 flex items-center bg-emerald-50 px-1.5 py-0.5 rounded text-[10px]">
                      +{getVariancePercent(totals.revenue.actualYTD, totals.revenue.budgetYTD).toFixed(0)}% so với KH
                    </span>
                  ) : (
                    <span className="font-bold text-rose-600 flex items-center bg-rose-50 px-1.5 py-0.5 rounded text-[10px]">
                      {getVariancePercent(totals.revenue.actualYTD, totals.revenue.budgetYTD).toFixed(0)}% so với KH
                    </span>
                  )}
                </div>
              </div>

              {/* CARD 2: TỔNG CHI PHÍ */}
              <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm flex flex-col justify-between">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">TỔNG CHI PHÍ (YTD)</span>
                  <h3 className="text-2xl font-bold text-slate-900 tracking-tight leading-none mt-2">
                    {totals.totalCost.actualYTD === 0 ? "0" : formatCurrency(totals.totalCost.actualYTD, true)}
                  </h3>
                </div>
                <div className="mt-4 pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                  {totals.totalCost.actualYTD <= totals.totalCost.budgetYTD ? (
                    <span className="font-bold text-emerald-600 flex items-center bg-emerald-50 px-1.5 py-0.5 rounded text-[10px]">
                      -{totals.totalCost.budgetYTD !== 0 ? ((totals.totalCost.budgetYTD - totals.totalCost.actualYTD) / totals.totalCost.budgetYTD * 100).toFixed(0) : (totals.totalCost.actualYTD !== 0 ? "100" : "0")}% so với KH
                    </span>
                  ) : (
                    <span className="font-bold text-rose-600 flex items-center bg-rose-50 px-1.5 py-0.5 rounded text-[10px]">
                      +{totals.totalCost.budgetYTD !== 0 ? ((totals.totalCost.actualYTD - totals.totalCost.budgetYTD) / totals.totalCost.budgetYTD * 100).toFixed(0) : (totals.totalCost.actualYTD !== 0 ? "100" : "0")}% so với KH
                    </span>
                  )}
                </div>
              </div>

              {/* CARD 3: LỢI NHUẬN (YTD) */}
              <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm flex flex-col justify-between">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">LỢI NHUẬN (YTD)</span>
                  <h3 className={`text-2xl font-bold tracking-tight leading-none mt-2 ${totals.profit.actualYTD >= 0 ? 'text-slate-900' : 'text-rose-600'}`}>
                    {totals.profit.actualYTD === 0 ? "0" : formatCurrency(totals.profit.actualYTD, true)}
                  </h3>
                </div>
                <div className="mt-4 pt-2 border-t border-slate-100 text-xs text-slate-400 font-semibold flex justify-between items-center leading-none">
                  <span>Lũy kế {selectedMonth} tháng</span>
                </div>
              </div>

              {/* CARD 4: TỔNG EBITDA (YTD) */}
              <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm flex flex-col justify-between">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">TỔNG EBITDA (YTD)</span>
                  <h3 className={`text-2xl font-bold tracking-tight leading-none mt-2 ${totals.ebitda.actualYTD >= 0 ? 'text-slate-900' : 'text-rose-600'}`}>
                    {totals.ebitda.actualYTD === 0 ? "0" : formatCurrency(totals.ebitda.actualYTD, true)}
                  </h3>
                </div>
                <div className="mt-4 pt-2 border-t border-slate-100 text-[10.5px] text-slate-400 font-medium">
                  Lợi nhuận + Khấu hao + Lãi vay
                </div>
              </div>

              {/* CARD 5: BIẾN ĐỘNG */}
              <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm flex flex-col justify-between">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">BIẾN ĐỘNG</span>
                  <h3 className="text-2xl font-semibold text-slate-900 tracking-tight leading-none mt-2">
                    {totals.badIndicatorsCount.toString().padStart(2, "0")} Chỉ tiêu
                  </h3>
                </div>
                <div className="mt-4 pt-2 border-t border-slate-100 text-xs flex justify-between items-center text-slate-400">
                  <span className="font-semibold text-rose-500">Dưới ngưỡng</span>
                </div>
              </div>

            </div>



            {/* PERFORMANCE ANALYSIS SUMMARY HEADER */}
            <div className="bg-slate-800 text-white p-4 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
              <div className="flex items-center space-x-3">
                <FileSpreadsheet className="w-5 h-5 text-blue-400 shrink-0" />
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider">Màn hình Báo cáo Chỉ tiêu</h4>
                  <p className="text-[11px] text-slate-300 mt-0.5">Phân tích thực hiện tháng và lũy kế YTD theo định dạng bảng P&L chuẩn tại <b>{currentCenter?.name}</b></p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleExportPPTX(selectedCenterId)}
                  className="flex items-center space-x-1.5 bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white text-xs font-bold px-3 py-1.5 rounded transition-all shadow-xs cursor-pointer"
                  title={`Xuất slide PowerPoint cho riêng ${currentCenter?.name}`}
                >
                  <Presentation className="w-3.5 h-3.5" />
                  <span>PPTX {currentCenter?.name}</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleExportPPTX("all")}
                  className="flex items-center space-x-1.5 bg-slate-700 hover:bg-slate-600 active:bg-slate-800 text-white text-xs font-bold px-3 py-1.5 rounded border border-slate-600 transition-all shadow-xs cursor-pointer"
                  title="Xuất slide PowerPoint cho tất cả trung tâm gộp chung"
                >
                  <Presentation className="w-3.5 h-3.5 text-blue-300" />
                  <span>PPTX Toàn bộ</span>
                </button>
                <div className="text-right hidden xl:block">
                  <span className="text-[11px] font-bold uppercase bg-slate-750 px-2 py-1.5 rounded text-blue-300 border border-slate-700">Tài khóa {selectedYear}</span>
                </div>
              </div>
            </div>

            {/* OPERATIONS DATA TABLE (Clean layout aligned perfectly like design sheet) */}
            <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#f8fafc] border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">
                      <th className="py-3 px-6 h-12 w-1/4">KẾT QUẢ HOẠT ĐỘNG (VNĐ)</th>
                      <th className="py-3 px-4 text-right">TH THÁNG {selectedMonth}</th>
                      <th className="py-3 px-4 text-right">KH THÁNG {selectedMonth}</th>
                      <th className="py-3 px-4 text-right">TH LŨY KẾ</th>
                      <th className="py-3 px-4 text-right">KH LŨY KẾ</th>
                      <th className="py-3 px-4 text-right">TH-KH (LK)</th>
                      <th className="py-3 px-4 text-right">% TH/KH</th>
                      <th className="py-3 px-6 text-center">PHÂN TÍCH</th>
                    </tr>
                  </thead>
                  <tbody className="text-[12.5px] divide-y divide-slate-150">
                    
                    {/* I. DOANH THU */}
                    <tr className="bg-[#f1f5f9] font-bold text-slate-900">
                      <td className="py-3 px-6 font-bold text-blue-900 uppercase">I. DOANH THU</td>
                      <td className="py-3 px-4 text-right font-semibold">{formatCurrency(totals.revenue.actualMonth)}</td>
                      <td className="py-3 px-4 text-right font-semibold text-slate-500">{formatCurrency(totals.revenue.budgetMonth)}</td>
                      <td className="py-3 px-4 text-right font-bold text-slate-900">{formatCurrency(totals.revenue.actualYTD)}</td>
                      <td className="py-3 px-4 text-right font-semibold text-slate-500">{formatCurrency(totals.revenue.budgetYTD)}</td>
                      <td className="py-3 px-4 text-right font-semibold">
                        {renderVarianceCell(totals.revenue.actualYTD, totals.revenue.budgetYTD, false)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {renderPercentCell(totals.revenue.actualYTD, totals.revenue.budgetYTD)}
                      </td>
                      <td className="py-3 px-6 text-center">
                        {renderAnalysisCell(
                          "revenue",
                          "I. DOANH THU",
                          getVariancePercent(totals.revenue.actualYTD, totals.revenue.budgetYTD),
                          totals.revenue.actualYTD - totals.revenue.budgetYTD,
                          true
                        )}
                      </td>
                    </tr>

                    {/* REVENUE INDICATORS ITEMS */}
                    {revenueIndicators.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-3 px-8 text-xs text-slate-400 italic">Chưa khai báo chỉ tiêu doanh thu nào áp dụng cho trung tâm này.</td>
                      </tr>
                    ) : (
                      revenueIndicators.map((ind) => {
                        const row = computedTableRows.find((r) => r.id === ind.id);
                        if (!row) return null;
                        const isDragOver = dragOverIndicatorId === ind.id;
                        const isDragging = draggedIndicatorId === ind.id;
                        return (
                          <tr 
                            key={ind.id} 
                            draggable
                            onDragStart={(e) => {
                              setDraggedIndicatorId(ind.id);
                              e.dataTransfer.effectAllowed = "move";
                              e.dataTransfer.setData("text/plain", ind.id);
                            }}
                            onDragOver={(e) => {
                              e.preventDefault();
                              if (draggedIndicatorId !== ind.id) {
                                setDragOverIndicatorId(ind.id);
                              }
                            }}
                            onDragLeave={() => {
                              if (dragOverIndicatorId === ind.id) {
                                setDragOverIndicatorId(null);
                              }
                            }}
                            onDragEnd={() => {
                              setDraggedIndicatorId(null);
                              setDragOverIndicatorId(null);
                            }}
                            onDrop={(e) => {
                              e.preventDefault();
                              const draggedId = e.dataTransfer.getData("text/plain");
                              handleIndicatorDragAndDrop(draggedId, ind.id);
                              setDraggedIndicatorId(null);
                              setDragOverIndicatorId(null);
                            }}
                            className={`transition-all ${
                              isDragOver ? "bg-blue-50/70 border-t-2 border-dashed border-blue-400 animate-pulse" : "hover:bg-slate-50"
                            } ${isDragging ? "opacity-30 bg-slate-100" : "transition-colors"}`}
                          >
                            <td className="py-2.5 px-8 text-slate-700 flex items-center space-x-2 select-none">
                              <GripVertical className="w-3.5 h-3.5 text-slate-400 cursor-grab active:cursor-grabbing hover:text-slate-600 shrink-0" />
                              <span className="cursor-grab active:cursor-grabbing font-medium">{ind.name}</span>
                            </td>
                            <td className="py-2.5 px-4 text-right text-slate-600">{formatCurrency(row.actualMonth)}</td>
                            <td className="py-2.5 px-4 text-right text-slate-400">{formatCurrency(row.budgetMonth)}</td>
                            <td className="py-2.5 px-4 text-right font-medium text-slate-800">{formatCurrency(row.actualYTD)}</td>
                            <td className="py-2.5 px-4 text-right text-slate-400">{formatCurrency(row.budgetYTD)}</td>
                            <td className="py-2.5 px-4 text-right">
                              {renderVarianceCell(row.actualYTD, row.budgetYTD, false)}
                            </td>
                            <td className="py-2.5 px-4 text-right">
                              {renderPercentCell(row.actualYTD, row.budgetYTD)}
                            </td>
                            <td className="py-2.5 px-6 text-center text-xs">
                              {renderAnalysisCell(ind.id, ind.name, row.variancePercent, row.variance)}
                            </td>
                          </tr>
                        );
                      })
                    )}

                    {/* II. CHI PHÍ */}
                    <tr className="bg-[#f1f5f9] font-bold text-slate-900">
                      <td className="py-3 px-6 font-bold text-red-900 uppercase">II. CHI PHÍ</td>
                      <td className="py-3 px-4 text-right font-semibold">{formatCurrency(totals.totalCost.actualMonth)}</td>
                      <td className="py-3 px-4 text-right font-semibold text-slate-500">{formatCurrency(totals.totalCost.budgetMonth)}</td>
                      <td className="py-3 px-4 text-right font-bold text-slate-900">{formatCurrency(totals.totalCost.actualYTD)}</td>
                      <td className="py-3 px-4 text-right font-semibold text-slate-500">{formatCurrency(totals.totalCost.budgetYTD)}</td>
                      <td className="py-3 px-4 text-right font-semibold">
                        {renderVarianceCell(totals.totalCost.actualYTD, totals.totalCost.budgetYTD, true)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {renderPercentCell(totals.totalCost.actualYTD, totals.totalCost.budgetYTD)}
                      </td>
                      <td className="py-3 px-6 text-center">
                        {renderAnalysisCell(
                          "cost",
                          "II. CHI PHÍ",
                          getVariancePercent(totals.totalCost.actualYTD, totals.totalCost.budgetYTD),
                          totals.totalCost.actualYTD - totals.totalCost.budgetYTD,
                          true
                        )}
                      </td>
                    </tr>

                    {/* 1. CHI PHÍ CỐ ĐỊNH */}
                    <tr className="bg-[#f8fafc] font-bold text-slate-700">
                      <td className="py-2.5 px-8 font-bold uppercase text-slate-600">1. CHI PHÍ CỐ ĐỊNH</td>
                      <td className="py-2.5 px-4 text-right font-semibold">{formatCurrency(totals.fixedCost.actualMonth)}</td>
                      <td className="py-2.5 px-4 text-right text-slate-400">{formatCurrency(totals.fixedCost.budgetMonth)}</td>
                      <td className="py-2.5 px-4 text-right font-bold text-slate-700">{formatCurrency(totals.fixedCost.actualYTD)}</td>
                      <td className="py-2.5 px-4 text-right text-slate-400">{formatCurrency(totals.fixedCost.budgetYTD)}</td>
                      <td className="py-2.5 px-4 text-right">
                        {renderVarianceCell(totals.fixedCost.actualYTD, totals.fixedCost.budgetYTD, true)}
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        {renderPercentCell(totals.fixedCost.actualYTD, totals.fixedCost.budgetYTD)}
                      </td>
                      <td className="py-2.5 px-6 text-center">
                        {renderAnalysisCell(
                          "fixed_cost",
                          "1. CHI PHÍ CỐ ĐỊNH",
                          getVariancePercent(totals.fixedCost.actualYTD, totals.fixedCost.budgetYTD),
                          totals.fixedCost.actualYTD - totals.fixedCost.budgetYTD,
                          true
                        )}
                      </td>
                    </tr>

                    {/* FIXED COST ITEMS */}
                    {fixedCostIndicators.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-2 px-10 text-xs text-slate-400 italic">Chưa gán chi phí cố định nào.</td>
                      </tr>
                    ) : (
                      fixedCostIndicators.map((ind) => {
                        const row = computedTableRows.find((r) => r.id === ind.id);
                        if (!row) return null;
                        const isDragOver = dragOverIndicatorId === ind.id;
                        const isDragging = draggedIndicatorId === ind.id;
                        return (
                          <tr 
                            key={ind.id} 
                            draggable
                            onDragStart={(e) => {
                              setDraggedIndicatorId(ind.id);
                              e.dataTransfer.effectAllowed = "move";
                              e.dataTransfer.setData("text/plain", ind.id);
                            }}
                            onDragOver={(e) => {
                              e.preventDefault();
                              if (draggedIndicatorId !== ind.id) {
                                setDragOverIndicatorId(ind.id);
                              }
                            }}
                            onDragLeave={() => {
                              if (dragOverIndicatorId === ind.id) {
                                setDragOverIndicatorId(null);
                              }
                            }}
                            onDragEnd={() => {
                              setDraggedIndicatorId(null);
                              setDragOverIndicatorId(null);
                            }}
                            onDrop={(e) => {
                              e.preventDefault();
                              const draggedId = e.dataTransfer.getData("text/plain");
                              handleIndicatorDragAndDrop(draggedId, ind.id);
                              setDraggedIndicatorId(null);
                              setDragOverIndicatorId(null);
                            }}
                            className={`transition-all ${
                              isDragOver ? "bg-blue-50/70 border-t-2 border-dashed border-blue-400 animate-pulse" : "hover:bg-slate-50"
                            } ${isDragging ? "opacity-30 bg-slate-100" : "transition-colors"}`}
                          >
                            <td className="py-2 px-10 text-slate-700 flex items-center space-x-2 select-none">
                              <GripVertical className="w-3.5 h-3.5 text-slate-400 cursor-grab active:cursor-grabbing hover:text-slate-600 shrink-0" />
                              <span className="cursor-grab active:cursor-grabbing font-medium">{ind.name}</span>
                              {ind.subtype === "depreciation" && (
                                <span className="text-[9.5px] text-blue-500 bg-blue-50 px-1 rounded uppercase font-mono shrink-0">Khấu hao</span>
                              )}
                              {ind.subtype === "interest" && (
                                <span className="text-[9.5px] text-purple-500 bg-purple-50 px-1 rounded uppercase font-mono shrink-0">Lãi vay</span>
                              )}
                            </td>
                            <td className="py-2 px-4 text-right text-slate-650">{formatCurrency(row.actualMonth)}</td>
                            <td className="py-2 px-4 text-right text-slate-400">{formatCurrency(row.budgetMonth)}</td>
                            <td className="py-2 px-4 text-right font-medium text-slate-800">{formatCurrency(row.actualYTD)}</td>
                            <td className="py-2 px-4 text-right text-slate-400">{formatCurrency(row.budgetYTD)}</td>
                            <td className="py-2 px-4 text-right">
                              {renderVarianceCell(row.actualYTD, row.budgetYTD, true)}
                            </td>
                            <td className="py-2 px-4 text-right">
                              {renderPercentCell(row.actualYTD, row.budgetYTD)}
                            </td>
                            <td className="py-2 px-6 text-center text-xs">
                              {renderAnalysisCell(ind.id, ind.name, row.variancePercent, row.variance)}
                            </td>
                          </tr>
                        );
                      })
                    )}

                    {/* 2. CHI PHÍ BIẾN ĐỔI */}
                    <tr className="bg-[#f8fafc] font-bold text-slate-700">
                      <td className="py-2.5 px-8 font-bold uppercase text-slate-600">2. CHI PHÍ BIẾN ĐỔI</td>
                      <td className="py-2.5 px-4 text-right font-semibold">{formatCurrency(totals.variableCost.actualMonth)}</td>
                      <td className="py-2.5 px-4 text-right text-slate-400">{formatCurrency(totals.variableCost.budgetMonth)}</td>
                      <td className="py-2.5 px-4 text-right font-bold text-slate-700">{formatCurrency(totals.variableCost.actualYTD)}</td>
                      <td className="py-2.5 px-4 text-right text-slate-400">{formatCurrency(totals.variableCost.budgetYTD)}</td>
                      <td className="py-2.5 px-4 text-right">
                        {renderVarianceCell(totals.variableCost.actualYTD, totals.variableCost.budgetYTD, true)}
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        {renderPercentCell(totals.variableCost.actualYTD, totals.variableCost.budgetYTD)}
                      </td>
                      <td className="py-2.5 px-6 text-center">
                        {renderAnalysisCell(
                          "variable_cost",
                          "2. CHI PHÍ BIẾN ĐỔI",
                          getVariancePercent(totals.variableCost.actualYTD, totals.variableCost.budgetYTD),
                          totals.variableCost.actualYTD - totals.variableCost.budgetYTD,
                          true
                        )}
                      </td>
                    </tr>

                    {/* VARIABLE COST ITEMS */}
                    {variableCostIndicators.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-2 px-10 text-xs text-slate-400 italic">Chưa gán chi phí biến đổi nào.</td>
                      </tr>
                    ) : (
                      variableCostIndicators.map((ind) => {
                        const row = computedTableRows.find((r) => r.id === ind.id);
                        if (!row) return null;
                        const isDragOver = dragOverIndicatorId === ind.id;
                        const isDragging = draggedIndicatorId === ind.id;
                        return (
                          <tr 
                            key={ind.id} 
                            draggable
                            onDragStart={(e) => {
                              setDraggedIndicatorId(ind.id);
                              e.dataTransfer.effectAllowed = "move";
                              e.dataTransfer.setData("text/plain", ind.id);
                            }}
                            onDragOver={(e) => {
                              e.preventDefault();
                              if (draggedIndicatorId !== ind.id) {
                                setDragOverIndicatorId(ind.id);
                              }
                            }}
                            onDragLeave={() => {
                              if (dragOverIndicatorId === ind.id) {
                                setDragOverIndicatorId(null);
                              }
                            }}
                            onDragEnd={() => {
                              setDraggedIndicatorId(null);
                              setDragOverIndicatorId(null);
                            }}
                            onDrop={(e) => {
                              e.preventDefault();
                              const draggedId = e.dataTransfer.getData("text/plain");
                              handleIndicatorDragAndDrop(draggedId, ind.id);
                              setDraggedIndicatorId(null);
                              setDragOverIndicatorId(null);
                            }}
                            className={`transition-all ${
                              isDragOver ? "bg-blue-50/70 border-t-2 border-dashed border-blue-400 animate-pulse" : "hover:bg-slate-50"
                            } ${isDragging ? "opacity-30 bg-slate-100" : "transition-colors"}`}
                          >
                            <td className="py-2 px-10 text-slate-700 flex items-center space-x-2 select-none">
                              <GripVertical className="w-3.5 h-3.5 text-slate-400 cursor-grab active:cursor-grabbing hover:text-slate-600 shrink-0" />
                              <span className="cursor-grab active:cursor-grabbing font-medium">{ind.name}</span>
                            </td>
                            <td className="py-2 px-4 text-right text-slate-650">{formatCurrency(row.actualMonth)}</td>
                            <td className="py-2 px-4 text-right text-slate-400">{formatCurrency(row.budgetMonth)}</td>
                            <td className="py-2 px-4 text-right font-medium text-slate-800">{formatCurrency(row.actualYTD)}</td>
                            <td className="py-2 px-4 text-right text-slate-400">{formatCurrency(row.budgetYTD)}</td>
                            <td className="py-2 px-4 text-right">
                              {renderVarianceCell(row.actualYTD, row.budgetYTD, true)}
                            </td>
                            <td className="py-2 px-4 text-right">
                              {renderPercentCell(row.actualYTD, row.budgetYTD)}
                            </td>
                            <td className="py-2 px-6 text-center text-xs">
                              {renderAnalysisCell(ind.id, ind.name, row.variancePercent, row.variance)}
                            </td>
                          </tr>
                        );
                      })
                    )}

                    {/* III. LỢI NHUẬN */}
                    <tr className="bg-[#f0f9ff] font-bold text-slate-900 border-t-2 border-slate-300">
                      <td className="py-3 px-6 font-bold text-blue-900 uppercase">III. LỢI NHUẬN RÒNG</td>
                      <td className="py-3 px-4 text-right font-bold">{formatCurrency(totals.profit.actualMonth)}</td>
                      <td className="py-3 px-4 text-right font-semibold text-slate-500">{formatCurrency(totals.profit.budgetMonth)}</td>
                      <td className="py-3 px-4 text-right font-black text-slate-900">{formatCurrency(totals.profit.actualYTD)}</td>
                      <td className="py-3 px-4 text-right font-semibold text-slate-500">{formatCurrency(totals.profit.budgetYTD)}</td>
                      <td className="py-3 px-4 text-right font-semibold">
                        {renderVarianceCell(totals.profit.actualYTD, totals.profit.budgetYTD, false)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {renderPercentCell(totals.profit.actualYTD, totals.profit.budgetYTD)}
                      </td>
                      <td className="py-3 px-6 text-center">
                        {renderAnalysisCell(
                          "profit",
                          "III. LỢI NHUẬN RÒNG",
                          getVariancePercent(totals.profit.actualYTD, totals.profit.budgetYTD),
                          totals.profit.actualYTD - totals.profit.budgetYTD,
                          true
                        )}
                      </td>
                    </tr>

                    {/* IV. EBITDA */}
                    <tr className="bg-[#fdf4ff] font-bold text-slate-950 border-t border-slate-300">
                      <td className="py-3 px-6 font-semibold text-purple-950 uppercase flex items-center space-x-1">
                        <span className="font-extrabold text-blue-900">IV. EBITDA</span>
                        <span className="text-[10px] text-slate-400 font-normal lowercase italic">(Lợi nhuận + Khấu hao + Lãi vay)</span>
                      </td>
                      <td className="py-3 px-4 text-right font-bold">{formatCurrency(totals.ebitda.actualMonth)}</td>
                      <td className="py-3 px-4 text-right font-semibold text-slate-500">{formatCurrency(totals.ebitda.budgetMonth)}</td>
                      <td className="py-3 px-4 text-right font-black text-slate-950">{formatCurrency(totals.ebitda.actualYTD)}</td>
                      <td className="py-3 px-4 text-right font-semibold text-slate-500">{formatCurrency(totals.ebitda.budgetYTD)}</td>
                      <td className="py-3 px-4 text-right font-semibold">
                        {renderVarianceCell(totals.ebitda.actualYTD, totals.ebitda.budgetYTD, false)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {renderPercentCell(totals.ebitda.actualYTD, totals.ebitda.budgetYTD)}
                      </td>
                      <td className="py-3 px-6 text-center">
                        {renderAnalysisCell(
                          "ebitda",
                          "IV. EBITDA",
                          getVariancePercent(totals.ebitda.actualYTD, totals.ebitda.budgetYTD),
                          totals.ebitda.actualYTD - totals.ebitda.budgetYTD,
                          true
                        )}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* THUYẾT MINH & GIẢI TRÌNH BIẾN ĐỘNG (Relocated below the reports table) */}
            <div className="bg-slate-50 rounded-lg border border-slate-200 p-5 mt-6 mb-2 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <div className="flex items-center space-x-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse"></span>
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider font-sans">
                    Thuyết minh & Giải trình Biến động Chỉ tiêu &gt; 10% (Tháng {selectedMonth}/{selectedYear})
                  </h4>
                </div>
                <span className="text-[10px] text-slate-400 font-mono font-semibold bg-white border border-slate-150 px-2 py-0.5 rounded-full">
                  {getFluctuatedItems().length} chỉ tiêu / hạng mục cần thuyết minh
                </span>
              </div>

              {(() => {
                const fluctuatedItems = getFluctuatedItems();
                
                if (fluctuatedItems.length === 0) {
                  return (
                    <p className="text-xs text-slate-500 italic pb-1">
                      Không có chỉ tiêu nào có biến động vượt ngưỡng 10% trong tháng này.
                    </p>
                  );
                }

                return (
                  <div className="grid grid-cols-1 gap-3">
                    {fluctuatedItems.map((item) => {
                      const commentKey = `${selectedCenterId}_${selectedYear}_${selectedMonth}_${item.id}`;
                      const comment = explanations[commentKey];
                      return (
                        <div key={item.id} className="bg-white p-3.5 rounded-lg border border-slate-200 hover:border-slate-350 transition-colors shadow-3xs flex flex-col md:flex-row md:items-start md:justify-between gap-3 animate-fade-in">
                          <div className="space-y-1 ml-1 text-left">
                            <div className="flex items-center space-x-2 flex-wrap gap-1.5">
                              <span className="text-xs font-bold text-slate-800">{item.name}</span>
                              <span className="text-[10px] text-slate-400 uppercase font-mono bg-slate-50 px-1 border border-slate-100 rounded">({item.typeString})</span>
                              <span className="px-1.5 py-0.5 rounded text-[9.5px] font-sans font-bold bg-rose-50 text-rose-700 ring-1 ring-rose-100 shadow-3xs">
                                Lệch %: {formatPercent(item.variancePercent)}
                              </span>
                              <span className="text-[10.5px] text-slate-600 font-sans font-medium">
                                Biến động: {item.variance >= 0 ? "+" : ""}{formatCurrency(item.variance)}
                              </span>
                            </div>
                            
                            {comment ? (
                              <p className="text-xs text-slate-650 bg-slate-50/50 p-2.5 rounded border-l-2 border-emerald-500 italic leading-relaxed whitespace-pre-line mt-1.5">
                                {comment}
                              </p>
                            ) : (
                              <p className="text-xs text-rose-600/90 font-medium italic p-2 rounded border-l-2 border-rose-300 bg-rose-50/30 flex items-center space-x-1 px-2.5 mt-1.5">
                                <span className="mr-1">⚠️</span>
                                <span>Chưa cập nhật nội dung giải trình biến động. Chọn bút bên phải để nhập thuyết minh.</span>
                              </p>
                            )}
                          </div>

                          <button
                            onClick={() => {
                              setPopupCommentText(comment || "");
                              setActivePopupIndicator({
                                id: item.id,
                                name: item.name,
                                pct: item.variancePercent,
                                variance: item.variance,
                                isCategory: item.isCategory || false
                              });
                            }}
                            className="shrink-0 flex items-center space-x-1.5 text-[11px] font-bold text-slate-700 hover:text-blue-650 hover:bg-slate-100 px-3 py-1.5 rounded-md transition-all self-end md:self-start border border-slate-200 bg-slate-50 hover:border-slate-300 cursor-pointer shadow-3xs hover:shadow-2xs active:scale-95"
                          >
                            <Edit2 className="w-3.5 h-3.5 text-slate-500" />
                            <span>{comment ? "Sửa" : "Nhập giải trình"}</span>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>

            {/* BRIEF SYSTEM HELP AND USABLE ADVICE */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div className="bg-white p-5 rounded-lg border border-slate-200">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Cách tính chỉ số EBITDA</h4>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Chỉ số <b>EBITDA</b> (Lợi nhuận trước thuế, khấu hao và lãi vay) trong hệ thống được tính toán tự động bằng cách cộng ngược lại phần <b>Khấu hao TSCĐ</b> và <b>Lãi vay ngân hàng</b> vào kết quả <b>Lợi nhuận ròng</b> đã hạch toán. Bạn có thể khai báo chỉ tiêu tài chính là chỉ tiêu tính khấu hao hoặc tính lãi vay tại Tab <i>Khai báo</i>.
                </p>
              </div>
              <div className="bg-white p-5 rounded-lg border border-slate-200 flex flex-col justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Trợ giúp nhanh hạch toán dữ liệu</h4>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Nếu bạn thấy bảng số liệu hiển thị bằng không (0), điều này có nghĩa là trung tâm này chưa có bản ghi hạch toán phù hợp cho tháng hiện tại. Nhấn nút <b>Nhập liệu</b> trên thanh điều hướng để điền thông số hạch toán nhanh chóng.
                  </p>
                </div>
              </div>
            </div>

          </div>
        )}

        {/* ======================= TAB 2: NHẬP LIỆU (INPUT FORM - SPREADSHEET STYLE) ======================= */}
        {currentTab === "input" && (
          <div className="w-full space-y-4 animate-fade-in">
            {/* SPREADSHEET CARD */}
            <div className="w-full bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
              {/* Control Header */}
              <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex items-center space-x-2">
                    <Database className="w-5 h-5 text-blue-600" />
                    <div>
                      <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">Hạch toán Dữ liệu Hoạt động</h2>
                      <p className="text-[10.5px] text-slate-450 mt-0.5">Bảng nhập liệu 12 tháng liên tục cho từng trung tâm tài chính</p>
                    </div>
                  </div>

                  <div className="h-6 w-px bg-slate-200 hidden md:block" />

                  {/* Dynamic Dropdowns inside sheet view */}
                  <div className="flex items-center space-x-3 text-xs">
                    <div className="flex items-center space-x-1.5">
                      <span className="font-bold text-slate-500 uppercase tracking-wider font-mono text-[10px]">Năm:</span>
                      <select
                        value={selectedYear}
                        onChange={(e) => setSelectedYear(e.target.value)}
                        className="px-2 py-1 flex items-center font-bold text-slate-800 border border-slate-200 rounded bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                      >
                        {years.map((y) => (
                          <option key={y.value} value={y.value}>
                            {y.value}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex items-center space-x-1.5">
                      <span className="font-bold text-slate-500 uppercase tracking-wider font-mono text-[10px]">Trung Tâm:</span>
                      <select
                        value={selectedCenterId}
                        onChange={(e) => setSelectedCenterId(e.target.value)}
                        className="px-2 py-1 flex items-center font-bold text-slate-800 border border-slate-200 rounded bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                      >
                        {centers.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Mode selection + Import Export Excel Templates */}
                <div className="flex flex-wrap items-center gap-2">
                  {/* Mode selectors */}
                  <div className="flex items-center space-x-1 bg-slate-250/50 bg-slate-200/50 p-1 rounded-lg border border-slate-200">
                    <button
                      type="button"
                      onClick={() => setInputGridType("actual")}
                      className={`px-3 py-1.5 rounded text-xs font-bold transition-all cursor-pointer ${
                        inputGridType === "actual"
                          ? "bg-slate-900 text-white shadow-xs"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      Số Thực tế
                    </button>
                    <button
                      type="button"
                      onClick={() => setInputGridType("budget")}
                      className={`px-3 py-1.5 rounded text-xs font-bold transition-all cursor-pointer ${
                        inputGridType === "budget"
                          ? "bg-slate-900 text-white shadow-xs"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      Số Kế hoạch
                    </button>
                  </div>

                  <div className="h-5 w-px bg-slate-200 hidden sm:block" />

                  {/* Excel Interactions */}
                  <button
                    type="button"
                    onClick={handleExportExcelTemplate}
                    className="flex items-center space-x-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                    title="Tải tệp mẫu Excel"
                  >
                    <Download className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Mẫu Excel</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center space-x-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                    title="Tải lên tệp Excel dữ liệu"
                  >
                    <Upload className="w-3.5 h-3.5 text-blue-600" />
                    <span>Nhập Excel</span>
                  </button>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleImportExcelTemplate}
                    accept=".xlsx,.xls"
                    className="hidden"
                  />
                </div>
              </div>

              {/* Main Spreadsheet Grid body */}
              {/* Drag & drop zone overlay for XLSX */}
              <div 
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const file = e.dataTransfer.files?.[0];
                  if (file && (file.name.endsWith(".xlsx") || file.name.endsWith(".xls"))) {
                    const fakeEvent = { target: { files: [file] } } as any;
                    handleImportExcelTemplate(fakeEvent);
                  } else {
                    showToast("Vui lòng kéo thả tệp Excel hợp lệ (.xlsx hoặc .xls)", "error");
                  }
                }}
                className="flex-1 overflow-x-auto min-h-[300px]"
              >
                <table className="w-full border-collapse text-left select-none text-xs">
                  <thead>
                    {/* Top title info mirroring the uploaded layout image */}
                    <tr className="bg-slate-100">
                      <th colSpan={15} className="p-3 border-b border-slate-200">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between font-mono text-[11px] text-slate-550 font-semibold px-2 gap-2">
                          <div className="flex items-center space-x-1">
                            <span>Năm:</span>
                            <span className="text-slate-900 font-bold text-xs bg-white px-2 py-0.5 rounded border border-slate-200">{selectedYear}</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <span>Đang chọn:</span>
                            <span className="text-slate-900 font-bold text-xs bg-white px-2 py-0.5 rounded border border-slate-200">{currentCenter?.name}</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <span>Loại số liệu:</span>
                            <span className="text-blue-700 font-bold text-xs uppercase tracking-wider bg-blue-50 px-2.5 py-0.5 rounded border border-blue-200">
                              {inputGridType === "actual" ? "Thực tế" : "Kế hoạch"}
                            </span>
                          </div>
                        </div>
                      </th>
                    </tr>
                    
                    {/* Actual headers */}
                    <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold font-mono text-[11px] uppercase tracking-wider">
                      <th className="p-3 border-r border-slate-200 min-w-[220px] text-left">Chỉ tiêu</th>
                      {Array.from({ length: 12 }).map((_, i) => (
                        <th key={i} className="p-3 border-r border-slate-200 min-w-[110px] text-center">Tháng {i + 1}</th>
                      ))}
                      <th className="p-3 min-w-[130px] text-right font-bold text-slate-800 bg-slate-100/50">Tổng cộng</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeIndicators.length === 0 ? (
                      <tr>
                        <td colSpan={15} className="p-12 text-center italic text-slate-400 bg-slate-50/50">
                          Chưa có chỉ tiêu tài chính nào áp dụng cho trung tâm &quot;{currentCenter?.name}&quot;. 
                          Vui lòng chuyển qua tab <b>Khai báo</b> để kích hoạt hoặc thêm chỉ tiêu.
                        </td>
                      </tr>
                    ) : (
                      activeIndicators.map((ind) => {
                        const rowTotal = getDraftRowTotal(ind.id, inputGridType);
                        
                        return (
                          <tr key={ind.id} className="border-b border-slate-150 hover:bg-slate-55/30 hover:bg-slate-50/30 transition-colors">
                            <td className="p-2 border-r border-slate-150 bg-slate-200/5 bg-slate-50/10">
                              <div className="font-bold text-slate-800">{ind.name}</div>
                              <div className="text-[9.5px] uppercase font-mono tracking-wider text-slate-400 mt-0.5 font-semibold">
                                {ind.type === "revenue" ? "Doanh thu" : ind.type === "fixed_cost" ? "Chi phí cố định" : "Chi phí biến đổi"}
                                {ind.subtype === "depreciation" && " • Khấu hao"}
                                {ind.subtype === "interest" && " • Lãi vay"}
                              </div>
                            </td>
                            
                            {/* 12 Month editable cells */}
                            {Array.from({ length: 12 }).map((_, i) => {
                              const m = i + 1;
                              const cellObj = draftGrid[ind.id]?.[m] || { actual: "0", budget: "0" };
                              const cellVal = inputGridType === "actual" ? cellObj.actual : cellObj.budget;
                              
                              return (
                                <td key={i} className="p-1 border-r border-slate-150 align-middle focus-within:bg-blue-50/30">
                                  <div className="flex flex-col justify-center">
                                    <input
                                      type="text"
                                      value={formatDraftCellValue(cellVal)}
                                      onChange={(e) => handleDraftGridCellChange(ind.id, m, inputGridType, e.target.value)}
                                      placeholder="0"
                                      className="w-full text-right text-xs bg-transparent border-b border-slate-100 hover:border-slate-300 focus:border-blue-500 hover:bg-slate-50/50 px-1 py-1 focus:outline-none rounded font-sans font-bold text-slate-800"
                                    />
                                    {/* Compact compact formatted label inside cell to avoid confusion */}
                                    <span className="text-[9px] text-slate-400 text-right pr-1 mt-0.5 font-sans pointer-events-none">
                                      {formatInputLabel(cellVal || "0").replace(/[()]/g, "") || "-"}
                                    </span>
                                  </div>
                                </td>
                              );
                            })}

                            {/* Row Sum Column */}
                            <td className="p-2 text-right font-sans font-bold text-slate-900 bg-slate-100/30 align-middle">
                              <div className="text-slate-800 text-xs">{formatCurrency(rowTotal)}</div>
                              <div className="text-[9.5px] text-slate-450 italic font-sans font-normal mt-0.5">
                                ({formatCurrency(rowTotal, true)})
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Footer Actions */}
              <div className="p-4 bg-slate-100/50 border-t border-slate-200 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="text-xs text-slate-500 italic max-w-lg">
                  💡 <b>Kéo thả file mẫu:</b> Bạn có thể xuất <b>Mẫu Excel</b>, điền số liệu cả 2 bảng Thực tế/Kế hoạch rồi kéo thả tệp tin bất cứ đâu vào lưới trên để điền nhanh dữ liệu.
                </div>
                
                <div className="flex flex-wrap items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={handleAutoFillGridMockValues}
                    className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-250 rounded-lg text-xs font-bold transition-all cursor-pointer"
                  >
                    Tự sinh số mẫu (Full 12 tháng)
                  </button>
                  
                  <button
                    type="button"
                    onClick={() => setCurrentTab("report")}
                    className="px-4 py-2 text-xs font-semibold text-slate-650 hover:text-slate-900 border border-slate-200 rounded-lg hover:bg-slate-55 transition-all cursor-pointer bg-white"
                  >
                    Hủy & Quay lại
                  </button>
                  
                  <button
                    type="button"
                    onClick={handleSaveGridDataEntry}
                    disabled={activeIndicators.length === 0}
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition-all cursor-pointer shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-1.5"
                  >
                    <Check className="w-4 h-4" />
                    <span>Ghi sổ dữ liệu (Lưu lại)</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ======================= TAB 3: KHAI BÁO (CONFIG) ======================= */}
        {currentTab === "config" && (
          <div className="space-y-6 animate-fade-in">
            
            {/* Top Warning Note */}
            <div className="bg-slate-800 text-white p-5 rounded-lg border border-slate-700">
              <h2 className="text-sm font-bold uppercase tracking-wider mb-1">Thiết lập & Khai báo Thông số Core</h2>
              <p className="text-xs text-slate-300 leading-relaxed">
                Tại đây bạn có thể cấu hình danh mục các <b>Năm phân tích</b>, các <b>Trung tâm chi phí/doanh thu</b> và thiết lập <b>Chỉ tiêu tài chính</b> cụ thể. Chỉ tiêu được phân loại chính xác giúp hệ thống tự động cộng dồn doanh số, ước tính lợi nhuận ròng và chiết khấu EBITDA tự động.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* SECTION A: MANAGE CENTERS */}
              <div className="bg-white p-6 rounded-lg border border-slate-205 border-slate-200 shadow-xs space-y-4">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono">1. Khai báo Trung tâm</h3>
                
                {/* Form Add Center */}
                <form onSubmit={handleAddCenter} className="flex gap-2">
                  <input
                    type="text"
                    value={newCenterName}
                    onChange={(e) => setNewCenterName(e.target.value)}
                    placeholder="Tên trung tâm mới..."
                    className="flex-1 text-xs border border-slate-200 rounded px-3 py-2 bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <button
                    type="submit"
                    className="p-2 bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors cursor-pointer"
                    title="Thêm Trung tâm"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </form>

                {/* Centers List */}
                <div className="divide-y divide-slate-100 max-h-60 overflow-y-auto pr-1">
                  {centers.map((c) => (
                    <div key={c.id} className="py-2 flex items-center justify-between text-xs font-medium">
                      {editingCenterId === c.id ? (
                        <div className="flex items-center space-x-1.5 w-full">
                          <input
                            type="text"
                            value={editingCenterName}
                            onChange={(e) => setEditingCenterName(e.target.value)}
                            className="flex-1 text-xs border border-blue-400 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                          />
                          <button
                            type="button"
                            onClick={() => handleUpdateCenter(c.id)}
                            className="p-1 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded cursor-pointer"
                            title="Xác nhận lưu"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingCenterId(null);
                              setEditingCenterName("");
                            }}
                            className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded cursor-pointer"
                            title="Hủy"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center space-x-2">
                            <Building2 className="w-3.5 h-3.5 text-slate-400" />
                            <span>{c.name}</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingCenterId(c.id);
                                setEditingCenterName(c.name);
                              }}
                              className="text-slate-400 hover:text-blue-500 transition-colors p-1 cursor-pointer"
                              title="Sửa Trung tâm"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteCenter(c.id, c.name)}
                              className="text-slate-400 hover:text-rose-500 transition-colors p-1 cursor-pointer"
                              title="Xóa Trung tâm"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* SECTION B: MANAGE YEARS */}
              <div className="bg-white p-6 rounded-lg border border-slate-205 border-slate-200 shadow-xs space-y-4">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono">2. Khai báo Năm phân tích</h3>
                
                {/* Form Add Year */}
                <form onSubmit={handleAddYear} className="flex gap-2">
                  <input
                    type="text"
                    value={newYearValue}
                    onChange={(e) => setNewYearValue(e.target.value)}
                    placeholder="Ví dụ: 2027..."
                    maxLength={4}
                    className="flex-1 text-xs border border-slate-200 rounded px-3 py-2 bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                  />
                  <button
                    type="submit"
                    className="p-2 bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors cursor-pointer"
                    title="Khai báo năm"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </form>

                {/* Years List */}
                <div className="divide-y divide-slate-100 max-h-60 overflow-y-auto pr-1">
                  {years.map((y) => (
                    <div key={y.value} className="py-2 flex items-center justify-between text-xs font-mono font-medium">
                      {editingYearValue === y.value ? (
                        <div className="flex items-center space-x-1.5 w-full">
                          <input
                            type="text"
                            value={editingYearNewValue}
                            onChange={(e) => setEditingYearNewValue(e.target.value)}
                            maxLength={4}
                            className="flex-1 text-xs border border-blue-400 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white cursor-text font-mono"
                          />
                          <button
                            type="button"
                            onClick={() => handleUpdateYear(y.value)}
                            className="p-1 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded cursor-pointer"
                            title="Xác nhận lưu"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingYearValue(null);
                              setEditingYearNewValue("");
                            }}
                            className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded cursor-pointer"
                            title="Hủy"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center space-x-2">
                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                            <span>Năm tài chính {y.value}</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingYearValue(y.value);
                                setEditingYearNewValue(y.value);
                              }}
                              className="text-slate-400 hover:text-blue-500 transition-colors p-1 cursor-pointer"
                              title="Sửa Năm"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteYear(y.value)}
                              className="text-slate-400 hover:text-rose-500 transition-colors p-1 cursor-pointer"
                              title="Xóa Năm"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* SECTION C: CONFIGURATION CARD NOTE */}
              <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-xs font-medium text-xs text-slate-550 flex flex-col justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Quy tắc cộng dồn chỉ tiêu</h4>
                  <p className="text-slate-500 leading-relaxed space-y-2">
                    Mỗi chỉ tiêu tài chính bạn thêm vào ở bảng bên dưới sẽ bắt buộc phải gán với phân loại cụ thể:
                  </p>
                  <ul className="list-disc pl-4 space-y-1 mt-2 text-slate-500 text-[11px]">
                    <li><b>Doanh thu:</b> hạch toán bên trên đầu bảng, cộng dồn vào Tổng doanh thu.</li>
                    <li><b>Chi phí cố định (Định phí):</b> như thuê văn phòng, lương khung, khấu hao gán riêng.</li>
                    <li><b>Chi phí biến đổi (Biến phí):</b> như chạy marketing, quảng cáo, nguyên vật liệu.</li>
                  </ul>
                </div>
                <div className="border-t border-slate-100 pt-3 mt-3">
                  <span className="text-[10px] text-slate-400 font-mono uppercase">Vạn năng • Bản ghi tự lưu</span>
                </div>
              </div>

            </div>

            {/* SECTION D: FINANCIAL INDICATORS MANAGEMENTS */}
            <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-xs space-y-6">
              
              <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider font-mono">3. Quản lý Chỉ tiêu Hoạt động (Doanh thu & Chi phí)</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Thêm mới, sửa đổi thông tin chỉ tiêu trực thuộc và tùy biến trung tâm áp dụng.</p>
                </div>
                {editingIndicatorId && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingIndicatorId(null);
                      setNewIndName("");
                      setNewIndCenters(centers.map(c => c.id));
                    }}
                    className="text-xs text-rose-500 font-semibold hover:underline"
                  >
                    Hủy chế độ sửa
                  </button>
                )}
              </div>

              {/* Indicator Editor Form */}
              <form onSubmit={handleSaveIndicator} className="p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-4 text-xs">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  
                  {/* Name Input */}
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">Tên hạng mục chỉ tiêu: *</label>
                    <input
                      type="text"
                      value={newIndName}
                      onChange={(e) => setNewIndName(e.target.value)}
                      placeholder="Ví dụ: Doanh thu Bán hàng, Tiền điện..."
                      className="w-full border border-slate-200 rounded px-2.5 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  {/* Indicator Type */}
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">Phân loại lớn tài chính: *</label>
                    <select
                      value={newIndType}
                      onChange={(e) => {
                        const val = e.target.value as "revenue" | "fixed_cost" | "variable_cost";
                        setNewIndType(val);
                        if (val !== "fixed_cost") setNewIndSubtype("standard");
                      }}
                      className="w-full border border-slate-200 rounded px-2.5 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 font-semibold"
                    >
                      <option value="revenue">Doanh thu (Revenue)</option>
                      <option value="fixed_cost">Chi phí cố định (Fixed Cost)</option>
                      <option value="variable_cost">Chi phí biến đổi (Variable Cost)</option>
                    </select>
                  </div>

                  {/* Operational Subtypes (Active only on Fixed Cost to track structural adjustments) */}
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">
                      Tính chất dòng tiền (Dùng gán EBITDA):
                    </label>
                    <select
                      value={newIndSubtype}
                      onChange={(e) => setNewIndSubtype(e.target.value as any)}
                      disabled={newIndType !== "fixed_cost"}
                      className="w-full border border-slate-200 rounded px-2.5 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-slate-100 disabled:text-slate-400 font-semibold"
                    >
                      <option value="standard">Tiêu chuẩn / Thường</option>
                      <option value="depreciation">Khấu hao tài sản (Cộng ngược vào EBITDA)</option>
                      <option value="interest">Lãi vay ngân hàng (Cộng ngược vào EBITDA)</option>
                    </select>
                  </div>

                </div>

                {/* Centers application Checkbox selections */}
                <div>
                  <label className="block text-slate-650 font-bold mb-1.5">Áp dụng cho các Trung tâm hoạt động sau: *</label>
                  <div className="flex flex-wrap gap-2.5">
                    {centers.map((c) => {
                      const isChecked = newIndCenters.includes(c.id);
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => toggleIndCenterSelection(c.id)}
                          className={`px-3 py-1.5 rounded-md border text-xs font-semibold transition-all flex items-center space-x-1.5 cursor-pointer ${
                            isChecked
                              ? "bg-blue-50 border-blue-400 text-blue-700"
                              : "bg-white border-slate-200 text-slate-600 hover:bg-slate-55"
                          }`}
                        >
                          <span className={`w-2 h-2 rounded-full ${isChecked ? "bg-blue-600" : "bg-slate-300"}`}></span>
                          <span>{c.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Submit Indicator Action button */}
                <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-200/50">
                  <button
                    type="submit"
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded shadow-xs cursor-pointer text-xs"
                  >
                    {editingIndicatorId ? "Cập nhật chỉ tiêu" : "Lưu thêm mới chỉ tiêu"}
                  </button>
                </div>

              </form>

              {/* Indicators Catalog List table */}
              <div className="border border-slate-150 rounded-lg overflow-hidden">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-[#f8fafc] border-b border-slate-150 text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                      <th className="py-2.5 px-4">Tên chỉ tiêu</th>
                      <th className="py-2.5 px-4 text-center">Biểu diễn tài chính</th>
                      <th className="py-2.5 px-4 text-center">Gán EBITDA</th>
                      <th className="py-2.5 px-4">Trung tâm áp dụng</th>
                      <th className="py-2.5 px-4 text-right">Điều khiển</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                    {indicators.map((ind) => (
                      <tr key={ind.id} className="hover:bg-slate-50/50">
                        <td className="py-3 px-4 font-bold text-slate-900">{ind.name}</td>
                        <td className="py-3 px-4 text-center">
                          {ind.type === "revenue" ? (
                            <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-mono uppercase text-[9.5px]">Doanh thu</span>
                          ) : ind.type === "fixed_cost" ? (
                            <span className="text-red-700 bg-red-50 px-2 py-0.5 rounded font-mono uppercase text-[9.5px]">Định phí (Cố định)</span>
                          ) : (
                            <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded font-mono uppercase text-[9.5px]">Biến phí (Biến đổi)</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center text-slate-550 font-mono">
                          {ind.subtype === "depreciation" ? (
                            <span className="text-blue-600 bg-blue-550/10 px-1.5 py-0.5 rounded text-[10px]">Cộng Khấu hao</span>
                          ) : ind.subtype === "interest" ? (
                            <span className="text-purple-600 bg-purple-550/10 px-1.5 py-0.5 rounded text-[10px]">Cộng Lãi vay</span>
                          ) : (
                            <span className="text-slate-400 text-[10px] italic">Thường</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <p className="text-slate-500 text-[11.5px] max-w-sm truncate">
                            {ind.centerIds.map((cId) => centers.find((c) => c.id === cId)?.name).filter(Boolean).join(", ")}
                          </p>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end space-x-1">
                            <button
                              type="button"
                              onClick={() => handleEditIndicatorClick(ind)}
                              className="p-1 text-slate-400 hover:text-blue-500 transition-colors"
                              title="Sửa thông tin chỉ tiêu"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteIndicator(ind.id, ind.name)}
                              className="p-1 text-slate-400 hover:text-rose-500 transition-colors"
                              title="Xóa chỉ tiêu này"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

            </div>

          </div>
        )}

      </main>

      {/* FOOTER METRICS SYSTEM BRANDING */}
      <footer className="bg-[#1e293b] text-slate-400 border-t border-slate-8次 py-8 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-2">
          <p className="text-xs font-bold uppercase tracking-widest text-[#4ade80]">Finance Analysis Pro v1.2.0</p>
          <p className="text-[11px] text-slate-400">Ứng dụng xử lý số liệu doanh thu, định phí, biến phí và đóng gói EBITDA theo thời gian thực.</p>
          <p className="text-[10px] text-slate-500 font-mono mt-4">PHẦN MỀM THUẦN CHẤT KHÔNG TRỮ THÔNG TIN KHÁCH HÀNG TRÊN MÁY CHỦ • BẢO MẬT TUYỆT ĐỐI</p>
        </div>
      </footer>

      {/* POPUP FOR EXPLANATION INPUT on significant variance (>10%) */}
      {activePopupIndicator && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-fade-in">
            <div className="bg-slate-900 text-white px-6 py-4 flex justify-between items-center">
              <div className="flex items-center space-x-2">
                <Edit2 className="w-4 h-4 text-orange-400" />
                <h3 className="font-bold text-sm uppercase tracking-wider">Thuyết minh biến động chỉ tiêu</h3>
              </div>
              <button 
                onClick={() => setActivePopupIndicator(null)} 
                className="text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400 block mb-0.5">Chỉ tiêu</span>
                <h4 className="text-base font-bold text-slate-800">{activePopupIndicator.name}</h4>
              </div>
              
              <div className="grid grid-cols-2 gap-4 bg-slate-50 p-3 rounded-lg border border-slate-150 font-sans text-xs">
                <div>
                  <span className="text-slate-400 block text-[9.5px] uppercase">Biến động (% TH/KH)</span>
                  <span className={`text-sm font-bold ${activePopupIndicator.pct >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                    {formatPercent(activePopupIndicator.pct)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[9.5px] uppercase">Phúng chênh (TH - KH (LK))</span>
                  <span className={`text-sm font-bold ${activePopupIndicator.variance >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                    {activePopupIndicator.variance >= 0 ? "+" : ""}{formatCurrency(activePopupIndicator.variance)}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Nguyên nhân chênh lệch</label>
                <textarea
                  value={popupCommentText}
                  onChange={(e) => setPopupCommentText(e.target.value)}
                  className="w-full text-xs border border-slate-200 rounded-lg p-3 h-32 focus:outline-none focus:ring-2 focus:ring-blue-500 font-sans text-slate-700 leading-relaxed"
                  placeholder="Điền nguyên nhân chủ quan hoặc khách quan giải trình mức biến động trên 10% tại đây..."
                />
              </div>
            </div>

            <div className="bg-slate-50 px-6 py-4 flex justify-end space-x-3 border-t border-slate-100">
              <button
                onClick={() => setActivePopupIndicator(null)}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
              >
                Hủy
              </button>
              <button
                onClick={() => {
                  const key = `${selectedCenterId}_${selectedYear}_${selectedMonth}_${activePopupIndicator.id}`;
                  const updatedExplanations = { ...explanations, [key]: popupCommentText.trim() };
                  setExplanations(updatedExplanations);
                  localStorage.setItem("finance_explanations", JSON.stringify(updatedExplanations));
                  setActivePopupIndicator(null);
                  showToast("Đã ghi nhận thuyết minh cho chỉ tiêu này!", "success");
                }}
                className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors cursor-pointer"
              >
                Lưu giải trình
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
