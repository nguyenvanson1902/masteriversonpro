
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { BackIcon, SparklesIcon, KeyIcon, XCircleIcon, CheckCircleIcon } from './Icons';
import { Loader2, Clipboard as ClipboardIconLucide, Check as CheckCircleIconLucide } from 'lucide-react';
import { APIKeyStatus } from '../types';
import * as geminiService from '../services/geminiService';
import { getApiErrorMessage, isInvalidApiKeyError, isRateLimitError, API_LIMIT_ERROR_MESSAGE } from '../utils';

const formatKeyForDisplay = (key: string) => `${key.substring(0, 4)}...${key.substring(key.length - 4)}`;

const SeoYoutubePage: React.FC<{ onBack: () => void }> = ({ onBack }) => {
    // API Key State
    const [apiKeys, setApiKeys] = useState<string[]>([]);
    const [isKeySet, setIsKeySet] = useState(false);
    const [apiKeyStatuses, setApiKeyStatuses] = useState<APIKeyStatus>({});
    const apiKeyIndex = useRef(0);
    const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);
    
    // Feature State
    const [videoTitle, setVideoTitle] = useState('');
    const [suggestedTitles, setSuggestedTitles] = useState<string[]>([]);
    const [selectedTitle, setSelectedTitle] = useState<string | null>(null);
    const [seoContent, setSeoContent] = useState<{
        description: string;
        hashtags: string[];
        primaryKeywords: string[];
        secondaryKeywords: string[];
    } | null>(null);

    // UI State
    const [isGeneratingTitles, setIsGeneratingTitles] = useState(false);
    const [isGeneratingContent, setIsGeneratingContent] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [copySuccess, setCopySuccess] = useState<{[key: string]: boolean}>({});

    const statusMap = {
        ready: { text: 'Sẵn sàng', color: 'bg-green-500/80 text-white', icon: <CheckCircleIcon className="w-4 h-4 text-green-400" /> },
        exhausted: { text: 'Hết hạn', color: 'bg-red-500/80 text-white', icon: <XCircleIcon className="w-4 h-4 text-red-300" /> },
        invalid: { text: 'Không hợp lệ', color: 'bg-yellow-500/80 text-black', icon: <XCircleIcon className="w-4 h-4 text-yellow-800" /> },
        error: { text: 'Lỗi', color: 'bg-gray-500/80 text-white', icon: <XCircleIcon className="w-4 h-4 text-gray-300" /> },
        checking: { text: 'Đang kiểm tra...', color: 'bg-blue-500/80 text-white', icon: <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> }
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
    const handleGenerateTitles = async () => {
        setIsGeneratingTitles(true);
        setError(null);
        setSuggestedTitles([]);
        setSelectedTitle(null);
        setSeoContent(null);
        try {
            const titles = await withApiKeyRotation(key => geminiService.generateSeoTitles(key, videoTitle));
            setSuggestedTitles(titles);
        } catch (err) {
            // Error is set by withApiKeyRotation
        } finally {
            setIsGeneratingTitles(false);
        }
    };

    const handleSelectTitle = async (title: string) => {
        setSelectedTitle(title);
        setIsGeneratingContent(true);
        setError(null);
        setSeoContent(null);
        try {
            const content = await withApiKeyRotation(key => geminiService.generateSeoContent(key, title));
            setSeoContent(content);
        } catch (err) {
             // Error is set by withApiKeyRotation
        } finally {
            setIsGeneratingContent(false);
        }
    };
    
    const handleCopy = (text: string, key: string) => {
        navigator.clipboard.writeText(text);
        setCopySuccess(prev => ({ ...prev, [key]: true }));
        setTimeout(() => setCopySuccess(prev => ({ ...prev, [key]: false })), 2000);
    };

    const ApiKeyModal: React.FC<{ isOpen: boolean; onClose: () => void; onSave: (keys: string[]) => void; initialKeys: string[]; }> = ({ isOpen, onClose, onSave, initialKeys }) => {
        const [keysInput, setKeysInput] = useState(initialKeys.join('\n'));
        useEffect(() => { setKeysInput(initialKeys.join('\n')); }, [initialKeys, isOpen]);
        if (!isOpen) return null;
        return (
            <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
                <div className="bg-lime-800 rounded-xl shadow-2xl w-full max-w-lg border border-lime-700">
                    <div className="p-6">
                        <h2 className="text-xl font-bold text-lime-100">Quản lý API Keys</h2>
                        <textarea value={keysInput} onChange={(e) => setKeysInput(e.target.value)} placeholder="Dán API key, mỗi key một dòng..." rows={6} className="w-full mt-4 p-2 bg-lime-900 border border-lime-600 rounded-md text-lime-100 font-mono placeholder-lime-600" />
                    </div>
                    <div className="bg-lime-900/50 px-6 py-3 rounded-b-xl flex justify-end gap-3">
                        <button onClick={onClose} className="px-4 py-2 text-lime-300 font-semibold rounded-lg hover:text-white">Hủy</button>
                        <button onClick={() => onSave(keysInput.split(/[\n,]+/).map(k => k.trim()).filter(Boolean))} className="px-5 py-2 bg-blue-600 text-white font-bold rounded-lg shadow-lg">Lưu</button>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-lime-950 text-lime-100 flex flex-col p-4 sm:p-8 animate-fadeInUp">
            <ApiKeyModal isOpen={isApiKeyModalOpen} onClose={() => setIsApiKeyModalOpen(false)} onSave={handleSaveApiKeys} initialKeys={apiKeys} />
             <header className="flex items-center mb-8">
                 <button onClick={onBack} className="flex items-center bg-lime-800/60 backdrop-blur-sm border border-cyan-500 text-cyan-300 font-semibold px-4 py-2 rounded-lg shadow-lg shadow-cyan-500/10 hover:bg-cyan-500/20 hover:text-cyan-200 hover:shadow-cyan-500/30 transition-all duration-300 transform hover:-translate-y-1">
                    <BackIcon className="w-5 h-5 mr-2" />
                    <span>Quay Lại</span>
                </button>
            </header>
            <main className="flex-grow flex flex-col gap-4 overflow-hidden">
                <div className="flex-shrink-0">
                    <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">
                        AI SEO YouTube
                    </h2>
                    <p className="text-lime-400 mt-1">
                        Tạo tiêu đề, mô tả, hashtag và từ khóa chuẩn SEO, giúp kênh phát triển YouTube.
                    </p>
                </div>
                {error && (
                    <div className="bg-red-900/50 border border-red-700 text-red-300 px-4 py-3 rounded-lg my-4 flex justify-between items-center">
                        <p><strong className="font-semibold">Lỗi:</strong> {error}</p>
                        <button onClick={() => setError(null)}><XCircleIcon className="w-5 h-5"/></button>
                    </div>
                )}
                <div className="flex-grow overflow-hidden">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-full">
                        <div className="lg:col-span-1 flex flex-col gap-8 overflow-y-auto pr-2">
                            <div className="bg-lime-900 p-6 rounded-xl border border-lime-800 shadow-lg">
                                <h2 className="text-xl font-bold mb-4 text-cyan-400">
                                    Bước 1: Nhập chủ đề video
                                </h2>
                                <textarea 
                                    className="w-full h-32 bg-lime-950 border border-lime-700 rounded-lg p-3 text-base text-lime-100 focus:ring-2 focus:ring-blue-500 transition-colors placeholder-lime-600" 
                                    placeholder="Ví dụ: Hướng dẫn làm món phở bò Hà Nội chuẩn vị tại nhà..."
                                    value={videoTitle}
                                    onChange={(e) => setVideoTitle(e.target.value)}
                                ></textarea>
                                
                                 {/* API Key Section */}
                                 <div className="space-y-2 bg-lime-950/50 p-3 rounded-md border border-lime-700 mt-4">
                                    <h4 className="text-xs font-bold text-lime-400 uppercase">API Keys</h4>
                                    <div className="space-y-1">
                                        {apiKeys.length > 0 ? apiKeys.slice(0, 3).map(key => {
                                            const status = apiKeyStatuses[key] || 'checking';
                                            const { text, color, icon } = statusMap[status];
                                            return (
                                                <div key={key} className="flex items-center justify-between p-2 rounded bg-lime-800 text-xs border border-lime-700">
                                                    <div className="flex items-center space-x-2">
                                                        {icon}
                                                        <span className="text-lime-300 font-mono">{formatKeyForDisplay(key)}</span>
                                                    </div>
                                                    <span className={`font-semibold px-1.5 py-0.5 rounded-full ${color}`}>{text}</span>
                                                </div>
                                            );
                                        }) : <p className="text-xs text-lime-500 text-center">Chưa có API Key.</p>}
                                    </div>
                                    <button onClick={() => setIsApiKeyModalOpen(true)} className="w-full text-xs bg-lime-700 hover:bg-lime-600 text-white flex items-center justify-center gap-2 py-2 rounded transition-colors">
                                        <KeyIcon className="w-3 h-3"/> {isKeySet ? 'Quản lý API Key' : 'Thiết lập API Key'}
                                    </button>
                                </div>

                                <button 
                                    onClick={handleGenerateTitles}
                                    disabled={isGeneratingTitles || !videoTitle.trim() || !isKeySet} 
                                    className="mt-4 w-full px-6 py-3 bg-blue-600 text-white font-bold rounded-lg shadow-md hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition-all flex items-center justify-center space-x-2"
                                >
                                    {isGeneratingTitles ? <Loader2 className="w-5 h-5 animate-spin"/> : <SparklesIcon className="w-5 h-5"/> }
                                    <span>{isGeneratingTitles ? 'Đang tạo...' : 'Tạo Gợi Ý Tiêu Đề'}</span>
                                </button>
                            </div>
                            
                            {suggestedTitles.length > 0 && (
                                <div className="bg-lime-900 p-6 rounded-xl border border-lime-800 animate-fadeInUp shadow-lg">
                                    <h2 className="text-xl font-bold mb-4 text-cyan-400">Bước 2: Chọn tiêu đề bạn thích</h2>
                                    <div className="space-y-3">
                                        {suggestedTitles.map((title, index) => (
                                            <div key={index} className={`flex items-center justify-between p-3 rounded-lg transition-all duration-200 border-2 ${selectedTitle === title ? 'bg-blue-900/50 border-blue-500' : 'bg-lime-800 border-lime-700'}`}>
                                                <span className="flex-grow mr-4 text-sm text-lime-100">{title}</span>
                                                <button onClick={() => handleSelectTitle(title)} className={`flex-shrink-0 px-4 py-1 text-sm font-bold rounded-md transition-colors ${selectedTitle === title ? 'bg-blue-600 text-white cursor-default' : 'bg-lime-700 hover:bg-blue-500 text-white'}`}>
                                                    {isGeneratingContent && selectedTitle === title ? <Loader2 className="w-4 h-4 animate-spin"/> : "CHỌN"}
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                        </div>
                        <div className="lg:col-span-2 h-full flex flex-col">
                            <div className="bg-lime-900 p-6 rounded-xl border border-lime-800 flex-grow flex flex-col shadow-lg">
                                <h2 className="text-xl font-bold mb-4 text-cyan-400 flex-shrink-0">
                                    Bước 3: Sao chép và sử dụng nội dung
                                </h2>
                                <div className="flex-grow overflow-y-auto pr-2">
                                    {isGeneratingContent && (
                                        <div className="flex justify-center items-center h-full text-center text-lime-400">
                                            <Loader2 className="w-8 h-8 animate-spin mr-3"/> Đang tạo nội dung SEO...
                                        </div>
                                    )}
                                    {seoContent ? (
                                        <div className="space-y-6 animate-fadeInUp">
                                            <div className="relative bg-lime-950 p-4 rounded-lg border border-lime-700">
                                                <h3 className="font-semibold text-lg mb-2 text-green-400">Mô tả (Description)</h3>
                                                <p className="text-lime-100 whitespace-pre-wrap">{seoContent.description}</p>
                                                <button onClick={() => handleCopy(seoContent.description, 'desc')} className="absolute top-2 right-2 px-3 py-1 text-xs rounded-md transition-colors duration-200 bg-lime-700 hover:bg-lime-600 text-lime-200 flex items-center gap-1.5">{copySuccess['desc'] ? <CheckCircleIconLucide className="w-3 h-3 text-green-400" /> : <ClipboardIconLucide className="w-3 h-3" />} {copySuccess['desc'] ? 'Đã chép' : 'Sao chép'}</button>
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                                <div className="relative bg-lime-950 p-4 rounded-lg border border-lime-700 md:col-span-1">
                                                    <h3 className="font-semibold text-lg mb-2 text-purple-400">Hashtags</h3>
                                                    <div className="flex flex-wrap gap-2">
                                                        {seoContent.hashtags.map((tag, i) => <span key={i} className="bg-lime-800 text-lime-200 px-2 py-1 rounded text-sm">#{tag}</span>)}
                                                    </div>
                                                    <button onClick={() => handleCopy(seoContent.hashtags.map(t => `#${t}`).join(' '), 'tags')} className="absolute top-2 right-2 px-3 py-1 text-xs rounded-md transition-colors duration-200 bg-lime-700 hover:bg-lime-600 text-lime-200 flex items-center gap-1.5">{copySuccess['tags'] ? <CheckCircleIconLucide className="w-3 h-3 text-green-400" /> : <ClipboardIconLucide className="w-3 h-3" />} {copySuccess['tags'] ? 'Đã chép' : 'Sao chép'}</button>
                                                </div>
                                                <div className="relative bg-lime-950 p-4 rounded-lg border border-lime-700 md:col-span-2">
                                                    <h3 className="font-semibold text-lg mb-2 text-yellow-400">Từ khóa chính</h3>
                                                    <div className="flex flex-wrap gap-2">
                                                         {seoContent.primaryKeywords.map((kw, i) => <span key={i} className="bg-lime-800 text-lime-200 px-2 py-1 rounded text-sm">{kw}</span>)}
                                                    </div>
                                                     <button onClick={() => handleCopy(seoContent.primaryKeywords.join(', '), 'primary')} className="absolute top-2 right-2 px-3 py-1 text-xs rounded-md transition-colors duration-200 bg-lime-700 hover:bg-lime-600 text-lime-200 flex items-center gap-1.5">{copySuccess['primary'] ? <CheckCircleIconLucide className="w-3 h-3 text-green-400" /> : <ClipboardIconLucide className="w-3 h-3" />} {copySuccess['primary'] ? 'Đã chép' : 'Sao chép'}</button>
                                                </div>
                                            </div>
                                            <div className="relative bg-lime-950 p-4 rounded-lg border border-lime-700">
                                                <h3 className="font-semibold text-lg mb-2 text-orange-400">Từ khóa phụ</h3>
                                                <div className="flex flex-wrap gap-2">
                                                    {seoContent.secondaryKeywords.map((kw, i) => <span key={i} className="bg-lime-800 text-lime-200 px-2 py-1 rounded text-sm">{kw}</span>)}
                                                </div>
                                                <button onClick={() => handleCopy(seoContent.secondaryKeywords.join(', '), 'secondary')} className="absolute top-2 right-2 px-3 py-1 text-xs rounded-md transition-colors duration-200 bg-lime-700 hover:bg-lime-600 text-lime-200 flex items-center gap-1.5">{copySuccess['secondary'] ? <CheckCircleIconLucide className="w-3 h-3 text-green-400" /> : <ClipboardIconLucide className="w-3 h-3" />} {copySuccess['secondary'] ? 'Đã chép' : 'Sao chép'}</button>
                                            </div>
                                        </div>
                                    ) : (
                                        !isGeneratingContent &&
                                        <div className="flex justify-center items-center h-full text-center text-lime-500">
                                            Kết quả sẽ xuất hiện ở đây.
                                        </div>
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

export default SeoYoutubePage;
