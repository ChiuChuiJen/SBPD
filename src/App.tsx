/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { ClipboardCopy, RefreshCw, Image as ImageIcon, Loader2 } from 'lucide-react';
import { GoogleGenAI } from "@google/genai";

export default function App() {
  const [inputText, setInputText] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [result, setResult] = useState<{
    expected: number;
    actual: number;
    counts: {
      overtime: number;
      annual: number;
      personal: number;
      sick: number;
      menstrual: number;
      official: number;
      return: number;
      absent: number;
      late: number;
    };
  } | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Update time every minute to keep Day/Night accurate
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const handleCalculate = () => {
    const text = inputText;
    
    const getSum = (regex: RegExp, defaultVal: number = 0) => {
      const matches = [...text.matchAll(regex)];
      let total = 0;
      for (const m of matches) {
        if (m[1] !== undefined && m[1].trim() !== '') {
          total += parseInt(m[1], 10);
        } else {
          total += defaultVal;
        }
      }
      return total;
    };

    const expected = getSum(/(?:應到|應)[:：\s]*(\d+)/g);
    const actual = getSum(/(?:實到|實)[:：\s]*(\d+)/g);

    const counts = {
      overtime: getSum(/(?:加班|加)[:：\s]*(\d+)?/g, 1),
      annual: getSum(/(?:特休假|特休|特)[:：\s]*(\d+)?/g, 1),
      personal: getSum(/(?:事假|事)[:：\s]*(\d+)?/g, 1),
      sick: getSum(/(?:病假|病)[:：\s]*(\d+)?/g, 1),
      menstrual: getSum(/(?:生理假|生理|生)[:：\s]*(\d+)?/g, 1),
      official: getSum(/(?:公假|公)[:：\s]*(\d+)?/g, 1),
      return: getSum(/(?:回國|回)[:：\s]*(\d+)?/g, 1),
      absent: getSum(/(?:未到|未)[:：\s]*(\d+)?/g, 1),
      late: getSum(/(?:晚到|晚)[:：\s]*(\d+)?/g, 1),
    };

    setResult({
      expected,
      actual,
      counts
    });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsAnalyzing(true);
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        try {
          const base64Data = (reader.result as string).split(',')[1];
          
          const apiKey = process.env.GEMINI_API_KEY;
          if (!apiKey || apiKey === 'undefined') {
            throw new Error("找不到 API Key。請在 Vercel 的 Environment Variables 中設定 GEMINI_API_KEY。");
          }
          
          const ai = new GoogleGenAI({ apiKey });
          const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: {
              parts: [
                { inlineData: { data: base64Data, mimeType: file.type } },
                { text: "請辨識這張截圖中的出勤資料。請直接輸出文字內容，包含應到、實到以及各種假別（如特休、病假、加班、晚到等）的人數。不需要額外的解釋，直接輸出辨識到的文字即可。" }
              ]
            }
          });

          const extractedText = response.text || '';
          setInputText(prev => prev ? prev + '\n' + extractedText : extractedText);
        } catch (err) {
          console.error("AI Analysis error:", err);
          alert(`圖片辨識失敗：${err instanceof Error ? err.message : '未知錯誤'}`);
        } finally {
          setIsAnalyzing(false);
          if (fileInputRef.current) fileInputRef.current.value = '';
        }
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error("File reading error:", error);
      alert("檔案讀取失敗。");
      setIsAnalyzing(false);
    }
  };

  const getHeaderInfo = () => {
    const year = currentTime.getFullYear();
    const month = String(currentTime.getMonth() + 1).padStart(2, '0');
    const date = String(currentTime.getDate()).padStart(2, '0');
    
    const hours = currentTime.getHours();
    const minutes = currentTime.getMinutes();
    const timeValue = hours * 60 + minutes;
    
    // 08:30~20:29 顯示日、20:30~08:29 顯示夜
    const isDay = timeValue >= (8 * 60 + 30) && timeValue < (20 * 60 + 30);
    const shift = isDay ? '日' : '夜';
    
    return `${year}/${month}/${date} ${shift}`;
  };

  const generateOutputText = () => {
    if (!result) return '';
    
    const rateNum = result.expected === 0 ? 0 : Math.round((result.actual / result.expected) * 100);
    
    let output = `${getHeaderInfo()}
M3-SB出勤
SB: ${result.actual}/${result.expected}   ${rateNum}%`;

    if (result.counts.overtime > 0) output += `\n加班:  ${result.counts.overtime}`;
    if (result.counts.annual > 0) output += `\n特休:  ${result.counts.annual}`;
    if (result.counts.personal > 0) output += `\n事假:  ${result.counts.personal}`;
    if (result.counts.sick > 0) output += `\n病假:  ${result.counts.sick}`;
    if (result.counts.menstrual > 0) output += `\n生理假: ${result.counts.menstrual}`;
    if (result.counts.official > 0) output += `\n公假:  ${result.counts.official}`;
    if (result.counts.return > 0) output += `\n回國:  ${result.counts.return}`;
    if (result.counts.absent > 0) output += `\n未到:  ${result.counts.absent}`;
    if (result.counts.late > 0) output += `\n晚到:  ${result.counts.late}`;

    return output;
  };

  const handleCopy = () => {
    const text = generateOutputText();
    if (text) {
      navigator.clipboard.writeText(text);
      alert('已複製到剪貼簿！');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8 font-sans">
      <div className="max-w-3xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-800">SB出勤人數 統計系統</h1>
          <span className="text-sm font-medium text-gray-500 bg-gray-200 px-3 py-1 rounded-full">V1.5.2</span>
        </div>

        {/* Input Section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
            <h2 className="text-lg font-semibold text-gray-700">輸入資料</h2>
            <div className="flex items-center gap-2">
              <input 
                type="file" 
                accept="image/*" 
                className="hidden" 
                ref={fileInputRef}
                onChange={handleImageUpload}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isAnalyzing}
                className="flex items-center gap-2 text-xs bg-white hover:bg-gray-100 text-blue-600 border border-blue-200 px-3 py-1.5 rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                {isAnalyzing ? <Loader2 size={14} className="animate-spin" /> : <ImageIcon size={14} />}
                {isAnalyzing ? 'AI 辨識中...' : '上傳截圖 (AI)'}
              </button>
              <span className="text-xs text-gray-500">請輸入出勤資料，或上傳截圖</span>
            </div>
          </div>
          <div className="p-4">
            <textarea
              className="w-full h-64 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-y font-mono text-sm"
              placeholder="在此貼上多個單位的出勤資料...&#10;單位A: 應10 實9 特1&#10;單位B: 應5 實5&#10;系統會自動加總所有單位的數據"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
            ></textarea>
            <div className="mt-4 flex justify-end gap-3">
              <button
                onClick={() => {
                  setInputText('');
                  setResult(null);
                }}
                className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 px-6 py-2 rounded-lg font-medium transition-colors"
              >
                清除內容
              </button>
              <button
                onClick={handleCalculate}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"
              >
                <RefreshCw size={18} />
                開始統計
              </button>
            </div>
          </div>
        </div>

        {/* Output Section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
            <h2 className="text-lg font-semibold text-gray-700">統計資訊</h2>
            <button
              onClick={handleCopy}
              disabled={!result}
              className="flex items-center gap-2 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-1.5 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ClipboardCopy size={16} />
              複製結果
            </button>
          </div>
          <div className="p-4">
            {result ? (
              <pre className="bg-gray-800 text-green-400 p-6 rounded-lg font-mono text-sm leading-relaxed overflow-x-auto whitespace-pre-wrap">
                {generateOutputText()}
              </pre>
            ) : (
              <div className="h-64 flex items-center justify-center text-gray-400 border-2 border-dashed border-gray-200 rounded-lg">
                請輸入資料並點擊「開始統計」
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
