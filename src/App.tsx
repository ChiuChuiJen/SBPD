/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { ClipboardCopy, RefreshCw, Image as ImageIcon, Loader2, History, X, BookOpen } from 'lucide-react';
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
      maternity: number;
      marriage: number;
      funeral: number;
      abroad: number;
    };
  } | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isHistoryOpen, setIsHistoryOpen] = useState(true);
  const [isKeywordOpen, setIsKeywordOpen] = useState(false);

  const versionHistory = [
    { version: 'V1.11', date: '2026/04/26', desc: '新增「出國」統計項目（與「回國」區分），並加入「假別歸屬」查詢清單。' },
    { version: 'V1.10', date: '2026/04/13', desc: '修正數據校驗邏輯，將「加班」從假別總和中扣除，正確匹配應到人數。' },
    { version: 'V1.9', date: '2026/04/08', desc: '將「晚到/遲到」納入假別總和計算，並支援「遲到」關鍵字。' },
    { version: 'V1.8.2', date: '2026/04/05', desc: '支援 x 或 * 作為數字乘號（例如：事假x2）。' },
    { version: 'V1.8.1', date: '2026/04/05', desc: '修正全形數字（如 ３）無法正確辨識的問題。' },
    { version: 'V1.8', date: '2026/04/05', desc: '實作數據校驗功能，實到與應到不符時顯示紅色警示與差異提示。' },
    { version: 'V1.7', date: '2026/04/05', desc: '新增「喪假」統計項目，更新 AI 辨識指令。' },
    { version: 'V1.6', date: '2026/04/05', desc: '新增「產假」與「婚假」統計，優化圖片上傳穩定性與錯誤處理。' },
    { version: 'V1.5.2', date: '2026/04/03', desc: '強化 Vercel 部署時的 API Key 設定提示與處理機制。' },
    { version: 'V1.5.1', date: '2026/04/03', desc: '修正 AI 模型名稱，改善圖片辨識錯誤提示。' },
    { version: 'V1.5', date: '2026/04/03', desc: '重新整合 Gemini AI 進行截圖辨識，更新系統架構。' },
  ];

  // Update time every minute to keep Day/Night accurate
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const handleCalculate = () => {
    // 將全形數字轉換為半形數字，避免辨識失敗
    const text = inputText.replace(/[０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xfee0));
    
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

    const expected = getSum(/(?:應到|應)[:：\s*xX]*(\d+)/g);
    const actual = getSum(/(?:實到|實)[:：\s*xX]*(\d+)/g);

    const counts = {
      overtime: getSum(/(?:加班|加)[:：\s*xX]*(\d+)?/g, 1),
      annual: getSum(/(?:特休假|特休|特)[:：\s*xX]*(\d+)?/g, 1),
      personal: getSum(/(?:事假|事)[:：\s*xX]*(\d+)?/g, 1),
      sick: getSum(/(?:病假|病)[:：\s*xX]*(\d+)?/g, 1),
      menstrual: getSum(/(?:生理假|生理|生)[:：\s*xX]*(\d+)?/g, 1),
      official: getSum(/(?:公假|公)[:：\s*xX]*(\d+)?/g, 1),
      return: getSum(/(?:回國|回)[:：\s*xX]*(\d+)?/g, 1),
      absent: getSum(/(?:未到|未)[:：\s*xX]*(\d+)?/g, 1),
      late: getSum(/(?:晚到|晚|遲到|遲)[:：\s*xX]*(\d+)?/g, 1),
      maternity: getSum(/(?:陪產假|陪產|產)[:：\s*xX]*(\d+)?/g, 1),
      marriage: getSum(/(?:結婚|婚假|婚)[:：\s*xX]*(\d+)?/g, 1),
      funeral: getSum(/(?:喪假|喪)[:：\s*xX]*(\d+)?/g, 1),
      abroad: getSum(/(?:出國|出)[:：\s*xX]*(\d+)?/g, 1),
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
              { text: "請辨識這張截圖中的出勤資料。請直接輸出文字內容，包含應到、實到以及各種假別（如特休、病假、加班、晚到、產假、婚假、喪假、出國、回國等）的人數。不需要額外的解釋，直接輸出辨識到的文字即可。" }
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

    reader.onerror = () => {
      console.error("File reading error");
      alert("檔案讀取失敗。");
      setIsAnalyzing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    };

    reader.readAsDataURL(file);
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
    if (result.counts.abroad > 0) output += `\n出國:  ${result.counts.abroad}`;
    if (result.counts.return > 0) output += `\n回國:  ${result.counts.return}`;
    if (result.counts.absent > 0) output += `\n未到:  ${result.counts.absent}`;
    if (result.counts.late > 0) output += `\n晚到:  ${result.counts.late}`;
    if (result.counts.maternity > 0) output += `\n產假:  ${result.counts.maternity}`;
    if (result.counts.marriage > 0) output += `\n婚假:  ${result.counts.marriage}`;
    if (result.counts.funeral > 0) output += `\n喪假:  ${result.counts.funeral}`;

    return output;
  };

  const isCountValid = () => {
    if (!result) return true;
    const { expected, actual, counts } = result;
    // 假別總和
    const leaveSum = 
      counts.annual + 
      counts.personal + 
      counts.sick + 
      counts.menstrual + 
      counts.official + 
      counts.abroad + 
      counts.return + 
      counts.absent + 
      counts.late + 
      counts.maternity + 
      counts.marriage + 
      counts.funeral;
    
    // 應到 = 實到 + 假別總和 - 加班
    return expected === (actual + leaveSum - counts.overtime);
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
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsKeywordOpen(true)}
              className="text-sm font-medium text-gray-600 hover:text-green-600 flex items-center gap-1 transition-colors"
            >
              <BookOpen size={16} />
              假別歸屬
            </button>
            <button 
              onClick={() => setIsHistoryOpen(true)}
              className="text-sm font-medium text-gray-600 hover:text-blue-600 flex items-center gap-1 transition-colors"
            >
              <History size={16} />
              版本歷史
            </button>
            <span className="text-sm font-medium text-gray-500 bg-gray-200 px-3 py-1 rounded-full">V1.11</span>
          </div>
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
              <div className="relative">
                <pre className={`p-6 rounded-lg font-mono text-sm leading-relaxed overflow-x-auto whitespace-pre-wrap transition-colors ${
                  isCountValid() ? 'bg-gray-800 text-green-400' : 'bg-red-50 text-red-600 border border-red-200'
                }`}>
                  {generateOutputText()}
                </pre>
                {!isCountValid() && (
                  <div className="mt-2 text-xs text-red-500 font-medium flex items-center gap-1">
                    ⚠️ 注意：實到 ({result.actual}) + 假別總和 ({
                      result.counts.annual + 
                      result.counts.personal + 
                      result.counts.sick + 
                      result.counts.menstrual + 
                      result.counts.official + 
                      result.counts.abroad + 
                      result.counts.return + 
                      result.counts.absent + 
                      result.counts.late + 
                      result.counts.maternity + 
                      result.counts.marriage + 
                      result.counts.funeral
                    }){result.counts.overtime > 0 ? ` - 加班 (${result.counts.overtime})` : ''} 與應到 ({result.expected}) 不符，請檢查輸入資料。
                  </div>
                )}
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-gray-400 border-2 border-dashed border-gray-200 rounded-lg">
                請輸入資料並點擊「開始統計」
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="text-right text-xs text-gray-400 pt-2 pb-4">
          &copy; {currentTime.getFullYear()} ChiuChuiJen
        </div>

      </div>

      {/* Version History Modal */}
      {isHistoryOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2"><History size={18}/> 版本歷史</h2>
              <button onClick={() => setIsHistoryOpen(false)} className="text-gray-500 hover:text-gray-700 transition-colors"><X size={20}/></button>
            </div>
            <div className="p-4 overflow-y-auto flex-1 space-y-4">
              {versionHistory.map((item, idx) => (
                <div key={idx} className="border-b border-gray-100 pb-3 last:border-0 last:pb-0">
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="font-bold text-blue-600">{item.version}</span>
                    <span className="text-xs text-gray-400">{item.date}</span>
                  </div>
                  <p className="text-sm text-gray-600">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Keyword Mapping Modal */}
      {isKeywordOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[80vh] flex flex-col">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2"><BookOpen size={18}/> 假別歸屬 (關鍵字對照)</h2>
              <button onClick={() => setIsKeywordOpen(false)} className="text-gray-500 hover:text-gray-700 transition-colors"><X size={20}/></button>
            </div>
            <div className="p-4 overflow-y-auto flex-1 h-full">
              <table className="w-full text-sm text-left border-collapse">
                <thead className="bg-gray-50 text-gray-700 uppercase text-xs">
                  <tr>
                    <th className="px-4 py-2 border-b">假別</th>
                    <th className="px-4 py-2 border-b">識別關鍵字</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-gray-600">
                  <tr><td className="px-4 py-2 font-medium">特休</td><td className="px-4 py-2">特休假、特休、特</td></tr>
                  <tr><td className="px-4 py-2 font-medium">事假</td><td className="px-4 py-2">事假、事</td></tr>
                  <tr><td className="px-4 py-2 font-medium">病假</td><td className="px-4 py-2">病假、病</td></tr>
                  <tr><td className="px-4 py-2 font-medium">生理假</td><td className="px-4 py-2">生理假、生理、生</td></tr>
                  <tr><td className="px-4 py-2 font-medium">公假</td><td className="px-4 py-2">公假、公</td></tr>
                  <tr><td className="px-4 py-2 font-medium">產假</td><td className="px-4 py-2">陪產假、陪產、產</td></tr>
                  <tr><td className="px-4 py-2 font-medium">婚假</td><td className="px-4 py-2">結婚、婚假、婚</td></tr>
                  <tr><td className="px-4 py-2 font-medium">喪假</td><td className="px-4 py-2">喪假、喪</td></tr>
                  <tr><td className="px-4 py-2 font-medium">出國</td><td className="px-4 py-2">出國、出</td></tr>
                  <tr><td className="px-4 py-2 font-medium">回國</td><td className="px-4 py-2">回國、回</td></tr>
                  <tr><td className="px-4 py-2 font-medium">未到</td><td className="px-4 py-2">未到、未</td></tr>
                  <tr><td className="px-4 py-2 font-medium">晚到/遲到</td><td className="px-4 py-2">晚到、晚、遲到、遲</td></tr>
                  <tr><td className="px-4 py-2 font-medium border-t-2 border-gray-100">加班</td><td className="px-4 py-2 border-t-2 border-gray-100">加班、加</td></tr>
                  <tr><td className="px-4 py-2 font-medium">應到</td><td className="px-4 py-2">應到、應</td></tr>
                  <tr><td className="px-4 py-2 font-medium">實到</td><td className="px-4 py-2">實到、實</td></tr>
                </tbody>
              </table>
              <div className="mt-4 text-xs text-gray-500 bg-gray-50 p-3 rounded-lg border border-gray-200">
                📌 系統也支援乘號，例如：「事假x2」或「特休*3」，若未標示數量則預設為 1 人。
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
