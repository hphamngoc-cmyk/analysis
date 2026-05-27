import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

// Lazy initialize Gemini client to prevent crashing on boot if key is missing
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error("GEMINI_API_KEY environment variable is not defined.");
    }
    aiClient = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "50mb" }));

  // API endpoint for AI Financial Analysis
  app.post("/api/analyze", async (req, res) => {
    try {
      const { centerName, year, month, metrics, indicators } = req.body;

      if (!centerName || !year || !month) {
        return res.status(400).json({ error: "Missing required fields: centerName, year, month" });
      }

      const prompt = `
Hãy đóng vai trò Giám đốc Tài chính (CFO) chuyên nghiệp. Hãy phân tích kết quả hoạt động kinh doanh sau đây cho:
Trung tâm: ${centerName}
Năm: ${year}
Tháng xem: Tháng ${month}

Số liệu tóm tắt (YTD):
- Tổng Doanh thu Thực tế lũy kế: ${metrics.totalRevenueActual.toLocaleString()} VNĐ
- Tổng Doanh thu Kế hoạch lũy kế: ${metrics.totalRevenueBudget.toLocaleString()} VNĐ
- Tổng Chi phí Thực tế lũy kế: ${metrics.totalCostActual.toLocaleString()} VNĐ
- Tổng Chi phí Kế hoạch lũy kế: ${metrics.totalCostBudget.toLocaleString()} VNĐ
- Lợi nhuận Thực tế lũy kế: ${metrics.profitActual.toLocaleString()} VNĐ
- EBITDA Thực tế lũy kế (Lợi nhuận + Khấu hao + Lãi vay): ${metrics.ebitdaActual.toLocaleString()} VNĐ

Chi tiết các chỉ tiêu (Tháng % {month} và lũy kế):
${indicators.map((ind: any) => `
+ Chỉ tiêu: ${ind.name} (${ind.categoryName})
  - Thực hiện hành tháng: ${ind.actualMonth.toLocaleString()} VNĐ / Kế hoạch tháng: ${ind.budgetMonth.toLocaleString()} VNĐ
  - Thực hiện lũy kế: ${ind.actualYTD.toLocaleString()} VNĐ / Kế hoạch lũy kế: ${ind.budgetYTD.toLocaleString()} VNĐ
  - Chênh lệch lũy kế: ${ind.variance.toLocaleString()} VNĐ (${ind.variancePercent}%)
`).join("\n")}

Hãy phân tích chi tiết:
1. Đánh giá tổng quan về doanh thu và chi phí của Trung tâm này. Nhận xét doanh thu có đạt mục tiêu không, tỷ trọng chi phí cố định so với chi phí biến đổi là thế nào.
2. Điểm sáng hoặc chỉ tiêu vượt trội (nếu có) và Chỉ tiêu nào đang hoạt động kém hiệu quả (vượt chi phí hoặc hụt doanh thu so với kế hoạch).
3. Đưa ra chính xác 3 khuyến nghị ngắn gọn, thực tế và khả thi nhất bằng tiếng Việt để tối ưu dòng tiền, cải thiện EBITDA hoặc tiết giảm chi phí tại trung tâm này.

Hãy phản hồi DUY NHẤT một chuỗi JSON hợp lệ theo cấu trúc sau:
{
  "analysis": "Chi tiết đoạn phân tích tài chính sâu sắc, mạch lạc và súc tích bằng tiếng Việt...",
  "recommendations": [
    "Khuyến nghị 1...",
    "Khuyến nghị 2...",
    "Khuyến nghị 3..."
  ]
}
`;

      let ai;
      try {
        ai = getGeminiClient();
      } catch (err: any) {
        console.error("Gemini API Client error: ", err.message);
        return res.status(200).json({
          analysis: `[Demo Mode] Không tìm thấy API Key (GEMINI_API_KEY) hoặc lỗi khởi tạo. Dưới đây là phân tích mẫu tự động: Trung tâm ${centerName} hoạt động trong tháng ${month}/${year} có Lợi nhuận lũy kế đạt ${metrics.profitActual.toLocaleString()} VNĐ. Chi phí cố định đang chiếm tỷ trọng lớn và cần được kiểm soát chặt chẽ hơn. EBITDA lũy kế đạt mức tốt ${metrics.ebitdaActual.toLocaleString()} VNĐ nhờ việc gán lại các chi phí cấu trúc như khấu hao và lãi vay.`,
          recommendations: [
            "Tập trung cải thiện doanh số bán hàng để gia tăng hiệu suất bù đắp định phí.",
            "Cắt giảm bớt các khoản chi phí biến đổi không thiết yếu trong thời gian ngắn hạn.",
            "Rà soát lại quy trình quản lý khấu hao và thương thảo lại lãi suất ngân hàng để giảm tải áp tài chính."
          ]
        });
      }

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          systemInstruction: "Bạn là một Giám đốc Tài chính (CFO) chuyên nghiệp, luôn sử dụng tiếng Việt tự nhiên và phân tích số liệu tài chính một cách sâu sắc, chính xác.",
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              analysis: {
                type: Type.STRING,
                description: "Đoạn văn phân tích tình hình tài chính súc tích bằng tiếng Việt.",
              },
              recommendations: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "Danh sách 3 đề xuất/hành động cụ thể phục hồi hiệu quả vận hành.",
              }
            },
            required: ["analysis", "recommendations"],
          }
        }
      });

      const responseText = response.text || "{}";
      const cleanedText = responseText.trim();
      const result = JSON.parse(cleanedText);
      res.json(result);
    } catch (error: any) {
      console.error("Error generating analysis:", error);
      res.status(500).json({ error: "Có lỗi xảy ra khi phân tích dữ liệu: " + error.message });
    }
  });

  // Helpers for generating explanation suggestion fallback
  function getFallbackExplanation(indicatorName: string, variance: number, variancePercent: number, centerName: string, month: string, year: string): string {
    const isPositive = variancePercent >= 0;
    const absPct = Math.abs(variancePercent).toFixed(1);
    const isRevenue = indicatorName.toLowerCase().includes("doanh thu");

    if (isRevenue) {
      if (isPositive) {
        return `Doanh thu chỉ tiêu "${indicatorName}" tại ${centerName} trong tháng ${month}/${year} đạt mức tăng trưởng tốt (+${absPct}%), vượt mức phân bổ ngân sách. Nguyên nhân chủ yếu nhờ triển khai hiệu quả chiến dịch thúc đẩy bán hàng và ghi nhận một số giao dịch đột xuất phát sinh. Trung tâm sẽ tiếp tục bám sát tệp khách hàng mới để tối ưu dòng tiền lâu dài.`;
      } else {
        return `Doanh thu chỉ tiêu "${indicatorName}" chưa đạt kỳ vọng của kế hoạch đề ra (hụt ${absPct}%). Nguyên nhân khách quan xuất phát từ sự bão hòa chu kỳ cục bộ của thị trường thấp điểm và cạnh tranh lân cận gia tăng. Ban điều hành đang khẩn trương cải tổ lại quy trình tư vấn và thiết kế các gói kích cầu trọng tâm nhằm cải thiện tình hình kinh doanh kỳ tới.`;
      }
    } else {
      if (isPositive) {
        return `Chi phí thực tế của chỉ tiêu "${indicatorName}" đang ghi vượt định mức kế hoạch (+${absPct}%). Điều này bắt nguồn từ việc phát sinh các khoản sửa chữa, bảo dưỡng đột xuất ngoài dự toán và tăng cục bộ định phí đầu tư ban đầu để đáp ứng hạ tầng dịch vụ. Kế hoạch tiếp theo là thắt chặt tần suất duyệt chi ngoài định mức tối đa.`;
      } else {
        return `Chi phí thực tế của chỉ tiêu "${indicatorName}" được kiểm soát hiệu quả và tiết kiệm khả quan hơn so với ngân sách phân bổ (-${absPct}%). Đóng góp chính từ việc rà soát cắt giảm hao phí không thiết yếu và đàm phán lại hợp đồng thuê mượn đối tác. Ban điều hành cần lưu ý phân định rõ giữa tiết kiệm thực tế và việc hoãn chi phí tạm thời.`;
      }
    }
  }

  // API endpoint for AI Variance Explanation Suggestion
  app.post("/api/suggest-explanation", async (req, res) => {
    try {
      const { centerName, year, month, indicatorName, variance, variancePercent } = req.body;

      if (!indicatorName || !centerName) {
        return res.status(400).json({ error: "Missing required fields: centerName, indicatorName" });
      }

      const numVariancePercent = parseFloat(variancePercent) || 0;
      const pctStr = numVariancePercent >= 0 ? `+${numVariancePercent.toFixed(1)}%` : `${numVariancePercent.toFixed(1)}%`;

      const prompt = `
Hãy đóng vai trò Giám đốc Tài chính (CFO) hoặc Kế toán trưởng chuyên nghiệp.
Hãy viết một đoạn giải trình tài chính (commentary) ngắn gọn, súc tích (khoảng 2-3 câu ngắn, tối đa 90 từ) bằng tiếng Việt để thuyết minh biến động vượt ngưỡng cảnh báo cho chỉ tiêu sau:

- Trung tâm: ${centerName}
- Năm: ${year}
- Tháng xem: Tháng ${month}
- Chỉ tiêu: ${indicatorName}
- Giá trị biến động lũy kế YTD: ${parseFloat(variance).toLocaleString()} VNĐ
- Tỷ lệ chênh lệch lệch: ${pctStr}

Yêu cầu định hướng phân tích:
1. Nếu chỉ tiêu là Doanh thu và tăng (+): Do nhu cầu tăng trưởng vượt kỳ vọng, đội ngũ tư vấn viên hoạt động hiệu quả hoặc triển khai thành công gói truyền thông cục bộ.
2. Nếu chỉ tiêu là Doanh thu và giảm (-): Do thị trường bước vào chu kỳ thấp điểm, phản biến của đối thủ cạnh tranh gay gắt hoặc tiến độ dự định phân phối bị trì hoãn.
3. Nếu chỉ tiêu là Chi phí và tăng (+ / chi vượt kế hoạch): Do phát sinh đột xuất hoạt động nâng cấp, bảo hành cần thiết nhằm duy trì vận hành chuẩn mực, hoặc trượt giá thị trường.
4. Nếu chỉ tiêu là Chi phí và giảm (- / chi tiết kiệm): Do cải cách quy trình vận hành tinh gọn, thương lượng cắt giảm hoa hồng và phân bổ định phí tối ưu.

Hãy đưa ra lý thuyết ngắn mạch lạc logic kèm định hướng khắc phục/phát triển cụ thể.
Phản hồi của bạn phải là một chuỗi JSON hợp lệ và đúng định dạng cấu trúc sau, tuyệt đối không giải thích hay mở rộng văn bản ngoài JSON:
{
  "explanation": "Đoạn văn thuyết minh ngắn gọn bằng tiếng Việt..."
}
`;

      let ai;
      try {
        ai = getGeminiClient();
      } catch (err: any) {
        console.error("Gemini API Client error, resolving using smart offline fallback: ", err.message);
        const fallbackValue = getFallbackExplanation(indicatorName, parseFloat(variance) || 0, numVariancePercent, centerName, month, year);
        return res.json({ explanation: fallbackValue });
      }

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          systemInstruction: "Bạn là một Giám đốc Tài chính (CFO) chuyên nghiệp, có kỹ năng soạn thảo phân tích tài chính cực kỳ chặt chẽ, súc tích bằng tiếng Việt.",
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              explanation: {
                type: Type.STRING,
                description: "Văn bản thuyết minh ngắn gọn giải trình nguyên nhân biến động.",
              }
            },
            required: ["explanation"],
          }
        }
      });

      const text = response.text || "{}";
      const result = JSON.parse(text.trim());
      res.json(result);
    } catch (error: any) {
      console.error("Error generating explanation suggestion:", error);
      // Fallback on parse JSON or timeout error to rule-based fallback
      try {
        const { centerName, year, month, indicatorName, variance, variancePercent } = req.body;
        const numVariancePercent = parseFloat(variancePercent) || 0;
        const fallbackValue = getFallbackExplanation(indicatorName, parseFloat(variance) || 0, numVariancePercent, centerName || "Trung tâm", month || "1", year || "2026");
        return res.json({ explanation: fallbackValue });
      } catch (innerErr) {
        res.status(500).json({ error: "Có lỗi xảy ra khi tạo gợi ý giải trình: " + error.message });
      }
    }
  });

  // Health check endpoint
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT} in ${process.env.NODE_ENV || "development"} mode`);
  });
}

startServer();
