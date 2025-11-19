
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Loader2, ClipboardIcon as ClipboardIconLucide, CheckCircle as CheckCircleIconLucide } from 'lucide-react';
import * as xlsx from 'xlsx';
import { BackIcon, XCircleIcon, DownloadIcon, UploadIcon, KeyIcon, CheckCircleIcon } from './Icons';
import * as geminiService from '../services/geminiService';
import { getApiErrorMessage, isInvalidApiKeyError, isRateLimitError, API_LIMIT_ERROR_MESSAGE } from '../utils';

const formatKeyForDisplay = (key: string) => `${key.substring(0, 4)}...${key.substring(key.length - 4)}`;

const PromptToolPage = ({ onBack }: { onBack: () => void; }) => {
    const [apiKeys, setApiKeys] = useState<string[]>([]);
    const [isKeySet, setIsKeySet] = useState(false);
    const [apiKeyStatuses, setApiKeyStatuses] = useState<{ [key: string]: string; }>({});
    const apiKeyIndex = useRef(0);
    const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Step 1 State
    const [step1Content, setStep1Content] = useState('');
    const [step1Duration, setStep1Duration] = useState(60);
    const [characterReferenceImage, setCharacterReferenceImage] = useState<{ file: File, base64: string, previewUrl: string } | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
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

    const statusMap: {[key: string]: {text: string, color: string, icon: React.ReactNode}} = {
        ready: { text: 'Sẵn sàng', color: 'bg-green-500/80 text-white', icon: <CheckCircleIcon className="w-4 h-4 text-green-400" /> },
        exhausted: { text: 'Hết hạn', color: 'bg-red-500/80 text-white', icon: <XCircleIcon className="w-4 h-4 text-red-300" /> },
        invalid: { text: 'Không hợp lệ', color: 'bg-yellow-500/80 text-black', icon: <XCircleIcon className="w-4 h-4 text-yellow-800" /> },
        error: { text: 'Lỗi', color: 'bg-gray-500/80 text-white', icon: <XCircleIcon className="w-4 h-4 text-gray-300" /> },
        checking: { text: 'Đang kiểm tra...', color: 'bg-blue-500/80 text-white', icon: <Loader2 className="animate-spin h-4 w-4 text-white" /> }
    };
    
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

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            if (characterReferenceImage) {
                URL.revokeObjectURL(characterReferenceImage.previewUrl);
            }
            const previewUrl = URL.createObjectURL(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64 = (reader.result as string).split(',')[1];
                setCharacterReferenceImage({ file, base64, previewUrl });
            };
            reader.readAsDataURL(file);
        }
    };

    const handleRemoveImage = () => {
        if (characterReferenceImage) {
            URL.revokeObjectURL(characterReferenceImage.previewUrl);
        }
        setCharacterReferenceImage(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };

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
            const imagePayload = characterReferenceImage 
                ? { base64: characterReferenceImage.base64, mimeType: characterReferenceImage.file.type } 
                : null;
            const result = await withApiKeyRotation(key => geminiService.generateBiblesAndOutline(key, step1Content, step1Duration, imagePayload));
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

    const handleDownloadTxtStep3 = () => {
        if (!step3Result) return;
        try {
            const content = step3Result
                .replace(/\[BẮT ĐẦU PROMPT\]/g, '')
                .replace(/\[KẾT THÚC PROMPT\]/g, '')
                .trim();
                
            const jsonStrings = content.split('[PROMPT TIẾP THEO]');
            
            const allPrompts = jsonStrings.flatMap(jsonStr => {
                if (jsonStr.trim()) {
                    try {
                        const sceneData = JSON.parse(jsonStr.trim());
                        if (sceneData && sceneData.shots && Array.isArray(sceneData.shots)) {
                            return sceneData.shots.map(shot => shot.prompt).filter(Boolean);
                        }
                    } catch (e) {
                        console.error("Lỗi phân tích cú pháp chuỗi JSON:", jsonStr, e);
                        return [];
                    }
                }
                return [];
            });

            if (allPrompts.length === 0) {
                 setError("Không tìm thấy prompt nào hợp lệ trong dữ liệu JSON. Dữ liệu có thể không đúng định dạng.");
                 return;
            }

            const finalContent = allPrompts.join('\n\n');
            
            const blob = new Blob([finalContent], { type: 'text/plain;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'video_prompts.txt';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (e) {
            console.error("Lỗi xử lý prompt để tải xuống TXT:", e);
            if(e instanceof Error) {
                setError(`Không thể xử lý dữ liệu prompt. Lỗi: ${e.message}`);
            } else {
                setError("Không thể xử lý dữ liệu prompt. Dữ liệu có thể không hợp lệ.");
            }
        }
    };

    const handleDownloadExcelStep3 = () => {
        if (!step3Result) return;
        try {
            // 1. Clean and split the raw string into individual JSON strings
            const content = step3Result
                .replace('[BẮT ĐẦU PROMPT]', '')
                .replace('[KẾT THÚC PROMPT]', '')
                .trim();
            const jsonStrings = content.split('[PROMPT TIẾP THEO]');

            // 2. Parse each JSON string and flatten the data
            const flatData: any[] = [];
            jsonStrings.forEach((jsonStr, sceneIndex) => {
                if (jsonStr.trim()) {
                    const sceneData = JSON.parse(jsonStr.trim());
                    const characters = sceneData.characters ? JSON.stringify(sceneData.characters, null, 2) : '';
                    const environment = sceneData.environment ? JSON.stringify(sceneData.environment, null, 2) : '';

                    if (sceneData.shots && Array.isArray(sceneData.shots)) {
                        sceneData.shots.forEach((shot: any, shotIndex: number) => {
                            flatData.push({
                                'Scene': sceneIndex + step3Start,
                                'Shot': shotIndex + 1,
                                'Duration (s)': shot.duration,
                                'Prompt': shot.prompt,
                                'Style': shot.style,
                                'Camera': shot.camera,
                                'Transition': shot.transition,
                                'Dialogue': shot.dialogue,
                                'Audio': shot.audio,
                                'Characters JSON': characters,
                                'Environment JSON': environment,
                            });
                        });
                    }
                }
            });

            if (flatData.length === 0) {
                throw new Error("Không tìm thấy dữ liệu cảnh để xuất.");
            }

            // 3. Create worksheet and workbook
            const worksheet = xlsx.utils.json_to_sheet(flatData);
            worksheet['!cols'] = [
                { wch: 8 }, // Scene
                { wch: 8 }, // Shot
                { wch: 15 }, // Duration
                { wch: 100 }, // Prompt
                { wch: 30 }, // Style
                { wch: 30 }, // Camera
                { wch: 15 }, // Transition
                { wch: 30 }, // Dialogue
                { wch: 50 }, // Audio
                { wch: 50 }, // Characters
                { wch: 50 }, // Environment
            ];
            const workbook = xlsx.utils.book_new();
            xlsx.utils.book_append_sheet(workbook, worksheet, 'JSON Prompts');
            
            // 4. Download
            xlsx.writeFile(workbook, 'json_prompts.xlsx');

        } catch (e) {
            console.error("Lỗi khi xuất file Excel:", e);
            if (e instanceof Error) {
                 setError(`Không thể xuất file Excel. Dữ liệu JSON có thể không hợp lệ. Lỗi: ${e.message}`);
            } else {
                 setError(`Không thể xuất file Excel. Dữ liệu JSON có thể không hợp lệ.`);
            }
        }
    };

    const ApiKeyModal = ({ isOpen, onClose, onSave, initialKeys }: { isOpen: boolean, onClose: () => void, onSave: (keys: string[]) => void, initialKeys: string[] }) => {
        const [keysInput, setKeysInput] = useState(initialKeys.join('\n'));
        useEffect(() => { setKeysInput(initialKeys.join('\n')); }, [initialKeys, isOpen]);
        if (!isOpen) return null;
        return (
            <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
                <div className="bg-lime-900 rounded-xl shadow-2xl w-full max-w-2xl border border-lime-800">
                    <div className="p-6"><h2 className="text-xl font-bold text-lime-100">Quản lý API Keys</h2><textarea value={keysInput} onChange={(e) => setKeysInput(e.target.value)} placeholder="Dán API key, mỗi key một dòng..." rows={8} className="w-full mt-4 p-3 bg-lime-950 border border-lime-700 rounded-md focus:ring-2 focus:ring-lime-500 text-lime-100 font-mono placeholder-lime-600" /></div>
                    <div className="bg-lime-950/50 px-6 py-4 rounded-b-xl flex justify-end gap-4"><button onClick={onClose} className="px-4 py-2 text-lime-300 hover:text-white font-semibold rounded-lg">Hủy</button><button onClick={() => onSave(keysInput.split(/[\n,]+/).map(k => k.trim()).filter(Boolean))} className="px-6 py-2 bg-lime-600 hover:bg-lime-700 text-white font-bold rounded-lg">Lưu Keys</button></div>
                </div>
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-lime-950 text-lime-100 p-4 sm:p-8">
            <ApiKeyModal isOpen={isApiKeyModalOpen} onClose={() => setIsApiKeyModalOpen(false)} onSave={handleSaveApiKeys} initialKeys={apiKeys} />
            <header className="text-center mb-10 relative">
                <button onClick={onBack} className="absolute left-0 top-1/2 -translate-y-1/2 p-2 bg-lime-900 hover:bg-lime-800 rounded-full transition-colors" aria-label="Quay lại"><BackIcon className="w-6 h-6 text-gray-300" /></button>
                <h1 className="text-5xl mb-2 font-black text-lime-100">RIVER SƠN MASTER</h1>
                <h1 className="text-xl sm:text-2xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-teal-400 py-2">TẠO PROMPT VIDEO (NHẤT QUÁN NHÂN VẬT)</h1>
            </header>
            <main className="max-w-7xl mx-auto space-y-8">
                <div className="bg-lime-900/50 p-6 rounded-xl shadow-lg border border-lime-800">
                    <h2 className="text-xl font-bold mb-4 text-cyan-300">Bước 1: Tạo Bibles & Dàn ý</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                            {/* API Key Section */}
                             <div className="bg-lime-950/50 p-4 rounded-lg border border-lime-800 mb-4">
                                <h3 className="text-sm font-semibold text-lime-200 mb-3 flex items-center"><KeyIcon className="w-4 h-4 mr-2 text-yellow-400" />Quản lý API Key</h3>
                                <div className="space-y-2 mb-3">
                                    {apiKeys.length > 0 ? apiKeys.slice(0, 3).map(key => {
                                        const status = apiKeyStatuses[key] || 'checking';
                                        const { text, color, icon } = statusMap[status];
                                        return (
                                            <div key={key} className="flex items-center justify-between p-2 rounded-md bg-lime-900 text-xs">
                                                <div className="flex items-center space-x-2">
                                                    {icon}
                                                    <span className="text-lime-300 font-mono">{formatKeyForDisplay(key)}</span>
                                                </div>
                                                <span className={`font-semibold px-1.5 py-0.5 rounded-full ${color}`}>{text}</span>
                                            </div>
                                        );
                                    }) : <p className="text-xs text-lime-400 text-center py-1">Chưa có API Key nào.</p>}
                                </div>
                                <button onClick={() => setIsApiKeyModalOpen(true)} className="w-full px-3 py-1.5 bg-yellow-600 hover:bg-yellow-700 text-white font-bold rounded-lg text-sm transition-colors">
                                    {isKeySet ? `Quản lý ${apiKeys.length} Keys` : 'Thiết lập API Keys'}
                                </button>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold mb-2 text-lime-300">Nội dung kịch bản</label>
                                <textarea value={step1Content} onChange={(e) => setStep1Content(e.target.value)} rows={5} className="w-full p-2 bg-lime-800 border border-lime-700 rounded-md placeholder-lime-500 text-lime-100" placeholder="Dán nội dung kịch bản của bạn vào đây..."></textarea>
                            </div>
                            <div>
                                <label className="block text-sm font-semibold mb-2 text-lime-300">Thời lượng (giây)</label>
                                <input type="number" value={step1Duration} onChange={(e) => setStep1Duration(Number(e.target.value))} className="w-full p-2 bg-lime-800 border border-lime-700 rounded-md text-lime-100" />
                            </div>
                             <div>
                                <label className="block text-sm font-semibold mb-2 text-lime-300">Tham Chiếu Nhân Vật (Tùy chọn)</label>
                                <div className="w-full aspect-video bg-lime-950/50 rounded-md border-2 border-dashed border-lime-700 flex items-center justify-center relative group">
                                    <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
                                    {characterReferenceImage ? (
                                        <>
                                            <img src={characterReferenceImage.previewUrl} alt="Tham chiếu nhân vật" className="w-full h-full object-contain rounded-md" />
                                            <button onClick={handleRemoveImage} className="absolute top-2 right-2 p-1 bg-black/50 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity">
                                                <XCircleIcon className="w-5 h-5" />
                                            </button>
                                        </>
                                    ) : (
                                        <button onClick={() => fileInputRef.current?.click()} className="text-center p-4 text-lime-400 hover:text-white transition-colors w-full h-full flex flex-col items-center justify-center">
                                            <UploadIcon className="w-8 h-8 mx-auto mb-2"/>
                                            <span className="text-sm font-semibold">Tải ảnh nhân vật để đảm bảo tính nhất quán.</span>
                                        </button>
                                    )}
                                </div>
                            </div>
                            <button onClick={handleGenerateStep1} disabled={isGeneratingStep1 || !isKeySet} className="w-full flex items-center justify-center gap-2 py-2 bg-cyan-600 hover:bg-cyan-700 disabled:bg-cyan-900 rounded-lg font-semibold">{isGeneratingStep1 ? <><Loader2 className="w-5 h-5 animate-spin" /> Đang tạo...</> : "Tạo Bước 1"}</button>
                        </div>
                        <div className="relative">
                            <textarea value={step1Result} readOnly rows={10} className="w-full h-full p-2 bg-lime-950 border border-lime-700 rounded-md text-lime-100 placeholder-lime-700" placeholder="Kết quả Bước 1..."></textarea>
                            <button onClick={() => handleCopy(step1Result, setStep1CopySuccess)} className="absolute top-2 right-2 p-1.5 bg-lime-600 hover:bg-lime-500 rounded-md">{step1CopySuccess ? <CheckCircleIconLucide className="w-4 h-4 text-green-200"/> : <ClipboardIconLucide className="w-4 h-4 text-lime-100" />}</button>
                        </div>
                    </div>
                </div>

                <div className={`bg-lime-900/50 p-6 rounded-xl shadow-lg border border-lime-800 transition-opacity ${!step1Result && 'opacity-50'}`}>
                    <h2 className="text-xl font-bold mb-4 text-cyan-300">Bước 2: Tạo Danh sách Cảnh</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                             <div className="flex gap-4">
                                <div><label className="block text-sm font-semibold mb-2 text-lime-300">Cảnh bắt đầu</label><input type="number" value={step2Start} onChange={(e) => setStep2Start(Number(e.target.value))} className="w-full p-2 bg-lime-800 border border-lime-700 rounded-md text-lime-100" /></div>
                                <div><label className="block text-sm font-semibold mb-2 text-lime-300">Cảnh kết thúc</label><input type="number" value={step2End} onChange={(e) => setStep2End(Number(e.target.value))} className="w-full p-2 bg-lime-800 border border-lime-700 rounded-md text-lime-100" /></div>
                             </div>
                            <button onClick={handleGenerateStep2} disabled={isGeneratingStep2 || !step1Result} className="w-full flex items-center justify-center gap-2 py-2 bg-cyan-600 hover:bg-cyan-700 disabled:bg-cyan-900 rounded-lg font-semibold">{isGeneratingStep2 ? <><Loader2 className="w-5 h-5 animate-spin" /> Đang tạo...</> : "Tạo Bước 2"}</button>
                        </div>
                        <div className="relative">
                            <textarea value={step2Result} readOnly rows={10} className="w-full h-full p-2 bg-lime-950 border border-lime-700 rounded-md text-lime-100 placeholder-lime-700" placeholder="Kết quả Bước 2..."></textarea>
                             <button onClick={() => handleCopy(step2Result, setStep2CopySuccess)} className="absolute top-2 right-2 p-1.5 bg-lime-600 hover:bg-lime-500 rounded-md">{step2CopySuccess ? <CheckCircleIconLucide className="w-4 h-4 text-green-200"/> : <ClipboardIconLucide className="w-4 h-4 text-lime-100" />}</button>
                        </div>
                    </div>
                </div>

                 <div className={`bg-lime-900/50 p-6 rounded-xl shadow-lg border border-lime-800 transition-opacity ${!step2Result && 'opacity-50'}`}>
                    <h2 className="text-xl font-bold mb-4 text-cyan-300">Bước 3: Tạo JSON Prompts</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                             <div className="flex gap-4">
                                <div><label className="block text-sm font-semibold mb-2 text-lime-300">Cảnh bắt đầu</label><input type="number" value={step3Start} onChange={(e) => setStep3Start(Number(e.target.value))} className="w-full p-2 bg-lime-800 border border-lime-700 rounded-md text-lime-100" /></div>
                                <div><label className="block text-sm font-semibold mb-2 text-lime-300">Cảnh kết thúc</label><input type="number" value={step3End} onChange={(e) => setStep3End(Number(e.target.value))} className="w-full p-2 bg-lime-800 border border-lime-700 rounded-md text-lime-100" /></div>
                             </div>
                            <button onClick={handleGenerateStep3} disabled={isGeneratingStep3 || !step2Result} className="w-full flex items-center justify-center gap-2 py-2 bg-cyan-600 hover:bg-cyan-700 disabled:bg-cyan-900 rounded-lg font-semibold">{isGeneratingStep3 ? <><Loader2 className="w-5 h-5 animate-spin" /> Đang tạo...</> : "Tạo Bước 3"}</button>
                        </div>
                         <div className="bg-lime-900/70 rounded-xl shadow-lg border border-lime-800">
                            <div className="p-4 border-b border-lime-700 flex justify-between items-center">
                                <h3 className="text-lg font-semibold text-lime-200">Dữ liệu JSON Prompts</h3>
                                <div className="flex items-center space-x-2">
                                    <button onClick={handleDownloadTxtStep3} disabled={!step3Result} className="flex items-center px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-colors duration-200 text-xs disabled:bg-green-900 disabled:cursor-not-allowed" aria-label="Tải File TXT">
                                        <DownloadIcon className="w-4 h-4 mr-2" /> Tải tệp TXT
                                    </button>
                                    <button onClick={handleDownloadExcelStep3} disabled={!step3Result} className="flex items-center px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-lg transition-colors duration-200 text-xs disabled:bg-teal-900 disabled:cursor-not-allowed" aria-label="Tải File Excel">
                                        <DownloadIcon className="w-4 h-4 mr-2" /> Tải File Excel
                                    </button>
                                    <button onClick={() => handleCopy(step3Result, setStep3CopySuccess)} disabled={!step3Result} className="flex items-center px-3 py-1.5 bg-gray-600 hover:bg-gray-500 text-white font-semibold rounded-lg transition-colors duration-200 text-xs disabled:bg-gray-700" aria-label="Sao chép JSON">
                                        {step3CopySuccess ? <CheckCircleIconLucide className="w-4 h-4 mr-2 text-green-400"/> : <ClipboardIconLucide className="w-4 h-4 mr-2" />}
                                        {step3CopySuccess ? 'Đã chép' : 'Sao chép JSON'}
                                    </button>
                                </div>
                            </div>
                            <div className="p-4 text-xs text-lime-300 overflow-y-auto max-h-96">
                                {step3Result ? (
                                    <pre className="p-3 bg-lime-950 rounded-md overflow-x-auto whitespace-pre-wrap font-mono text-xs">
                                        <code>{step3Result}</code>
                                    </pre>
                                ) : (
                                    <div className="flex items-center justify-center h-full text-lime-500">
                                        <p>Kết quả Bước 3 (JSON) sẽ xuất hiện ở đây...</p>
                                    </div>
                                )}
                            </div>
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

export default PromptToolPage;
