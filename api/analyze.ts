import { GoogleGenAI, Type } from "@google/genai";

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

export default async function handler(req: any, res: any) {
  // Enable CORS
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS,PATCH,DELETE,POST,PUT");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version"
  );

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed. Use POST." });
  }

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
    return res.json(result);
  } catch (error: any) {
    console.error("Error generating analysis:", error);
    return res.status(500).json({ error: "Có lỗi xảy ra khi phân tích dữ liệu: " + error.message });
  }
}
