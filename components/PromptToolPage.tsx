import React, { useState, useEffect, useCallback, useRef } from 'react';
import { BackIcon, SparklesIcon, KeyIcon, XCircleIcon, CheckCircleIcon } from './Icons';
import { STYLES, PROMPT_TOOL_ASPECT_RATIOS, NEGATIVE_PROMPT } from '../constants';
import { RefreshCw, ClipboardIcon as ClipboardIconLucide, CheckCircle as CheckCircleIconLucide, Loader2 } from 'lucide-react';
import * as geminiService from '../services/geminiService';
import { APIKeyStatus } from '../types';
import { getApiErrorMessage, isInvalidApiKeyError, isRateLimitError, API_LIMIT_ERROR_MESSAGE } from '../utils';

const formatKeyForDisplay = (key: string) => `${key.substring(0, 4)}...${key.substring(key.length - 4)}`;

const PromptToolPage: React.FC<{ onBack: () => void }> = ({ onBack }) => {
    const [apiKeys, setApiKeys] = useState<string[]>([]);
    const [isKeySet, setIsKeySet] = useState(false);
    const [apiKeyStatuses, setApiKeyStatuses] = useState<APIKeyStatus>({});
    const apiKeyIndex = useRef(0);
    const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);
    const [isGeneratingIdea, setIsGeneratingIdea] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [settings, setSettings] = useState({
        context: '',
        character: '',
        action: '',
        details: '',
        selectedStyles: [] as string[],
        aspectRatio: '16:9',
    });
    const [generatedPrompt, setGeneratedPrompt] = useState('');
    const [copySuccess, setCopySuccess] = useState(false);
    
    const statusMap = {
        ready: { text: 'Sẵn sàng', color: 'bg-green-500/80 text-white', icon: <CheckCircleIcon className="w-4 h-4 text-green-400" /> },
        exhausted: { text: 'Hết hạn', color: 'bg-red-500/80 text-white', icon: <XCircleIcon className="w-4 h-4 text-red-300" /> },
        invalid: { text: 'Không hợp lệ', color: 'bg-yellow-500/80 text-black', icon: <XCircleIcon className="w-4 h-4 text-yellow-800" /> },
        error: { text: 'Lỗi', color: 'bg-gray-500/80 text-white', icon: <XCircleIcon className="w-4 h-4 text-gray-300" /> },
        checking: { text: 'Đang kiểm tra...', color: 'bg-blue-500/80 text-white', icon: <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> }
    };

     useEffect(() => {
        const storedKeys = localStorage.getItem("gemini-api-keys");
        if (storedKeys) {
            const parsedKeys = JSON.parse(storedKeys);
            if (Array.isArray(parsedKeys) && parsedKeys.length > 0) {
              setApiKeys(parsedKeys);
              setIsKeySet(true);
              const initialStatuses: APIKeyStatus = {};
              parsedKeys.forEach((key: string) => {
                initialStatuses[key] = 'ready';
              });
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
        keys.forEach(key => {
            checkingStatuses[key] = 'checking';
        });
        setApiKeyStatuses(checkingStatuses);

        const newStatuses: APIKeyStatus = {};
        for (const key of keys) {
            newStatuses[key] = await geminiService.validateApiKey(key);
        }
        setApiKeyStatuses(newStatuses);
    }, []);

    const withApiKeyRotation = async <T,>(apiCall: (apiKey: string) => Promise<T>): Promise<T> => {
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
                if (apiKeyStatuses[currentApiKey] !== 'ready') {
                    setApiKeyStatuses(prev => ({ ...prev, [currentApiKey]: 'ready' }));
                }
                return result;
            } catch (err) {
                if (isRateLimitError(err)) {
                    console.warn(`API key ${formatKeyForDisplay(currentApiKey)} is exhausted or rate-limited.`);
                    setApiKeyStatuses(prev => ({ ...prev, [currentApiKey]: 'exhausted' }));
                    attempts++;
                } else if (isInvalidApiKeyError(err)) {
                     console.warn(`API key ${formatKeyForDisplay(currentApiKey)} is invalid.`);
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
    };

    const toggleStyle = (styleName: string) => {
        setSettings(prev => {
            const newStyles = prev.selectedStyles.includes(styleName)
                ? prev.selectedStyles.filter(s => s !== styleName)
                : [...prev.selectedStyles, styleName];
            return { ...prev, selectedStyles: newStyles };
        });
    };

    const handleGenerate = () => {
        if (!settings.action.trim()) {
            alert("Vui lòng nhập 'Hành động chính'.");
            return;
        }

        const parts = [];
        if (settings.context.trim()) parts.push(settings.context.trim());
        if (settings.character.trim()) parts.push(settings.character.trim());
        parts.push(settings.action.trim());
        if (settings.details.trim()) parts.push(settings.details.trim());
        
        let prompt = parts.join(', ');

        if (settings.selectedStyles.length > 0) {
            prompt += `, in the style of ${settings.selectedStyles.join(' and ')}`;
        }

        prompt += `, aspect ratio ${settings.aspectRatio}`;
        prompt += `. Avoid the following: ${NEGATIVE_PROMPT}.`;

        setGeneratedPrompt(prompt);
    };
    
    const handleGenerateIdea = async () => {
        setIsGeneratingIdea(true);
        setError(null);
        try {
            const idea = await withApiKeyRotation((key) => geminiService.generatePromptIdea(key));
            setSettings(prev => ({
                ...prev,
                context: idea.context,
                character: idea.character,
                action: idea.action,
                details: idea.details,
            }));
        } catch (err) {
            // Error is handled and set by withApiKeyRotation
        } finally {
            setIsGeneratingIdea(false);
        }
    };


    const handleReset = () => {
        setSettings({
            context: '',
            character: '',
            action: '',
            details: '',
            selectedStyles: [],
            aspectRatio: '16:9',
        });
        setGeneratedPrompt('');
    };

    const handleCopy = () => {
        if (!generatedPrompt) return;
        navigator.clipboard.writeText(generatedPrompt).then(() => {
            setCopySuccess(true);
            setTimeout(() => setCopySuccess(false), 2000);
        });
    };

    const FormInput: React.FC<{id: string, label: string, placeholder: string, value: string, onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void, required?: boolean, optional?: boolean}> = ({ id, label, placeholder, value, onChange, required=false, optional=true }) => (
        <div>
            <label htmlFor={id} className="block text-lg font-semibold mb-2 text-gray-200">
                {label} {required && <span className="text-red-400">*</span>} {optional && <span className="text-gray-400 text-sm">(tùy chọn)</span>}
            </label>
            <textarea
                id={id}
                value={value}
                onChange={onChange}
                placeholder={placeholder}
                className="w-full p-3 bg-blue-800 border border-blue-700 rounded-md focus:ring-2 focus:ring-lime-500 transition-shadow duration-200"
                rows={id === 'action' ? 3 : 2}
                required={required}
            />
        </div>
    );
    
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
                <div className="bg-blue-900 rounded-xl shadow-2xl w-full max-w-2xl border border-blue-800">
                    <div className="p-6">
                        <h2 className="text-xl font-bold text-gray-100">Quản lý API Keys</h2>
                        <p className="text-gray-400 mt-2 mb-4">Dán API key của bạn vào đây, mỗi key một dòng. Ứng dụng sẽ tự động xoay vòng key khi hết hạn mức.</p>
                        <textarea
                            value={keysInput}
                            onChange={(e) => setKeysInput(e.target.value)}
                            placeholder="AIzaSy..."
                            rows={8}
                            className="w-full p-3 bg-blue-950 border border-blue-700 rounded-md focus:ring-2 focus:ring-lime-500 text-gray-200 font-mono"
                        />
                    </div>
                    <div className="bg-blue-950/50 px-6 py-4 rounded-b-xl flex justify-end gap-4">
                        <button onClick={onClose} className="px-4 py-2 text-gray-300 hover:text-white font-semibold rounded-lg">Hủy</button>
                        <button onClick={handleSave} className="px-6 py-2 bg-lime-600 hover:bg-lime-700 text-white font-bold rounded-lg">Lưu Keys</button>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-blue-950 text-gray-100 p-4 sm:p-6 lg:p-8 animate-fadeInUp">
            <ApiKeyModal isOpen={isApiKeyModalOpen} onClose={() => setIsApiKeyModalOpen(false)} onSave={handleSaveApiKeys} initialKeys={apiKeys} />
            <div className="container mx-auto">
                <header className="text-center mb-10 relative">
                     <button onClick={onBack} className="absolute left-0 top-1/2 -translate-y-1/2 p-2 bg-blue-900 hover:bg-blue-800 rounded-full transition-colors" aria-label="Quay lại">
                        <BackIcon className="w-6 h-6 text-gray-300" />
                    </button>
                    <h1 className="text-5xl mb-2 font-black text-aurora-glow-7-colors">RIVER SƠN MASTER</h1>
                     <h1 className="text-xl sm:text-2xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-lime-300 via-green-300 to-emerald-400 py-2">
                        PROMPT GENERATOR
                    </h1>
                </header>
                <main className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div className="bg-blue-900/50 p-6 rounded-xl shadow-lg border border-blue-800 space-y-6">
                         <div className="flex justify-between items-center border-b border-blue-800 pb-3">
                            <h2 className="text-2xl font-bold text-gray-200">Cài đặt Prompt</h2>
                            <button
                                onClick={handleGenerateIdea}
                                disabled={isGeneratingIdea || !isKeySet}
                                className="flex items-center gap-2 px-3 py-1.5 bg-yellow-600 hover:bg-yellow-700 disabled:bg-yellow-900 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors text-sm"
                                title="Gợi ý một ý tưởng video thiếu nhi theo xu hướng"
                            >
                                {isGeneratingIdea ? <Loader2 className="w-4 h-4 animate-spin" /> : <SparklesIcon className="w-4 h-4" />}
                                <span>Gợi ý ý tưởng</span>
                            </button>
                        </div>
                        <div className="bg-blue-950/50 p-4 rounded-lg border border-blue-800">
                           <h3 className="text-lg font-semibold text-gray-200 mb-3 flex items-center"><KeyIcon className="w-5 h-5 mr-2 text-yellow-400" />Quản lý API Key</h3>
                            <div className="space-y-2 mb-3">
                                {apiKeys.length > 0 ? apiKeys.slice(0, 3).map(key => {
                                    const status = apiKeyStatuses[key] || 'checking';
                                    const { text, color, icon } = statusMap[status];
                                    return (
                                        <div key={key} className="flex items-center justify-between p-2 rounded-md bg-blue-900 text-sm">
                                            <div className="flex items-center space-x-2">
                                                {icon}
                                                <span className="text-gray-300 font-mono">{formatKeyForDisplay(key)}</span>
                                            </div>
                                            <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${color}`}>{text}</span>
                                        </div>
                                    );
                                }) : <p className="text-sm text-gray-400 text-center py-1">Chưa có API Key nào.</p>}
                            </div>
                            <button onClick={() => setIsApiKeyModalOpen(true)} className="w-full mt-2 px-3 py-1.5 bg-lime-600 hover:bg-lime-700 text-white font-bold rounded-lg transition-colors text-sm">
                                {isKeySet ? `Quản lý ${apiKeys.length} Keys` : 'Nhập API Keys'}
                            </button>
                       </div>
                        <FormInput id="context" label="Bối cảnh" placeholder="ví dụ: một khu rừng vào ban đêm, trăng tròn..." value={settings.context} onChange={e => setSettings({...settings, context: e.target.value})} />
                        <FormInput id="character" label="Nhân vật" placeholder="ví dụ: một chiến binh mặc giáp, cầm kiếm phát sáng..." value={settings.character} onChange={e => setSettings({...settings, character: e.target.value})} />
                        <FormInput id="action" label="Hành động chính" placeholder="ví dụ: đang chiến đấu với một con rồng lửa khổng lồ..." value={settings.action} onChange={e => setSettings({...settings, action: e.target.value})} required={true} optional={false} />
                        <FormInput id="details" label="Chi tiết bổ sung" placeholder="ví dụ: tia lửa bay khắp nơi, hiệu ứng slow motion..." value={settings.details} onChange={e => setSettings({...settings, details: e.target.value})} />
                        <div>
                            <h3 className="text-lg font-semibold text-gray-200 mb-3">Phong cách (chọn một hoặc nhiều)</h3>
                            <div className="flex flex-wrap gap-2">
                                {STYLES.map(style => (
                                    <button
                                        key={style}
                                        onClick={() => toggleStyle(style)}
                                        className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all duration-200 ${settings.selectedStyles.includes(style) ? 'bg-lime-600 text-white' : 'bg-blue-800 text-gray-300 hover:bg-blue-700'}`}
                                    >
                                        {style}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-gray-200 mb-3">Tỷ lệ khung hình</h3>
                            <div className="flex gap-3">
                                {PROMPT_TOOL_ASPECT_RATIOS.map(ratio => (
                                    <button
                                        key={ratio}
                                        onClick={() => setSettings({...settings, aspectRatio: ratio})}
                                        className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 flex-grow ${settings.aspectRatio === ratio ? 'bg-lime-600 text-white' : 'bg-blue-800 text-gray-300 hover:bg-blue-700'}`}
                                    >
                                        {ratio}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <button onClick={handleGenerate} disabled={!settings.action.trim()} className="w-full flex items-center justify-center gap-3 px-8 py-4 bg-lime-600 hover:bg-lime-700 disabled:bg-lime-900 disabled:text-gray-400 disabled:cursor-not-allowed text-white font-bold rounded-lg shadow-lg transform hover:scale-105 transition-all duration-300">
                             <SparklesIcon className="w-6 h-6" /> Tạo Prompt
                        </button>
                    </div>
                    <div className="bg-blue-900/50 p-6 rounded-xl shadow-lg border border-blue-800 flex flex-col">
                        <h2 className="text-2xl font-bold text-gray-200 border-b border-blue-800 pb-3 mb-6">Prompt đã tạo</h2>
                        <div className="bg-blue-950/70 p-4 rounded-md flex-grow flex items-center justify-center">
                            {generatedPrompt ? (
                                <p className="text-gray-200 whitespace-pre-wrap select-all text-lg">{generatedPrompt}</p>
                            ) : (
                                <p className="text-gray-500 italic">Prompt của bạn sẽ xuất hiện ở đây...</p>
                            )}
                        </div>
                        {error && (
                            <div className="mt-4 bg-red-900/50 text-red-300 p-3 rounded-md text-sm border border-red-700">
                                <strong>Lỗi:</strong> {error}
                            </div>
                        )}
                        <div className="mt-6 flex gap-4">
                            <button onClick={handleCopy} disabled={!generatedPrompt} className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-green-600 hover:bg-green-700 disabled:bg-green-900 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-colors">
                                {copySuccess ? <CheckCircleIconLucide className="w-5 h-5" /> : <ClipboardIconLucide className="w-5 h-5" />}
                                {copySuccess ? 'Đã sao chép!' : 'Sao chép'}
                            </button>
                             <button onClick={handleReset} className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg transition-colors">
                                <RefreshCw className="w-5 h-5" /> Đặt lại
                            </button>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
};

export default PromptToolPage;