/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { GoogleGenAI, Type } from "@google/genai";
import { 
  FileUp, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  FileText, 
  Bot, 
  Users,
  Info,
  ArrowRight,
  Download,
  AlertTriangle,
  Search
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

// Initialize Gemini API
const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

interface FileData {
  file: File;
  base64: string;
  mimeType: string;
}

interface FileState {
  files: FileData[];
}

interface StudentData {
  name: string;
  classroom?: string;
  subject?: string;
  sgsPreMid: string;
  toPreMid: string;
  sgsPostMid: string;
  toPostMid: string;
  sgsMid: string;
  toMid: string;
  sgsFinal: string;
  toFinal: string;
  sgsTotal: string;
  toTotal: string;
  sgsGrade: string;
  toGrade: string;
  sgsReading: string;
  toReading: string;
  attendance: string;
  status: 'ปกติ' | 'ผิดปกติ';
  details: string;
}

interface Discrepancy {
  name: string;
  issue: string;
  details: string;
}

interface AnalysisResult {
  allStudents: StudentData[];
  discrepancies: Discrepancy[];
  summary: string;
}

const playNotificationSound = () => {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    
    const audioCtx = new AudioContextClass();
    
    const playTone = (freq: number, startTime: number, duration: number) => {
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      oscillator.type = 'sine';
      oscillator.frequency.value = freq;
      
      gainNode.gain.setValueAtTime(0.1, startTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
      
      oscillator.start(startTime);
      oscillator.stop(startTime + duration);
    };

    const now = audioCtx.currentTime;
    playTone(880, now, 0.1); // A5
    playTone(1108.73, now + 0.15, 0.2); // C#6
  } catch (e) {
    console.error("Audio playback failed", e);
  }
};

const FileUploadZone = ({ 
  label, 
  description, 
  onFilesSelect, 
  onClear,
  fileState, 
  id 
}: { 
  label: string; 
  description: string; 
  onFilesSelect: (files: File[]) => void; 
  onClear: () => void;
  fileState: FileState;
  id: string;
}) => {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) onFilesSelect(files);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    if (files.length > 0) onFilesSelect(files);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-2">
        <label className="text-sm font-semibold text-zinc-700 flex items-center gap-2">
          {label}
        </label>
        {fileState.files.length > 0 && (
          <button 
            onClick={(e) => { e.stopPropagation(); onClear(); }}
            className="text-[10px] font-bold text-red-500 hover:text-red-600 transition-colors"
          >
            ล้างทั้งหมด
          </button>
        )}
      </div>
      <div
        id={id}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative flex-1 border-2 border-dashed rounded-2xl transition-all duration-200 flex flex-col items-center justify-center p-6 text-center cursor-pointer
          ${isDragging ? 'border-emerald-500 bg-emerald-50/50' : 'border-zinc-200 hover:border-zinc-300 bg-white'}
          ${fileState.files.length > 0 ? 'border-emerald-200 bg-emerald-50/20' : ''}
        `}
        onClick={() => document.getElementById(`input-${id}`)?.click()}
      >
        <input
          type="file"
          id={`input-${id}`}
          className="hidden"
          accept=".pdf,.xlsx,.xls,.csv"
          multiple
          onChange={handleFileChange}
        />
        
        {fileState.files.length > 0 ? (
          <div className="w-full space-y-2">
            <div className="flex flex-wrap justify-center gap-2">
              {fileState.files.map((f, idx) => (
                <motion.div 
                  key={idx}
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="flex flex-col items-center bg-white p-2 rounded-xl border border-emerald-100 shadow-sm min-w-[100px]"
                >
                  <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center mb-1">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  </div>
                  <p className="text-[10px] font-medium text-zinc-900 truncate max-w-[80px]">
                    {f.file.name}
                  </p>
                </motion.div>
              ))}
            </div>
            <p className="text-xs text-emerald-600 font-bold mt-2">
              อัปโหลดแล้ว {fileState.files.length} ไฟล์
            </p>
          </div>
        ) : (
          <>
            <div className="w-12 h-12 rounded-full bg-zinc-100 flex items-center justify-center mb-3">
              <FileUp className="w-6 h-6 text-zinc-400" />
            </div>
            <p className="text-sm font-medium text-zinc-900">{description}</p>
            <p className="text-xs text-zinc-400 mt-1">PDF or Excel files (Multiple allowed)</p>
          </>
        )}
      </div>
    </div>
  );
};

const CircularProgress = ({ progress, time }: { progress: number, time: number }) => {
  const radius = 24;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <div className="relative flex items-center justify-center w-16 h-16">
      <svg className="transform -rotate-90 w-16 h-16">
        <circle
          className="text-zinc-200"
          strokeWidth="4"
          stroke="currentColor"
          fill="transparent"
          r={radius}
          cx="32"
          cy="32"
        />
        <circle
          className="text-emerald-500 transition-all duration-300 ease-in-out"
          strokeWidth="4"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          stroke="currentColor"
          fill="transparent"
          r={radius}
          cx="32"
          cy="32"
        />
      </svg>
      <div className="absolute flex flex-col items-center justify-center text-emerald-600">
        <span className="text-sm font-bold">{time}s</span>
      </div>
    </div>
  );
};

export default function App() {
  const [sgs, setSgs] = useState<FileState>({ files: [] });
  const [toschool, setToschool] = useState<FileState>({ files: [] });
  const [attendance, setAttendance] = useState<FileState>({ files: [] });
  
  const [loading, setLoading] = useState(false);
  const [showProgress, setShowProgress] = useState(false);
  const [progress, setProgress] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [visitorCount, setVisitorCount] = useState<number>(0);

  // Real-time visitor count
  React.useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const socket = new WebSocket(`${protocol}//${window.location.host}`);

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'visitorCount') {
          setVisitorCount(data.count);
        }
      } catch (err) {
        console.error('WebSocket error:', err);
      }
    };

    return () => socket.close();
  }, []);

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const base64String = (reader.result as string).split(',')[1];
        resolve(base64String);
      };
      reader.onerror = (error) => reject(error);
    });
  };

  const handleFilesSelect = async (files: File[], setter: React.Dispatch<React.SetStateAction<FileState>>) => {
    setShowProgress(false);
    setProgress(0);
    setElapsedTime(0);
    try {
      const newFilesData = await Promise.all(files.map(async (file) => {
        const base64 = await fileToBase64(file);
        return {
          file,
          base64,
          mimeType: file.type || (file.name.endsWith('.xlsx') ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'application/pdf')
        };
      }));

      setter(prev => ({
        files: [...prev.files, ...newFilesData]
      }));
      setError(null);
    } catch (err) {
      setError("Failed to process files. Please try again.");
    }
  };

  const analyzeData = async () => {
    if (sgs.files.length === 0 || toschool.files.length === 0 || attendance.files.length === 0) {
      setError("Please upload at least one file for each category before analyzing.");
      return;
    }

    setLoading(true);
    setShowProgress(true);
    setProgress(0);
    setElapsedTime(0);
    setError(null);
    setResult(null);

    const startTime = Date.now();
    const progressInterval = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
      setProgress(prev => {
        if (prev < 95) {
          return prev + (95 - prev) * 0.05;
        }
        return prev;
      });
    }, 1000);

    try {
      const prompt = `
        บทบาท: คุณคือ AI Auditor ระดับสูง (Gemini 3.1 Pro) ที่มีความแม่นยำด้านตัวเลข 100%
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

      const sgsParts = sgs.files.map(f => ({ inlineData: { data: f.base64, mimeType: f.mimeType } }));
      const toschoolParts = toschool.files.map(f => ({ inlineData: { data: f.base64, mimeType: f.mimeType } }));
      const attendanceParts = attendance.files.map(f => ({ inlineData: { data: f.base64, mimeType: f.mimeType } }));

      const response = await genAI.models.generateContent({
        model: "gemini-3.1-pro-preview",
        contents: [
          {
            role: 'user',
            parts: [
              { text: prompt },
              ...sgsParts,
              ...toschoolParts,
              ...attendanceParts,
            ]
          }
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
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
                    details: { type: Type.STRING }
                  },
                  required: [
                    "name", "classroom", "subject", "sgsPreMid", "toPreMid", "sgsPostMid", "toPostMid", 
                    "sgsMid", "toMid", "sgsFinal", "toFinal", "sgsTotal", 
                    "toTotal", "sgsGrade", "toGrade", "sgsReading", "toReading", "attendance", "status", "details"
                  ]
                }
              },
              discrepancies: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    issue: { type: Type.STRING },
                    details: { type: Type.STRING }
                  },
                  required: ["name", "issue", "details"]
                }
              },
              summary: { type: Type.STRING }
            },
            required: ["allStudents", "discrepancies", "summary"]
          }
        }
      });

      const parsedResult = JSON.parse(response.text || "{}");
      setProgress(100);
      setResult(parsedResult);
      playNotificationSound();
    } catch (err: any) {
      console.error(err);
      let errorMessage = err.message || "An error occurred during analysis. Please check your files and try again.";
      if (err.status === 429 || errorMessage.includes("429") || errorMessage.includes("quota") || errorMessage.includes("RESOURCE_EXHAUSTED")) {
        errorMessage = "โควตาการใช้งาน API ของคุณเต็ม (Error 429: Quota Exceeded) โปรดตรวจสอบแพ็กเกจและการเรียกเก็บเงินของคุณ หรือรอสักครู่แล้วลองใหม่";
      }
      setError(errorMessage);
    } finally {
      clearInterval(progressInterval);
      // Wait a moment before hiding the progress bar if it reached 100%
      setTimeout(() => {
        setLoading(false);
      }, 500);
    }
  };

  const downloadExcel = async () => {
    if (!result) return;

    const sortedStudents = [...result.allStudents].sort((a, b) => {
      const classA = a.classroom || "";
      const classB = b.classroom || "";
      if (classA !== classB) return classA.localeCompare(classB);
      const subA = a.subject || "";
      const subB = b.subject || "";
      return subA.localeCompare(subB);
    });

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('นักเรียนทั้งหมด');

    // Define columns
    sheet.columns = [
      { header: 'ห้องเรียน', key: 'classroom', width: 15 },
      { header: 'วิชา', key: 'subject', width: 20 },
      { header: 'ชื่อ-นามสกุล', key: 'name', width: 25 },
      { header: 'SGS ก่อนกลาง', key: 'sgsPreMid', width: 12 },
      { header: 'TO ก่อนกลาง', key: 'toPreMid', width: 12 },
      { header: 'SGS หลังกลาง', key: 'sgsPostMid', width: 12 },
      { header: 'TO หลังกลาง', key: 'toPostMid', width: 12 },
      { header: 'SGS Mid', key: 'sgsMid', width: 10 },
      { header: 'TO Mid', key: 'toMid', width: 10 },
      { header: 'SGS Final', key: 'sgsFinal', width: 10 },
      { header: 'TO Final', key: 'toFinal', width: 10 },
      { header: 'SGS รวม', key: 'sgsTotal', width: 10 },
      { header: 'TO รวม', key: 'toTotal', width: 10 },
      { header: 'SGS เกรด', key: 'sgsGrade', width: 10 },
      { header: 'TO เกรด', key: 'toGrade', width: 10 },
      { header: 'เวลาเรียน', key: 'attendance', width: 12 },
      { header: 'SGS การอ่านฯ', key: 'sgsReading', width: 12 },
      { header: 'To การอ่านฯ', key: 'toReading', width: 12 },
      { header: 'สถานะ', key: 'status', width: 10 },
      { header: 'รายละเอียด', key: 'details', width: 40 },
    ];

    // Style header
    sheet.getRow(1).font = { name: 'TH Sarabun PSK', size: 12, bold: true };
    sheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    };

    // Add data and style discrepancies
    sortedStudents.forEach((s) => {
      const row = sheet.addRow(s);
      row.font = { name: 'TH Sarabun PSK', size: 12 };
      
      const errorStyle: Partial<ExcelJS.Style> = {
        font: { name: 'TH Sarabun PSK', size: 12, color: { argb: 'FFFF0000' }, bold: true },
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFEBEE' } }
      };

      // Check pairs and apply style
      if (isDifferent(s.sgsPreMid, s.toPreMid)) {
        row.getCell('sgsPreMid').style = errorStyle;
        row.getCell('toPreMid').style = errorStyle;
      }
      if (isDifferent(s.sgsPostMid, s.toPostMid)) {
        row.getCell('sgsPostMid').style = errorStyle;
        row.getCell('toPostMid').style = errorStyle;
      }
      if (isDifferent(s.sgsMid, s.toMid)) {
        row.getCell('sgsMid').style = errorStyle;
        row.getCell('toMid').style = errorStyle;
      }
      if (isDifferent(s.sgsFinal, s.toFinal)) {
        row.getCell('sgsFinal').style = errorStyle;
        row.getCell('toFinal').style = errorStyle;
      }
      if (isDifferent(s.sgsTotal, s.toTotal)) {
        row.getCell('sgsTotal').style = errorStyle;
        row.getCell('toTotal').style = errorStyle;
      }
      if (isDifferent(s.sgsGrade, s.toGrade)) {
        row.getCell('sgsGrade').style = errorStyle;
        row.getCell('toGrade').style = errorStyle;
      }
      if (isDifferent(s.sgsReading, s.toReading)) {
        row.getCell('sgsReading').style = errorStyle;
        row.getCell('toReading').style = errorStyle;
      }
      if (s.status === 'ผิดปกติ') {
        row.getCell('status').style = errorStyle;
      }
    });

    // Add Discrepancies sheet
    const discSheet = workbook.addWorksheet('รายชื่อที่พบข้อผิดพลาด');
    discSheet.columns = [
      { header: 'ชื่อ-นามสกุล', key: 'name', width: 30 },
      { header: 'หัวข้อปัญหา', key: 'issue', width: 30 },
      { header: 'รายละเอียด', key: 'details', width: 60 },
    ];
    discSheet.getRow(1).font = { name: 'TH Sarabun PSK', size: 12, bold: true };
    discSheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFFCDD2' }
    };
    
    result.discrepancies.forEach(d => {
      const row = discSheet.addRow(d);
      row.font = { name: 'TH Sarabun PSK', size: 12, color: { argb: 'FFFF0000' }, bold: true };
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, `AI_Teacher_Audit_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const filteredStudents = result?.allStudents.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const isDifferent = (val1: string, val2: string) => {
    const v1 = val1?.toString().trim() || "";
    const v2 = val2?.toString().trim() || "";
    
    // If they are exactly the same string, they are not different
    if (v1 === v2) return false;
    
    // Try numeric comparison to ignore .00 differences
    const n1 = parseFloat(v1);
    const n2 = parseFloat(v2);
    
    if (!isNaN(n1) && !isNaN(n2)) {
      return n1 !== n2;
    }
    
    return v1 !== v2;
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-zinc-900 font-sans pb-20">
      {/* Header */}
      <header className="bg-white border-b border-zinc-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-zinc-900 rounded-xl flex items-center justify-center shadow-lg shadow-zinc-200">
              <Bot className="text-white w-6 h-6" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">SGS Auditor</h1>
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">By Mr. Thaksin</p>
            </div>
          </div>
          
          <div className="hidden sm:flex items-center gap-6 text-sm font-medium text-zinc-500">
            <span className="flex items-center gap-2"><Users className="w-4 h-4" /> Student Data</span>
            <span className="flex items-center gap-2"><FileText className="w-4 h-4" /> Cross-Check</span>
            <div className="flex items-center gap-2 bg-zinc-100 px-3 py-1 rounded-full">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              <span className="text-[10px] font-bold text-zinc-600">Usage: {visitorCount.toLocaleString()}</span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        {/* Welcome Section */}
        <div className="mb-10 flex justify-between items-start">
          <div>
            <h2 className="text-3xl font-bold text-zinc-900 mb-2">🤖 ระบบวิเคราะห์เกรดอัจฉริยะ</h2>
            <p className="text-zinc-500 max-w-2xl">
              ระบบตรวจสอบความสอดคล้องข้อมูล SGS, Toschool และเวลาเรียน
            </p>
          </div>
          {showProgress && (
            <div className="flex flex-col items-end">
              <div className="flex items-center gap-3 bg-white p-3 rounded-2xl shadow-sm border border-zinc-100">
                <div className="flex flex-col items-end">
                  <span className="text-sm font-bold text-zinc-900">
                    {progress >= 100 ? "วิเคราะห์เสร็จสิ้น" : "กำลังวิเคราะห์ข้อมูล..."}
                  </span>
                  <span className="text-xs font-medium text-emerald-600">{Math.round(progress)}% เสร็จสิ้น</span>
                </div>
                <CircularProgress progress={progress} time={elapsedTime} />
              </div>
            </div>
          )}
        </div>

        {/* Upload Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          <FileUploadZone 
            id="sgs"
            label="1. ไฟล์ SGS" 
            description="อัปโหลดไฟล์จากระบบ SGS" 
            fileState={sgs}
            onFilesSelect={(files) => handleFilesSelect(files, setSgs)}
            onClear={() => {
              setSgs({ files: [] });
              setShowProgress(false);
              setProgress(0);
              setElapsedTime(0);
            }}
          />
          <FileUploadZone 
            id="toschool"
            label="2. ไฟล์ Toschool" 
            description="อัปโหลดไฟล์จากระบบ Toschool" 
            fileState={toschool}
            onFilesSelect={(files) => handleFilesSelect(files, setToschool)}
            onClear={() => {
              setToschool({ files: [] });
              setShowProgress(false);
              setProgress(0);
              setElapsedTime(0);
            }}
          />
          <FileUploadZone 
            id="attendance"
            label="3. ไฟล์เวลาเรียน" 
            description="อัปโหลดไฟล์บันทึกเวลาเรียน" 
            fileState={attendance}
            onFilesSelect={(files) => handleFilesSelect(files, setAttendance)}
            onClear={() => {
              setAttendance({ files: [] });
              setShowProgress(false);
              setProgress(0);
              setElapsedTime(0);
            }}
          />
        </div>

        {/* Action Button */}
        <div className="flex flex-col items-center justify-center mb-12">
          <button
            onClick={analyzeData}
            disabled={loading || sgs.files.length === 0 || toschool.files.length === 0 || attendance.files.length === 0}
            className={`
              group relative flex items-center gap-3 px-8 py-4 rounded-2xl font-bold text-lg transition-all duration-300
              ${loading || sgs.files.length === 0 || toschool.files.length === 0 || attendance.files.length === 0
                ? 'bg-zinc-200 text-zinc-400 cursor-not-allowed'
                : 'bg-zinc-900 text-white hover:bg-zinc-800 hover:shadow-xl hover:-translate-y-1 active:scale-95'}
            `}
          >
            {loading ? (
              <>
                <Loader2 className="w-6 h-6 animate-spin" />
                <span>กำลังวิเคราะห์เชิงลึก...</span>
              </>
            ) : (
              <>
                <span>เริ่มการวิเคราะห์เชิงลึก</span>
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </button>
          
          {error && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 flex items-center gap-2 text-red-600 bg-red-50 px-4 py-2 rounded-lg border border-red-100"
            >
              <AlertCircle className="w-4 h-4" />
              <span className="text-sm font-medium">{error}</span>
            </motion.div>
          )}
        </div>

        <AnimatePresence>
          {result && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-8"
            >
              {/* Discrepancies Section */}
              <div className="bg-red-50 rounded-3xl border border-red-100 shadow-sm overflow-hidden p-8">
                <h3 className="text-xl font-bold text-red-900 flex items-center gap-2 mb-6">
                  <AlertTriangle className="text-red-600" />
                  รายชื่อที่พบข้อผิดพลาด (Discrepancies)
                </h3>
                {result.discrepancies.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {result.discrepancies.map((d, i) => (
                      <motion.div 
                        key={i}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className="bg-white p-4 rounded-2xl border border-red-100 shadow-sm"
                      >
                        <p className="font-bold text-zinc-900">{d.name}</p>
                        <p className="text-sm font-semibold text-red-600 mt-1">{d.issue}</p>
                        <p className="text-xs text-zinc-500 mt-2 leading-relaxed">{d.details}</p>
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-white/50 p-8 rounded-2xl text-center">
                    <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
                    <p className="font-bold text-zinc-600">ไม่พบข้อผิดพลาดในข้อมูล</p>
                  </div>
                )}
              </div>

              {/* All Students Table */}
              <div className="bg-white rounded-3xl border border-zinc-200 shadow-sm overflow-hidden">
                <div className="p-8 border-b border-zinc-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <h3 className="text-xl font-bold">ตารางเปรียบเทียบข้อมูลนักเรียนทั้งหมด</h3>
                  <div className="flex items-center gap-4">
                    <button
                      onClick={downloadExcel}
                      className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl font-semibold hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-100 text-sm"
                    >
                      <Download className="w-4 h-4" />
                      Excel
                    </button>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                      <input 
                        type="text" 
                        placeholder="ค้นหาชื่อ..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 pr-4 py-2 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all w-full sm:w-64"
                      />
                    </div>
                  </div>
                </div>

                {Object.entries(
                  filteredStudents.reduce((acc, s) => {
                    const key = `${s.classroom || 'ไม่ระบุห้อง'} | ${s.subject || 'ไม่ระบุวิชา'}`;
                    if (!acc[key]) acc[key] = [];
                    acc[key].push(s);
                    return acc;
                  }, {} as Record<string, StudentData[]>)
                ).map(([groupKey, students], groupIdx) => (
                  <div key={groupIdx} className="border-b border-zinc-100 last:border-0">
                    <div className="bg-zinc-50/50 px-8 py-3 flex items-center gap-3 border-y border-zinc-100">
                      <div className="w-2 h-2 rounded-full bg-emerald-500" />
                      <h4 className="text-sm font-bold text-zinc-700 uppercase tracking-wide">
                        {groupKey} ({students.length} คน)
                      </h4>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse min-w-[1200px]">
                        <thead>
                          <tr className="bg-white text-zinc-500 text-[10px] uppercase tracking-wider font-bold">
                            <th className="px-6 py-4 border-b border-zinc-100 sticky left-0 bg-white z-20">ชื่อ-นามสกุล</th>
                            <th className="px-3 py-4 border-b border-zinc-100 text-center bg-blue-50/50">SGS ก่อนกลาง</th>
                            <th className="px-3 py-4 border-b border-zinc-100 text-center bg-blue-50/50">TO ก่อนกลาง</th>
                            <th className="px-3 py-4 border-b border-zinc-100 text-center bg-indigo-50/50">SGS หลังกลาง</th>
                            <th className="px-3 py-4 border-b border-zinc-100 text-center bg-indigo-50/50">TO หลังกลาง</th>
                            <th className="px-3 py-4 border-b border-zinc-100 text-center bg-violet-50/50">SGS Mid</th>
                            <th className="px-3 py-4 border-b border-zinc-100 text-center bg-violet-50/50">TO Mid</th>
                            <th className="px-3 py-4 border-b border-zinc-100 text-center bg-purple-50/50">SGS Final</th>
                            <th className="px-3 py-4 border-b border-zinc-100 text-center bg-purple-50/50">TO Final</th>
                            <th className="px-3 py-4 border-b border-zinc-100 text-center bg-emerald-50/50 font-black">SGS รวม</th>
                            <th className="px-3 py-4 border-b border-zinc-100 text-center bg-emerald-50/50 font-black">TO รวม</th>
                            <th className="px-3 py-4 border-b border-zinc-100 text-center bg-amber-50/50">SGS เกรด</th>
                            <th className="px-3 py-4 border-b border-zinc-100 text-center bg-amber-50/50">TO เกรด</th>
                            <th className="px-3 py-4 border-b border-zinc-100 text-center">เวลาเรียน</th>
                            <th className="px-3 py-4 border-b border-zinc-100 text-center bg-zinc-100/50">SGS การอ่านฯ</th>
                            <th className="px-3 py-4 border-b border-zinc-100 text-center bg-zinc-100/50">To การอ่านฯ</th>
                            <th className="px-3 py-4 border-b border-zinc-100 text-center">สถานะ</th>
                            <th className="px-6 py-4 border-b border-zinc-100">รายละเอียด</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-50 text-sm">
                          {students.map((s, i) => (
                            <tr key={i} className="hover:bg-zinc-50/50 transition-colors">
                              <td className="px-6 py-4 font-medium text-zinc-900 sticky left-0 bg-white z-10 border-r border-zinc-100">{s.name}</td>
                              <td className={`px-3 py-4 text-center ${isDifferent(s.sgsPreMid, s.toPreMid) ? 'text-red-600 font-bold bg-red-50' : ''}`}>{s.sgsPreMid}</td>
                              <td className={`px-3 py-4 text-center ${isDifferent(s.sgsPreMid, s.toPreMid) ? 'text-red-600 font-bold bg-red-50' : ''}`}>{s.toPreMid}</td>
                              <td className={`px-3 py-4 text-center ${isDifferent(s.sgsPostMid, s.toPostMid) ? 'text-red-600 font-bold bg-red-50' : ''}`}>{s.sgsPostMid}</td>
                              <td className={`px-3 py-4 text-center ${isDifferent(s.sgsPostMid, s.toPostMid) ? 'text-red-600 font-bold bg-red-50' : ''}`}>{s.toPostMid}</td>
                              <td className={`px-3 py-4 text-center ${isDifferent(s.sgsMid, s.toMid) ? 'text-red-600 font-bold bg-red-50' : ''}`}>{s.sgsMid}</td>
                              <td className={`px-3 py-4 text-center ${isDifferent(s.sgsMid, s.toMid) ? 'text-red-600 font-bold bg-red-50' : ''}`}>{s.toMid}</td>
                              <td className={`px-3 py-4 text-center ${isDifferent(s.sgsFinal, s.toFinal) ? 'text-red-600 font-bold bg-red-50' : ''}`}>{s.sgsFinal}</td>
                              <td className={`px-3 py-4 text-center ${isDifferent(s.sgsFinal, s.toFinal) ? 'text-red-600 font-bold bg-red-50' : ''}`}>{s.toFinal}</td>
                              <td className={`px-3 py-4 text-center font-black ${isDifferent(s.sgsTotal, s.toTotal) ? 'text-red-600 bg-red-50' : ''}`}>{s.sgsTotal}</td>
                              <td className={`px-3 py-4 text-center font-black ${isDifferent(s.sgsTotal, s.toTotal) ? 'text-red-600 bg-red-50' : ''}`}>{s.toTotal}</td>
                              <td className={`px-3 py-4 text-center ${isDifferent(s.sgsGrade, s.toGrade) ? 'text-red-600 font-bold bg-red-50' : ''}`}>{s.sgsGrade}</td>
                              <td className={`px-3 py-4 text-center ${isDifferent(s.sgsGrade, s.toGrade) ? 'text-red-600 font-bold bg-red-50' : ''}`}>{s.toGrade}</td>
                              <td className="px-3 py-4 text-center">{s.attendance}</td>
                              <td className={`px-3 py-4 text-center bg-zinc-50/30 ${isDifferent(s.sgsReading, s.toReading) ? 'text-red-600 font-bold bg-red-50' : ''}`}>{s.sgsReading}</td>
                              <td className={`px-3 py-4 text-center bg-zinc-50/30 ${isDifferent(s.sgsReading, s.toReading) ? 'text-red-600 font-bold bg-red-50' : ''}`}>{s.toReading}</td>
                              <td className="px-3 py-4 text-center">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                                  s.status === 'ปกติ' 
                                    ? 'bg-emerald-100 text-emerald-700' 
                                    : 'bg-red-100 text-red-700'
                                }`}>
                                  {s.status}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-[10px] text-zinc-500 max-w-xs leading-tight">{s.details}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
                {filteredStudents.length === 0 && (
                  <div className="p-12 text-center text-zinc-400">
                    <p>ไม่พบข้อมูลที่ค้นหา</p>
                  </div>
                )}
              </div>

              {/* Summary Card - Moved to Bottom */}
              <div className="bg-white rounded-3xl border border-zinc-200 shadow-sm overflow-hidden p-8">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-bold flex items-center gap-2">
                    <Bot className="text-emerald-600" />
                    บทสรุปภาพรวม
                  </h3>
                </div>
                <div className="prose prose-zinc max-w-none">
                  <ReactMarkdown>{result.summary}</ReactMarkdown>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Instructions / Info */}
        {!result && !loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-12 opacity-60">
            <div className="flex gap-4">
              <div className="w-10 h-10 rounded-full bg-zinc-100 flex items-center justify-center shrink-0">
                <Info className="w-5 h-5 text-zinc-400" />
              </div>
              <div>
                <h4 className="font-bold text-zinc-700 mb-1">วิธีการใช้งาน</h4>
                <p className="text-sm text-zinc-500 leading-relaxed">
                  อัปโหลดไฟล์ทั้ง 3 ประเภทให้ครบถ้วน ระบบรองรับไฟล์ PDF, Excel และ CSV 
                  AI จะทำการประมวลผลและเปรียบเทียบข้อมูลรายบุคคลให้โดยอัตโนมัติ
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="w-10 h-10 rounded-full bg-zinc-100 flex items-center justify-center shrink-0">
                <AlertCircle className="w-5 h-5 text-zinc-400" />
              </div>
              <div>
                <h4 className="font-bold text-zinc-700 mb-1">ความปลอดภัยของข้อมูล</h4>
                <p className="text-sm text-zinc-500 leading-relaxed">
                  ข้อมูลของคุณจะถูกใช้เพื่อการวิเคราะห์เท่านั้น 
                  โปรดตรวจสอบความถูกต้องของข้อมูลอีกครั้งก่อนนำไปใช้งานจริงในระบบราชการ
                </p>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
