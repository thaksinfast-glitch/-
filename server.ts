import express from "express";
import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { GoogleGenAI, Type, ThinkingLevel } from "@google/genai";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build",
    },
  },
});

const AUDIT_PROMPT = `
บทบาท: คุณคือ AI Auditor ระดับสูงสุด (Gemini 3.8 Flash) ที่มีความแม่นยำด้านตัวเลข 100%
ภารกิจ: เปรียบเทียบไฟล์ 3 ไฟล์เพื่อหาจุดที่ไม่สอดคล้องกันตามเงื่อนไขดังนี้:

1. การเปรียบเทียบคะแนน (ต้องตรงกันทุกจุด):
   เทียบรายชื่อเดียวกันใน SGS และ Toschool โดยดูคอลัมน์:
   - SGS(ก่อนกลางภาค) VS toschool(คะแนนก่อนกลางภาค(รวม))
   - SGS(หลังกลางภาค) VS toschool(คะแนนหลังกลางภาค(รวม))
   - SGS(กลางภาค) VS toschool(Mid)
   - SGS(ปลายภาค) VS toschool(Final)
   - SGS(รวม) VS toschool(รวมทั้งสิ้น)
   - SGS(ผลการเรียน) VS toschool(ปกติ)

   **คำสั่งฉุกเฉินระดับสูงสุด: กฎการแก้ปัญหาคอลัมน์เลื่อน (Column Shift) ในไฟล์ SGS 🚨**
   ปัญหา: เด็กที่ติด "มส" มักจะไม่มีคะแนน "ก่อนกลางภาค" (เป็นช่องว่าง) ทำให้คุณเผลอดึงคะแนน "กลางภาค" มาใส่แทนที่ช่องก่อนกลางภาค
   วิธีบังคับอ่านตาราง:
   1. ห้ามอ่านตัวเลขเรียงติดกัน ให้กวาดสายตาดู "แนวตั้ง (Alignment)" ของคอลัมน์เป็นหลัก ช่องไหนว่างคือ "ไม่มีคะแนน" (ให้ใส่ "")
   2. 🧮 การตรวจสอบความถูกต้องด้วยสมการ (Math Cross-check):
      ก่อนที่คุณจะสรุปคะแนนของนักเรียนแต่ละคน คุณต้องเช็คสมการนี้ในใจ:
      [ก่อนกลางภาค] + [กลางภาค] + [หลังกลางภาค] + [ปลายภาค] = [คะแนนรวมทั้งหมด]
      **หากคุณดึงคะแนนมาผิดช่อง (เช่น เอากลางภาคมาใส่ก่อนกลางภาค) ผลรวมจะไม่มีทางตรงกับช่อง "คะแนนรวม" ในไฟล์ SGS!** หากผลรวมไม่ตรง ให้คุณจัดเรียงตัวเลขลงช่องใหม่ให้ถูกต้องตามแนวคอลัมน์
   3. เด็ก "มส" จะไม่มีสิทธิ์แค่ปลายภาค ดังนั้นถ้าเห็นตัวเลขโผล่มา ให้สงสัยไว้ก่อนว่าเป็นคะแนนเก็บ หรือดูให้ตรงคอลัมน์จริงๆ

2. การตรวจสอบเวลาเรียน:
   - ให้ใช้ข้อมูลจากไฟล์เวลาเรียน (Attendance) เท่านั้น **ไม่ต้องนำข้อมูลเวลาเรียนที่ปรากฏในไฟล์ SGS มาวิเคราะห์**
   - หาก SGS(ผลการเรียน) = 'มส' -> เวลาเรียนต้อง < 80.00%
   - หาก SGS(ผลการเรียน) = 0, 1, 1.5, 2, 2.5, 3, 3.5, 4 -> เวลาเรียนต้อง >= 80.00%

3. กฎคะแนน "การอ่าน คิดวิเคราะห์ เขียน":
   - ถ้าเกรด (SGS/Toschool) = {0, มส, ร} -> คะแนนช่องการอ่านฯ ต้องเป็นเลข 1 ทุกช่อง
   - ถ้าเกรดอื่นๆ (1-4) -> คะแนนช่องการอ่านฯ ต้องเป็นเลข 3 ทุกช่อง
   - โปรดระบุคะแนนการอ่านฯ ทั้งจาก SGS และ Toschool

4. กฎคะแนนสอบปลายภาคสำหรับเกรด "มส" และ "ร":
   - ถ้านักเรียนได้เกรด "มส" หรือ "ร" คะแนนในช่องสอบปลายภาค (SGS(ปลายภาค) และ toschool(Final)) จะต้องเป็น 0 หรือเว้นว่างไว้เท่านั้น

5. กฎคะแนนขั้นต่ำ 70%:
   - คะแนน (SGS: ก่อนกลางภาค, กลางภาค, หลังกลางภาค) และ (Toschool: คะแนนก่อนกลางภาค(รวม), Mid, คะแนนหลังกลางภาค(รวม)) ต้องมีคะแนนไม่น้อยกว่า 70% ของคะแนนเต็มในช่องนั้นๆ ยกเว้นนักเรียนที่ผลการเรียนเป็น 0, ร, มส

6. กฎคะแนนรวมสำหรับเกรด "มส":
   - ถ้านักเรียนได้ผลการเรียน "มส" หรือ "มส." คะแนนรวมทั้งหมด (SGS(รวม) และ toschool(รวมทั้งสิ้น)) จะต้องมีค่าไม่เกิน 49 คะแนน

การแสดงผล: โปรดตอบกลับเป็น JSON เท่านั้น โดยมีโครงสร้างดังนี้:
{
  "allStudents": [
    { 
      "name": "ชื่อ-นามสกุล", 
      "classroom": "ห้องเรียน (เช่น ม.1/1)",
      "subject": "รายวิชา",
      "sgsPreMid": "คะแนน", "toPreMid": "คะแนน",
      "sgsPostMid": "คะแนน", "toPostMid": "คะแนน",
      "sgsMid": "คะแนน", "toMid": "คะแนน",
      "sgsFinal": "คะแนน", "toFinal": "คะแนน",
      "sgsTotal": "คะแนน", "toTotal": "คะแนน",
      "sgsGrade": "เกรด", "toGrade": "เกรด",
      "sgsReading": "คะแนนการอ่านฯ (SGS)",
      "toReading": "คะแนนการอ่านฯ (Toschool)",
      "attendance": "เวลาเรียน (%)", 
      "status": "ปกติ/ผิดปกติ", 
      "details": "รายละเอียดสั้นๆ" 
    }
  ],
  "discrepancies": [
    { "name": "ชื่อ-นามสกุล", "issue": "หัวข้อปัญหา", "details": "รายละเอียดเชิงลึกของข้อผิดพลาด" }
  ],
  "summary": "บทสรุปภาพรวม (Markdown)"
}

โปรดตรวจสอบข้อมูลนักเรียนทุกคนอย่างละเอียด
`;

const AUDIT_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    allStudents: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          classroom: { type: Type.STRING },
          subject: { type: Type.STRING },
          sgsPreMid: { type: Type.STRING },
          toPreMid: { type: Type.STRING },
          sgsPostMid: { type: Type.STRING },
          toPostMid: { type: Type.STRING },
          sgsMid: { type: Type.STRING },
          toMid: { type: Type.STRING },
          sgsFinal: { type: Type.STRING },
          toFinal: { type: Type.STRING },
          sgsTotal: { type: Type.STRING },
          toTotal: { type: Type.STRING },
          sgsGrade: { type: Type.STRING },
          toGrade: { type: Type.STRING },
          sgsReading: { type: Type.STRING },
          toReading: { type: Type.STRING },
          attendance: { type: Type.STRING },
          status: { type: Type.STRING },
          details: { type: Type.STRING },
        },
        required: [
          "name",
          "classroom",
          "subject",
          "sgsPreMid",
          "toPreMid",
          "sgsPostMid",
          "toPostMid",
          "sgsMid",
          "toMid",
          "sgsFinal",
          "toFinal",
          "sgsTotal",
          "toTotal",
          "sgsGrade",
          "toGrade",
          "sgsReading",
          "toReading",
          "attendance",
          "status",
          "details",
        ],
      },
    },
    discrepancies: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          issue: { type: Type.STRING },
          details: { type: Type.STRING },
        },
        required: ["name", "issue", "details"],
      },
    },
    summary: { type: Type.STRING },
  },
  required: ["allStudents", "discrepancies", "summary"],
};

async function startServer() {
  const app = express();
  const server = createServer(app);
  const wss = new WebSocketServer({ server });

  // Body parser with 100mb limit for PDF/Excel base64 files
  app.use(express.json({ limit: "100mb" }));
  app.use(express.urlencoded({ limit: "100mb", extended: true }));

  let totalVisits = 0;

  wss.on("connection", (ws) => {
    totalVisits++;
    broadcastVisitorCount();

    ws.on("close", () => {
      // We could track active users here if needed
    });
  });

  function broadcastVisitorCount() {
    const message = JSON.stringify({
      type: "visitorCount",
      count: totalVisits,
    });
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }

  // API routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.post("/api/analyze", async (req, res) => {
    try {
      const { sgsFiles, toschoolFiles, attendanceFiles } = req.body;
      if (!sgsFiles?.length || !toschoolFiles?.length || !attendanceFiles?.length) {
        return res.json({ 
          success: false, 
          error: "กรุณาอัปโหลดไฟล์ให้ครบทั้ง 3 ช่องก่อนทำการวิเคราะห์" 
        });
      }

      const sgsParts = sgsFiles.map((f: { base64: string; mimeType: string }) => ({
        inlineData: { data: f.base64, mimeType: f.mimeType },
      }));
      const toschoolParts = toschoolFiles.map((f: { base64: string; mimeType: string }) => ({
        inlineData: { data: f.base64, mimeType: f.mimeType },
      }));
      const attendanceParts = attendanceFiles.map((f: { base64: string; mimeType: string }) => ({
        inlineData: { data: f.base64, mimeType: f.mimeType },
      }));

      // Candidate models:
      // 1. gemini-3.8-flash (โมเดลหลัก: ความเร็วสูง + Deep Thinking)
      // 2. gemini-3.1-pro-preview (โมเดลสำรองอัจฉริยะ: พลังวิเคราะห์ขั้นสูง)
      const candidateModels = [
        "gemini-3.8-flash",
        "gemini-3.1-pro-preview",
      ];
      let response: any = null;
      let usedModel = candidateModels[0];
      let lastError: any = null;

      for (const modelName of candidateModels) {
        try {
          console.log(`[AI Auditor] Starting analysis with model ${modelName}...`);
          const config: any = {
            responseMimeType: "application/json",
            responseSchema: AUDIT_SCHEMA,
          };
          if (modelName === "gemini-3.8-flash" || modelName === "gemini-3.1-pro-preview") {
            config.thinkingConfig = { thinkingLevel: ThinkingLevel.HIGH };
          }

          response = await ai.models.generateContent({
            model: modelName,
            contents: [
              {
                role: "user",
                parts: [
                  { text: AUDIT_PROMPT },
                  ...sgsParts,
                  ...toschoolParts,
                  ...attendanceParts,
                ],
              },
            ],
            config,
          });

          if (response && response.text) {
            usedModel = modelName;
            console.log(`[AI Auditor] Successfully analyzed with ${modelName}`);
            break;
          }
        } catch (err: any) {
          console.warn(`[AI Auditor] Model ${modelName} encountered issue:`, err?.message || err);
          lastError = err;
          // Short delay before next candidate
          await new Promise((resolve) => setTimeout(resolve, 800));
        }
      }

      if (!response || !response.text) {
        throw lastError || new Error("ไม่สามารถประมวลผลข้อมูลได้ในขณะนี้");
      }

      // Safe JSON parsing
      const rawText = (response.text || "").trim();
      const cleanedText = rawText.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
      const parsedResult = JSON.parse(cleanedText || "{}");

      return res.json({ 
        success: true, 
        result: parsedResult, 
        model: usedModel 
      });
    } catch (err: any) {
      console.error("[AI Auditor Error]:", err);
      let errorMessage = err.message || "เกิดข้อผิดพลาดระหว่างการวิเคราะห์";
      if (
        errorMessage.includes("503") ||
        errorMessage.includes("overloaded") ||
        errorMessage.includes("high demand") ||
        errorMessage.includes("UNAVAILABLE")
      ) {
        errorMessage = "ระบบ AI มีผู้ใช้งานจำนวนมากชั่วคราว (Model Overloaded) โปรดรอสักครู่แล้วกดปุ่มวิเคราะห์ใหม่อีกครั้ง";
      } else if (
        errorMessage.includes("429") ||
        errorMessage.includes("quota") ||
        errorMessage.includes("RESOURCE_EXHAUSTED")
      ) {
        errorMessage = "โควตาการใช้งาน API เต็ม (Quota Exceeded) โปรดรอสักครู่แล้วลองใหม่";
      }

      // CRITICAL: Always return HTTP 200 with success: false so Nginx error_page 502/503/504
      // will NEVER intercept the response with the HTML warmup page!
      return res.json({
        success: false,
        error: errorMessage,
      });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
  server.timeout = 300000;
  server.keepAliveTimeout = 300000;

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
