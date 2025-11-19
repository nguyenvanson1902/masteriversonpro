import React, { useState, useRef, ChangeEvent, DragEvent, useEffect, useCallback } from 'react';
import { BackIcon, YoutubeIcon, FacebookIcon, TiktokIcon, ZaloIcon, UploadIcon, XCircleIcon, KeyIcon, CheckCircleIcon as CheckCircleIconSolid, DownloadIcon as Download } from './Icons';
import { Loader2 } from 'lucide-react';
import { APIKeyStatus } from '../types';
import * as geminiService from '../services/geminiService';
import { getApiErrorMessage, isInvalidApiKeyError, isRateLimitError, API_LIMIT_ERROR_MESSAGE } from '../utils';

// Helper to convert File to base64 string without data prefix
const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = error => reject(error);
    });
};
const formatKeyForDisplay = (key: string) => `${key.substring(0, 4)}...${key.substring(key.length - 4)}`;

const ApiKeyModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onSave: (keys: string[]) => void;
    initialKeys: string[];
}> = ({ isOpen, onClose, onSave, initialKeys }) => {
    const [keysInput, setKeysInput] = useState(initialKeys.join('\n'));
    useEffect(() => {
        setKeysInput(initialKeys.join('\n'));
    }, [initialKeys, isOpen]);

    const handleSave = () => {
        const keys = keysInput.split(/[\n,]+/).map(k => k.trim()).filter(Boolean);
        onSave(keys);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
            <div className="bg-slate-800 rounded-xl shadow-2xl w-full max-w-lg border border-slate-700">
                <div className="p-6">
                    <h2 className="text-xl font-bold text-gray-100">Quản lý API Keys</h2>
                    <p className="text-slate-400 mt-2">Dán API key, mỗi key một dòng. Ứng dụng sẽ tự động xoay vòng khi hết hạn mức.</p>
                    <textarea value={keysInput} onChange={(e) => setKeysInput(e.target.value)} placeholder="AIzaSy..." rows={6} className="w-full mt-4 p-2 bg-slate-900 border border-slate-600 rounded-md text-gray-200 font-mono" />
                </div>
                <div className="bg-slate-900/50 px-6 py-3 rounded-b-xl flex justify-end gap-3">
                    <button onClick={onClose} className="px-4 py-2 text-gray-300 font-semibold rounded-lg">Hủy</button>
                    <button onClick={handleSave} className="px-5 py-2 bg-blue-600 text-white font-bold rounded-lg">Lưu</button>
                </div>
            </div>
        </div>
    );
};

const ThumbnailGeneratorPage: React.FC<{ onBack: () => void }> = ({ onBack }) => {
    // API Key State
    const [apiKeys, setApiKeys] = useState<string[]>([]);
    const [isKeySet, setIsKeySet] = useState(false);
    const [apiKeyStatuses, setApiKeyStatuses] = useState<APIKeyStatus>({});
    const apiKeyIndex = useRef(0);
    const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);

    // Feature State
    const [platform, setPlatform] = useState('youtube');
    const [imageCount, setImageCount] = useState(1);
    const [generationMode, setGenerationMode] = useState('creative');
    const [showText, setShowText] = useState(true);
    const [textPrompts, setTextPrompts] = useState('');
    const [creativeSuggestion, setCreativeSuggestion] = useState('');

    const [uploadedImages, setUploadedImages] = useState<File[]>([]);
    const [imagePreviews, setImagePreviews] = useState<string[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // UI State
    const [isGenerating, setIsGenerating] = useState(false);
    const [generatedImages, setGeneratedImages] = useState<string[]>([]);
    const [error, setError] = useState<string | null>(null);

    const statusMap = {
        ready: { text: 'Sẵn sàng', color: 'bg-green-500/80 text-white', icon: <CheckCircleIconSolid className="w-4 h-4 text-green-400" /> },
        exhausted: { text: 'Hết hạn', color: 'bg-red-500/80 text-white', icon: <XCircleIcon className="w-4 h-4 text-red-300" /> },
        invalid: { text: 'Không hợp lệ', color: 'bg-yellow-500/80 text-black', icon: <XCircleIcon className="w-4 h-4 text-yellow-800" /> },
        error: { text: 'Lỗi', color: 'bg-gray-500/80 text-white', icon: <XCircleIcon className="w-4 h-4 text-gray-300" /> },
        checking: { text: 'Đang kiểm tra...', color: 'bg-blue-500/80 text-white', icon: <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> }
    };

    const handleFiles = (files: FileList | null) => {
        if (!files || files.length === 0) return;

        const newFiles = Array.from(files);
        const newImagePreviews: string[] = [];
        let filesProcessed = 0;

        newFiles.forEach(file => {
            const reader = new FileReader();
            reader.onloadend = () => {
                newImagePreviews.push(reader.result as string);
                filesProcessed++;
                if (filesProcessed === newFiles.length) {
                    setUploadedImages(prev => [...prev, ...newFiles]);
                    setImagePreviews(prev => [...prev, ...newImagePreviews]);
                }
            };
            reader.readAsDataURL(file);
        });
    };

    const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
        handleFiles(e.target.files);
    };

    const handleUploadClick = () => {
        fileInputRef.current?.click();
    };

    const handleRemoveImage = (indexToRemove: number) => {
        setUploadedImages(prev => prev.filter((_, index) => index !== indexToRemove));
        setImagePreviews(prev => prev.filter((_, index) => index !== indexToRemove));
    };

    const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
    };

    const handleDrop = (e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        handleFiles(e.dataTransfer.files);
    };

    // --- API Key Management ---
    useEffect(() => {
        const storedKeys = localStorage.getItem("gemini-api-keys");
        if (storedKeys) {
            const parsedKeys = JSON.parse(storedKeys);
            if (Array.isArray(parsedKeys) && parsedKeys.length > 0) {
              setApiKeys(parsedKeys);
              setIsKeySet(true);
              const initialStatuses: APIKeyStatus = {};
              parsedKeys.forEach((key: string) => { initialStatuses[key] = 'ready'; });
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
        
        const checkingStatuses: APIKeyStatus = {};
        keys.forEach(key => { checkingStatuses[key] = 'checking'; });
        setApiKeyStatuses(checkingStatuses);

        const newStatuses: APIKeyStatus = {};
        for (const key of keys) {
            newStatuses[key] = await geminiService.validateApiKey(key);
        }
        setApiKeyStatuses(newStatuses);
    }, []);
    
    const withApiKeyRotation = useCallback(async <T,>(apiCall: (apiKey: string) => Promise<T>): Promise<T> => {
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

    // --- Core Logic ---
    const handleGenerateThumbnails = async () => {
        if (!textPrompts.trim()) {
            setError("Vui lòng nhập nội dung chữ cho thumbnail.");
            return;
        }
        setIsGenerating(true);
        setError(null);
        setGeneratedImages([]);

        try {
            const base64Images = await Promise.all(
                uploadedImages.map(async file => ({
                    data: await fileToBase64(file),
                    mimeType: file.type
                }))
            );

            const images = await withApiKeyRotation(key => geminiService.generateThumbnail(key, {
                platform,
                textPrompt: textPrompts,
                creativeSuggestion,
                imageCount,
                showText,
                base64Images,
            }));
            setGeneratedImages(images);
        } catch(err) {
            console.error("Thumbnail generation failed:", err);
        } finally {
            setIsGenerating(false);
        }
    };
    
    const isGenerationDisabled = isGenerating || !isKeySet || !textPrompts.trim();

    return (
        <div className="min-h-screen bg-slate-900 flex flex-col p-4 sm:p-8 lg:p-12 animate-fadeInUp">
            <ApiKeyModal isOpen={isApiKeyModalOpen} onClose={() => setIsApiKeyModalOpen(false)} onSave={handleSaveApiKeys} initialKeys={apiKeys} />
            <header className="flex flex-col md:flex-row justify-between items-center gap-6 w-full mb-8">
                <div className="flex items-center gap-3 sm:gap-4">
                     <button onClick={onBack} className="flex items-center bg-slate-800/60 backdrop-blur-sm border border-cyan-500 text-cyan-300 font-semibold px-4 py-2 rounded-lg shadow-lg shadow-cyan-500/10 hover:bg-cyan-500/20 hover:text-cyan-200 hover:shadow-cyan-500/30 transition-all duration-300 transform hover:-translate-y-1">
                        <BackIcon className="w-5 h-5 mr-2" />
                        <span>Quay Lại</span>
                    </button>
                </div>
                <div className="text-center">
                    <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-600">
                       RIVER SƠN MASTER
                    </h1>
                </div>
                <div className="flex items-center justify-end flex-wrap gap-3">
                    <a href="https://www.youtube.com/channel/UCwSbzgfgu1iMfOR__AB4QGQ?sub_confirmation=1" target="_blank" rel="noopener noreferrer" aria-label="Youtube" className="flex items-center justify-center w-11 h-11 rounded-lg text-white transition-all duration-300 transform hover:scale-115 bg-red-600 hover:bg-red-700"><YoutubeIcon className="w-7 h-7" /></a>
                    <a href="https://www.facebook.com/huynhxuyenson" target="_blank" rel="noopener noreferrer" aria-label="Facebook" className="flex items-center justify-center w-11 h-11 rounded-lg text-white transition-all duration-300 transform hover:scale-115 bg-blue-600 hover:bg-blue-700"><FacebookIcon className="w-7 h-7" /></a>
                    <a href="https://tiktok.com/@lamyoutubeai" target="_blank" rel="noopener noreferrer" aria-label="Tiktok" className="flex items-center justify-center w-11 h-11 rounded-lg text-white transition-all duration-300 transform hover:scale-115 bg-gray-900 hover:bg-gray-800"><TiktokIcon className="w-7 h-7" /></a>
                    <a href="https://zalo.me/0979007367" target="_blank" rel="noopener noreferrer" aria-label="Zalo" className="flex items-center justify-center w-11 h-11 rounded-lg text-white transition-all duration-300 transform hover:scale-115 bg-blue-500 hover:bg-blue-600"><ZaloIcon className="w-7 h-7" /></a>
                </div>
            </header>
            <main className="flex-grow flex flex-col gap-4 overflow-hidden">
                <div className="flex-shrink-0">
                    <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">
                        Tạo hình thu nhỏ AI chuyên nghiệp
                    </h2>
                    <p className="text-slate-400 mt-1">
                        Tạo hình thu nhỏ cho Youtube, Tiktok, Facebook từ ảnh có sẵn hoặc tạo mới hoàn toàn.
                    </p>
                </div>
                 {error && (
                    <div className="bg-red-900/50 border border-red-700 text-red-300 px-4 py-3 rounded-lg my-2 flex justify-between items-center">
                        <p><strong className="font-semibold">Lỗi:</strong> {error}</p>
                        <button onClick={() => setError(null)}><XCircleIcon className="w-5 h-5"/></button>
                    </div>
                )}
                <div className="flex-grow overflow-hidden">
                    <div className="bg-[#1e293b] text-gray-300 p-3 sm:p-6 rounded-lg border border-slate-700 shadow-2xl h-full flex flex-col gap-6">
                        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 flex-grow overflow-hidden">
                            <div className="lg:col-span-1 flex flex-col gap-6 overflow-y-auto pr-2">
                                <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700 space-y-4">
                                    <h3 className="text-lg font-bold text-white">1. Tùy chỉnh</h3>
                                    
                                     <div className="space-y-2 bg-slate-800/50 p-3 rounded-md border border-slate-600">
                                        <h4 className="text-xs font-bold text-slate-400 uppercase">API Keys</h4>
                                        <div className="space-y-1">
                                            {apiKeys.length > 0 ? apiKeys.slice(0, 3).map(key => {
                                                const status = apiKeyStatuses[key] || 'checking';
                                                const { text, color, icon } = statusMap[status];
                                                return (
                                                    <div key={key} className="flex items-center justify-between p-2 rounded bg-slate-900 text-xs border border-slate-700">
                                                        <div className="flex items-center space-x-2">
                                                            {icon}
                                                            <span className="text-slate-300 font-mono">{formatKeyForDisplay(key)}</span>
                                                        </div>
                                                        <span className={`font-semibold px-1.5 py-0.5 rounded-full ${color}`}>{text}</span>
                                                    </div>
                                                );
                                            }) : <p className="text-xs text-slate-500 text-center">Chưa có API Key.</p>}
                                        </div>
                                        <button onClick={() => setIsApiKeyModalOpen(true)} className="w-full text-xs bg-slate-700 hover:bg-slate-600 text-white flex items-center justify-center gap-2 py-2 rounded transition-colors">
                                            <KeyIcon className="w-3 h-3"/> {isKeySet ? 'Quản lý API Key' : 'Thiết lập API Key'}
                                        </button>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-semibold mb-2">Nền tảng</label>
                                        <div className="flex space-x-2">
                                            {['youtube', 'tiktok', 'facebook'].map(p => (
                                                <button key={p} onClick={() => setPlatform(p)} className={`px-4 py-2 rounded-md font-bold text-sm transition-all duration-200 shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-800 ${platform === p ? 'bg-blue-600 text-white ring-2 ring-blue-400' : 'bg-slate-600 text-white hover:bg-slate-700 focus:ring-slate-500'}`}>{p.charAt(0).toUpperCase() + p.slice(1)}</button>
                                            ))}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold mb-2">Tải ảnh lên (Tùy chọn)</label>
                                        <div 
                                            onDragOver={handleDragOver}
                                            onDrop={handleDrop}
                                            className="w-full bg-slate-800 rounded-md border-2 border-dashed border-slate-600 transition-colors p-2"
                                        >
                                            <input 
                                                ref={fileInputRef} 
                                                hidden 
                                                multiple 
                                                accept="image/*" 
                                                type="file"
                                                onChange={handleFileChange}
                                            />
                                            {imagePreviews.length > 0 ? (
                                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                                    {imagePreviews.map((preview, index) => (
                                                        <div key={index} className="relative group aspect-square">
                                                            <img src={preview} alt={`preview ${index}`} className="w-full h-full object-cover rounded-md"/>
                                                            <button 
                                                                onClick={() => handleRemoveImage(index)}
                                                                className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                                                                aria-label="Remove image"
                                                            >
                                                                <XCircleIcon className="w-5 h-5"/>
                                                            </button>
                                                        </div>
                                                    ))}
                                                    <button onClick={handleUploadClick} className="flex flex-col items-center justify-center bg-slate-900/50 rounded-md aspect-square text-slate-500 hover:text-slate-300 hover:border-blue-500 border-2 border-dashed border-slate-700 transition-colors">
                                                        <UploadIcon className="w-6 h-6"/>
                                                        <span className="text-xs mt-1">Thêm ảnh</span>
                                                    </button>
                                                </div>
                                            ) : (
                                                <div 
                                                    onClick={handleUploadClick}
                                                    className="min-h-[120px] flex flex-col items-center justify-center cursor-pointer hover:bg-slate-700/50 rounded-md"
                                                >
                                                    <div className="flex flex-col items-center text-slate-500 pointer-events-none">
                                                        <UploadIcon className="w-8 h-8"/>
                                                        <p className="mt-2 text-sm text-center">Click hoặc kéo thả hình ảnh</p>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold mb-2">Số lượng ảnh mỗi dấu nhắc</label>
                                        <div className="flex space-x-2">
                                            {[1, 2, 3, 4].map(n => (
                                                <button key={n} onClick={() => setImageCount(n)} className={`px-4 py-2 rounded-md font-bold text-sm transition-all duration-200 shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-800 flex-1 ${imageCount === n ? 'bg-blue-600 text-white ring-2 ring-blue-400' : 'bg-slate-600 text-white hover:bg-slate-700 focus:ring-slate-500'}`}>{n}</button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                                <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700 space-y-4">
                                    <h3 className="text-lg font-bold text-white">2. Nhập nội dung</h3>
                                    <div>
                                        <label className="block text-sm font-semibold mb-2">Chế độ tạo ảnh</label>
                                        <div className="flex space-x-2">
                                            {['accurate', 'creative'].map(m => (
                                                <button key={m} onClick={() => setGenerationMode(m)} className={`px-4 py-2 rounded-md font-bold text-sm transition-all duration-200 shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-800 ${generationMode === m ? 'bg-blue-600 text-white ring-2 ring-blue-400' : 'bg-slate-600 text-white hover:bg-slate-700 focus:ring-slate-500'}`}>{m === 'accurate' ? 'Chính xác' : 'Sáng tạo'}</button>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <label className="text-sm font-semibold">Hiển thị chữ trên Thumbnail</label>
                                        <button onClick={() => setShowText(!showText)} className={`relative inline-flex items-center h-6 rounded-full w-11 transition-colors ${showText ? 'bg-blue-600' : 'bg-slate-600'}`}>
                                            <span className={`inline-block w-4 h-4 transform bg-white rounded-full transition-transform ${showText ? 'translate-x-6' : 'translate-x-1'}`}></span>
                                        </button>
                                    </div>
                                    <div>
                                        <label htmlFor="text-prompts" className="block text-sm font-semibold mb-1">Nội dung chữ</label>
                                        <textarea id="text-prompts" value={textPrompts} onChange={e => setTextPrompts(e.target.value)} className="w-full h-24 bg-slate-800 text-white border border-slate-600 rounded-md p-2 font-mono text-sm" placeholder="Ví dụ: BÍ MẬT GIẢM CÂN ĐỘT PHÁ CÔNG HOA HỒNG 2024 REVIEW SẢN PHẨM MỚI"></textarea>
                                    </div>
                                    <div>
                                        <label htmlFor="creative-suggestion" className="block text-sm font-semibold mb-1">Ý tưởng sáng tạo (Tùy chọn)</label>
                                        <textarea id="creative-suggestion" value={creativeSuggestion} onChange={e => setCreativeSuggestion(e.target.value)} className="w-full h-20 bg-slate-800 text-white border border-slate-600 rounded-md p-2 font-mono text-sm" placeholder="tông màu vàng, bên trái..."></textarea>
                                    </div>
                                    <button onClick={handleGenerateThumbnails} disabled={isGenerationDisabled} className="flex items-center justify-center gap-2 px-4 py-2 rounded-md font-bold transition-all duration-200 shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-800 disabled:opacity-50 disabled:cursor-not-allowed bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500 w-full mt-2 text-lg">
                                        {isGenerating ? <><Loader2 className="w-6 h-6 animate-spin"/> Đang tạo...</> : 'Tạo hình thu nhỏ'}
                                    </button>
                                </div>
                            </div>
                            <div className="lg:col-span-3 flex flex-col">
                                <h3 className="text-lg font-bold text-white mb-2">Kết quả</h3>
                                <div className="bg-slate-900/50 border border-slate-700 rounded-lg p-4 flex-grow overflow-y-auto">
                                     {isGenerating ? (
                                        <div className="flex flex-col items-center justify-center h-full text-slate-400">
                                            <Loader2 className="w-10 h-10 animate-spin mb-4" />
                                            <p>AI đang vẽ... có thể mất một chút thời gian.</p>
                                        </div>
                                    ) : generatedImages.length > 0 ? (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {generatedImages.map((imgData, index) => (
                                                <div key={index} className="relative group rounded-lg overflow-hidden border border-slate-600">
                                                    <img src={`data:image/png;base64,${imgData}`} alt={`Generated thumbnail ${index + 1}`} className="w-full h-full object-contain aspect-video" />
                                                    <a 
                                                        href={`data:image/png;base64,${imgData}`} 
                                                        download={`thumbnail_${platform}_${index + 1}.png`}
                                                        className="absolute bottom-2 right-2 bg-blue-600 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                                        aria-label="Download image"
                                                    >
                                                        <Download className="w-5 h-5" />
                                                    </a>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                         <p className="text-center text-gray-500 pt-8">Hình thu nhỏ sẽ hiện ở đây.</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default ThumbnailGeneratorPage;