import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GoogleGenAI } from "@google/genai";
import { Loader2, ClipboardIcon as ClipboardIconLucide, CheckCircle as CheckCircleIconLucide } from 'lucide-react';
import { BackIcon, XCircleIcon } from './Icons';
import * as geminiService from '../services/geminiService';
import { getApiErrorMessage, isInvalidApiKeyError, isRateLimitError, API_LIMIT_ERROR_MESSAGE } from '../utils';

const CharacterConsistencyPromptPage = ({ onBack }: { onBack: () => void; }) => {
    const [apiKeys, setApiKeys] = useState<string[]>([]);
    const [isKeySet, setIsKeySet] = useState(false);
    const [apiKeyStatuses, setApiKeyStatuses] = useState<{ [key: string]: string; }>({});
    const apiKeyIndex = useRef(0);
    const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Step 1 State
    const [step1Content, setStep1Content] = useState('');
    const [step1Duration, setStep1Duration] = useState(60);
    const [step1Result, setStep1Result] = useState('');
    const [isGeneratingStep1, setIsGeneratingStep1] = useState(false);
    const [step1CopySuccess, setStep1CopySuccess] = useState(false);

    // Step 2 State
    const [step2Start, setStep2Start] = useState(1);
    const [step2End, setStep2End] = useState(5);
    const [step2Result, setStep2Result] = useState('');
    const [isGeneratingStep2, setIsGeneratingStep2] = useState(false);
    const [step2CopySuccess, setStep2CopySuccess] = useState(false);

    // Step 3 State
    const [step3Start, setStep3Start] = useState(1);
    const [step3End, setStep3End] = useState(5);
    const [step3Result, setStep3Result] = useState('');
    const [isGeneratingStep3, setIsGeneratingStep3] = useState(false);
    const [step3CopySuccess, setStep3CopySuccess] = useState(false);
    
    useEffect(() => {
        const storedKeys = localStorage.getItem("gemini-api-keys");
        if (storedKeys) {
            const parsedKeys = JSON.parse(storedKeys);
            if (Array.isArray(parsedKeys) && parsedKeys.length > 0) {
              setApiKeys(parsedKeys);
              setIsKeySet(true);
              const initialStatuses: { [key: string]: string } = {};
              parsedKeys.forEach((key) => { initialStatuses[key] = 'ready'; });
              setApiKeyStatuses(initialStatuses);
            }
        }
    }, []);

    const handleSaveApiKeys = useCallback(async (keys: string[]) => {
        localStorage.setItem("gemini-api-keys", JSON.stringify(keys));
        setApiKeys(keys);
        setIsKeySet(keys.length > 0);
        setIsApiKeyModalOpen(false);
        apiKeyIndex.current = 0;
        
        const checkingStatuses: { [key: string]: string } = {};
        keys.forEach(key => { checkingStatuses[key] = 'checking'; });
        setApiKeyStatuses(checkingStatuses);

        const newStatuses: { [key: string]: string } = {};
        for (const key of keys) {
            newStatuses[key] = await geminiService.validateApiKey(key);
        }
        setApiKeyStatuses(newStatuses);
    }, []);

    const withApiKeyRotation = useCallback(async (apiCall: (apiKey: string) => Promise<any>) => {
        if (apiKeys.length === 0) {
            setError("Vui lòng thiết lập API Key trước.");
            throw new Error("API Key not set.");
        }
        const initialIndex = apiKeyIndex.current;
        let attempts = 0;
        while (attempts < apiKeys.length) {
            const currentIndex = (initialIndex + attempts) % apiKeys.length;
            const currentApiKey = apiKeys[currentIndex];
            apiKeyIndex.current = currentIndex;
            const status = apiKeyStatuses[currentApiKey];
            if (status === 'exhausted' || status === 'invalid' || status === 'error') {
                attempts++;
                continue;
            }
            try {
                const result = await apiCall(currentApiKey);
                setError(null);
                return result;
            } catch (err) {
                if (isRateLimitError(err)) {
                    setApiKeyStatuses(prev => ({ ...prev, [currentApiKey]: 'exhausted' }));
                    attempts++;
                } else if (isInvalidApiKeyError(err)) {
                     setApiKeyStatuses(prev => ({ ...prev, [currentApiKey]: 'invalid' }));
                     attempts++;
                } else {
                    const errorMessage = getApiErrorMessage(err);
                    setError(errorMessage);
                    throw err;
                }
            }
        }
        setError(API_LIMIT_ERROR_MESSAGE);
        throw new Error("All available API keys failed or are exhausted.");
    }, [apiKeys, apiKeyStatuses]);

    const handleGenerateStep1 = async () => {
        if (!step1Content.trim()) { setError("Vui lòng nhập nội dung kịch bản."); return; }
        setIsGeneratingStep1(true); setError(null); setStep1Result('');
        try {
            const result = await withApiKeyRotation(key => geminiService.generateBiblesAndOutline(key, step1Content, step1Duration));
            setStep1Result(result);
        } catch (err) { /* error handled in withApiKeyRotation */ } finally { setIsGeneratingStep1(false); }
    };
    
    const handleGenerateStep2 = async () => {
        if (!step1Result.trim()) { setError("Vui lòng hoàn thành Bước 1 trước."); return; }
        setIsGeneratingStep2(true); setError(null); setStep2Result('');
        try {
            const result = await withApiKeyRotation(key => geminiService.generateScenesList(key, step1Result, step2Start, step2End));
            setStep2Result(result);
        } catch (err) { /* error handled in withApiKeyRotation */ } finally { setIsGeneratingStep2(false); }
    };
    
    const handleGenerateStep3 = async () => {
        if (!step1Result.trim() || !step2Result.trim()) { setError("Vui lòng hoàn thành Bước 1 và 2 trước."); return; }
        setIsGeneratingStep3(true); setError(null); setStep3Result('');
        try {
            const result = await withApiKeyRotation(key => geminiService.generateJsonPrompts(key, step1Result, step2Result, step3Start, step3End));
            setStep3Result(result);
        } catch (err) { /* error handled in withApiKeyRotation */ } finally { setIsGeneratingStep3(false); }
    };
    
    const handleCopy = (text: string, setSuccess: React.Dispatch<React.SetStateAction<boolean>>) => {
        navigator.clipboard.writeText(text);
        setSuccess(true);
        setTimeout(() => setSuccess(false), 2000);
    };

    const ApiKeyModal = ({ isOpen, onClose, onSave, initialKeys }: { isOpen: boolean, onClose: () => void, onSave: (keys: string[]) => void, initialKeys: string[] }) => {
        const [keysInput, setKeysInput] = useState(initialKeys.join('\n'));
        useEffect(() => { setKeysInput(initialKeys.join('\n')); }, [initialKeys, isOpen]);
        if (!isOpen) return null;
        return (
            <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
                <div className="bg-blue-900 rounded-xl shadow-2xl w-full max-w-2xl border border-blue-800">
                    <div className="p-6"><h2 className="text-xl font-bold text-gray-100">Quản lý API Keys</h2><textarea value={keysInput} onChange={(e) => setKeysInput(e.target.value)} placeholder="Dán API key, mỗi key một dòng..." rows={8} className="w-full mt-4 p-3 bg-blue-950 border border-blue-700 rounded-md focus:ring-2 focus:ring-lime-500 text-gray-200 font-mono" /></div>
                    <div className="bg-blue-950/50 px-6 py-4 rounded-b-xl flex justify-end gap-4"><button onClick={onClose} className="px-4 py-2 text-gray-300 hover:text-white font-semibold rounded-lg">Hủy</button><button onClick={() => onSave(keysInput.split(/[\n,]+/).map(k => k.trim()).filter(Boolean))} className="px-6 py-2 bg-lime-600 hover:bg-lime-700 text-white font-bold rounded-lg">Lưu Keys</button></div>
                </div>
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-blue-950 text-gray-100 p-4 sm:p-8">
            <ApiKeyModal isOpen={isApiKeyModalOpen} onClose={() => setIsApiKeyModalOpen(false)} onSave={handleSaveApiKeys} initialKeys={apiKeys} />
            <header className="text-center mb-10 relative">
                <button onClick={onBack} className="absolute left-0 top-1/2 -translate-y-1/2 p-2 bg-blue-900 hover:bg-blue-800 rounded-full transition-colors" aria-label="Quay lại"><BackIcon className="w-6 h-6 text-gray-300" /></button>
                <h1 className="text-5xl mb-2 font-black text-gray-100">RIVER SƠN MASTER</h1>
                <h1 className="text-xl sm:text-2xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-teal-400 py-2">PROMPT NHẤT QUÁN NHÂN VẬT</h1>
            </header>
            <main className="max-w-7xl mx-auto space-y-8">
                <div className="bg-blue-900/50 p-6 rounded-xl shadow-lg border border-blue-800">
                    <h2 className="text-xl font-bold mb-4 text-cyan-300">Bước 1: Tạo Bibles & Dàn ý</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-semibold mb-2 text-gray-300">Nội dung kịch bản</label>
                                <textarea value={step1Content} onChange={(e) => setStep1Content(e.target.value)} rows={5} className="w-full p-2 bg-blue-800 border border-blue-700 rounded-md" placeholder="Dán nội dung kịch bản của bạn vào đây..."></textarea>
                            </div>
                            <div>
                                <label className="block text-sm font-semibold mb-2 text-gray-300">Thời lượng (giây)</label>
                                <input type="number" value={step1Duration} onChange={(e) => setStep1Duration(Number(e.target.value))} className="w-full p-2 bg-blue-800 border border-blue-700 rounded-md" />
                            </div>
                            <button onClick={handleGenerateStep1} disabled={isGeneratingStep1 || !isKeySet} className="w-full flex items-center justify-center gap-2 py-2 bg-cyan-600 hover:bg-cyan-700 disabled:bg-cyan-900 rounded-lg font-semibold">{isGeneratingStep1 ? <><Loader2 className="w-5 h-5 animate-spin" /> Đang tạo...</> : "Tạo Bước 1"}</button>
                            {!isKeySet && <button onClick={() => setIsApiKeyModalOpen(true)} className="w-full py-2 bg-yellow-600 hover:bg-yellow-700 rounded-lg font-semibold">Thiết lập API Key</button>}
                        </div>
                        <div className="relative">
                            <textarea value={step1Result} readOnly rows={10} className="w-full h-full p-2 bg-blue-950 border border-blue-700 rounded-md" placeholder="Kết quả Bước 1..."></textarea>
                            <button onClick={() => handleCopy(step1Result, setStep1CopySuccess)} className="absolute top-2 right-2 p-1.5 bg-gray-600 hover:bg-gray-500 rounded-md">{step1CopySuccess ? <CheckCircleIconLucide className="w-4 h-4 text-green-400"/> : <ClipboardIconLucide className="w-4 h-4" />}</button>
                        </div>
                    </div>
                </div>

                <div className={`bg-blue-900/50 p-6 rounded-xl shadow-lg border border-blue-800 transition-opacity ${!step1Result && 'opacity-50'}`}>
                    <h2 className="text-xl font-bold mb-4 text-cyan-300">Bước 2: Tạo Danh sách Cảnh</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                             <div className="flex gap-4">
                                <div><label className="block text-sm font-semibold mb-2 text-gray-300">Cảnh bắt đầu</label><input type="number" value={step2Start} onChange={(e) => setStep2Start(Number(e.target.value))} className="w-full p-2 bg-blue-800 border border-blue-700 rounded-md" /></div>
                                <div><label className="block text-sm font-semibold mb-2 text-gray-300">Cảnh kết thúc</label><input type="number" value={step2End} onChange={(e) => setStep2End(Number(e.target.value))} className="w-full p-2 bg-blue-800 border border-blue-700 rounded-md" /></div>
                             </div>
                            <button onClick={handleGenerateStep2} disabled={isGeneratingStep2 || !step1Result} className="w-full flex items-center justify-center gap-2 py-2 bg-cyan-600 hover:bg-cyan-700 disabled:bg-cyan-900 rounded-lg font-semibold">{isGeneratingStep2 ? <><Loader2 className="w-5 h-5 animate-spin" /> Đang tạo...</> : "Tạo Bước 2"}</button>
                        </div>
                        <div className="relative">
                            <textarea value={step2Result} readOnly rows={10} className="w-full h-full p-2 bg-blue-950 border border-blue-700 rounded-md" placeholder="Kết quả Bước 2..."></textarea>
                             <button onClick={() => handleCopy(step2Result, setStep2CopySuccess)} className="absolute top-2 right-2 p-1.5 bg-gray-600 hover:bg-gray-500 rounded-md">{step2CopySuccess ? <CheckCircleIconLucide className="w-4 h-4 text-green-400"/> : <ClipboardIconLucide className="w-4 h-4" />}</button>
                        </div>
                    </div>
                </div>

                 <div className={`bg-blue-900/50 p-6 rounded-xl shadow-lg border border-blue-800 transition-opacity ${!step2Result && 'opacity-50'}`}>
                    <h2 className="text-xl font-bold mb-4 text-cyan-300">Bước 3: Tạo JSON Prompts</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                             <div className="flex gap-4">
                                <div><label className="block text-sm font-semibold mb-2 text-gray-300">Cảnh bắt đầu</label><input type="number" value={step3Start} onChange={(e) => setStep3Start(Number(e.target.value))} className="w-full p-2 bg-blue-800 border border-blue-700 rounded-md" /></div>
                                <div><label className="block text-sm font-semibold mb-2 text-gray-300">Cảnh kết thúc</label><input type="number" value={step3End} onChange={(e) => setStep3End(Number(e.target.value))} className="w-full p-2 bg-blue-800 border border-blue-700 rounded-md" /></div>
                             </div>
                            <button onClick={handleGenerateStep3} disabled={isGeneratingStep3 || !step2Result} className="w-full flex items-center justify-center gap-2 py-2 bg-cyan-600 hover:bg-cyan-700 disabled:bg-cyan-900 rounded-lg font-semibold">{isGeneratingStep3 ? <><Loader2 className="w-5 h-5 animate-spin" /> Đang tạo...</> : "Tạo Bước 3"}</button>
                        </div>
                        <div className="relative">
                            <textarea value={step3Result} readOnly rows={10} className="w-full h-full p-2 bg-blue-950 border border-blue-700 rounded-md font-mono text-xs" placeholder="Kết quả Bước 3 (JSON)..."></textarea>
                             <button onClick={() => handleCopy(step3Result, setStep3CopySuccess)} className="absolute top-2 right-2 p-1.5 bg-gray-600 hover:bg-gray-500 rounded-md">{step3CopySuccess ? <CheckCircleIconLucide className="w-4 h-4 text-green-400"/> : <ClipboardIconLucide className="w-4 h-4" />}</button>
                        </div>
                    </div>
                </div>

                {error && (
                    <div className="fixed bottom-4 right-4 w-full max-w-md bg-red-800/90 text-white p-4 rounded-lg shadow-lg border border-red-600 backdrop-blur-sm animate-fadeInUp">
                        <div className="flex justify-between items-start">
                             <div><strong className="font-bold">Đã xảy ra lỗi:</strong><br/>{error}</div>
                             <button onClick={() => setError(null)} className="p-1 -mt-1 -mr-1"><XCircleIcon className="w-6 h-6"/></button>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
};

export default CharacterConsistencyPromptPage;
