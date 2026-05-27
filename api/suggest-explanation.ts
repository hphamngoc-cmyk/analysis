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
    return res.json(result);
  } catch (error: any) {
    console.error("Error generating explanation suggestion:", error);
    // Fallback on parse JSON or timeout error to rule-based fallback
    try {
      const { centerName, year, month, indicatorName, variance, variancePercent } = req.body;
      const numVariancePercent = parseFloat(variancePercent) || 0;
      const fallbackValue = getFallbackExplanation(indicatorName, parseFloat(variance) || 0, numVariancePercent, centerName || "Trung tâm", month || "1", year || "2026");
      return res.json({ explanation: fallbackValue });
    } catch (innerErr) {
      return res.status(500).json({ error: "Có lỗi xảy ra khi tạo gợi ý giải trình: " + error.message });
    }
  }
}
