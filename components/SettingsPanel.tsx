import React, { useState, useEffect, useRef } from 'react';
import type { Settings } from '../types';
import { INITIAL_STYLES, DIRECTOR_ASPECT_RATIOS } from '../constants';
import { Bot, Loader2, Mic, Sparkles } from 'lucide-react';
import { generateTrendingIdea } from '../services/geminiService';

// TypeScript definitions for the Web Speech API
interface SpeechRecognitionAlternative {
    readonly transcript: string;
    readonly confidence: number;
}
interface SpeechRecognitionResult {
    readonly isFinal: boolean;
    readonly length: number;
    item(index: number): SpeechRecognitionAlternative;
    [index: number]: SpeechRecognitionAlternative;
}
interface SpeechRecognitionResultList {
    readonly length: number;
    item(index: number): SpeechRecognitionResult;
    [index: number]: SpeechRecognitionResult;
}
interface SpeechRecognitionEvent extends Event {
    readonly resultIndex: number;
    readonly results: SpeechRecognitionResultList;
}
interface SpeechRecognitionErrorEvent extends Event {
    readonly error: string;
    readonly message: string;
}
interface SpeechRecognition extends EventTarget {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    start(): void;
    stop(): void;
    addEventListener(type: 'result', listener: (event: SpeechRecognitionEvent) => void): void;
    addEventListener(type: 'error', listener: (event: SpeechRecognitionErrorEvent) => void): void;
    addEventListener(type: 'end', listener: () => void): void;
    addEventListener(type: string, listener: EventListenerOrEventListenerObject): void;
    removeEventListener(type: 'result', listener: (event: SpeechRecognitionEvent) => void): void;
    removeEventListener(type: 'error', listener: (event: SpeechRecognitionErrorEvent) => void): void;
    removeEventListener(type: 'end', listener: () => void): void;
    removeEventListener(type: string, listener: EventListenerOrEventListenerObject): void;
}
interface SpeechRecognitionStatic {
    new(): SpeechRecognition;
}

interface SettingsPanelProps {
    settings: Settings;
    setSettings: React.Dispatch<React.SetStateAction<Settings>>;
    onGenerate: () => void;
    isLoading: boolean;
    // FIX: Add withApiKeyRotation prop to handle authenticated API calls consistently.
    withApiKeyRotation: (apiCall: (apiKey: string) => Promise<any>) => Promise<any>;
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({ settings, setSettings, onGenerate, isLoading, withApiKeyRotation }) => {
    const [listeningField, setListeningField] = useState<'idea' | 'context' | 'characters' | null>(null);
    const [isGeneratingIdea, setIsGeneratingIdea] = useState(false);
    const recognitionRef = useRef<SpeechRecognition | null>(null);
    const isApiSupported = useRef(false);

    useEffect(() => {
        const SpeechRecognitionAPI: SpeechRecognitionStatic | undefined = 
            (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (SpeechRecognitionAPI) {
            isApiSupported.current = true;
            const instance = new SpeechRecognitionAPI();
            instance.continuous = false;
            instance.interimResults = false;
            instance.lang = 'vi-VN';
            recognitionRef.current = instance;
        } else {
            console.warn('Nhận dạng giọng nói không được hỗ trợ trên trình duyệt này.');
        }
    }, []);

    useEffect(() => {
        const recognition = recognitionRef.current;
        if (!listeningField || !recognition) {
            return;
        }

        const handleResult = (event: SpeechRecognitionEvent) => {
            const transcript = event.results[event.results.length - 1][0].transcript.trim();
            if (transcript) {
                setSettings(prev => {
                    const existingText = prev[listeningField as keyof Settings] as string;
                    return {
                        ...prev,
                        [listeningField]: existingText ? `${existingText} ${transcript}` : transcript,
                    };
                });
            }
        };

        const handleError = (event: SpeechRecognitionErrorEvent) => {
            console.error('Lỗi nhận dạng giọng nói:', event.error);
            setListeningField(null);
        };

        const handleEnd = () => {
            setListeningField(null);
        };

        recognition.addEventListener('result', handleResult);
        recognition.addEventListener('error', handleError);
        recognition.addEventListener('end', handleEnd);
        
        recognition.start();

        return () => {
            recognition.removeEventListener('result', handleResult);
            recognition.removeEventListener('error', handleError);
            recognition.removeEventListener('end', handleEnd);
            recognition.stop();
        };
    }, [listeningField, setSettings]);

    const handleMicClick = (fieldName: 'idea' | 'context' | 'characters') => {
        if (!isApiSupported.current) {
            alert('Nhận dạng giọng nói không được hỗ trợ trên trình duyệt này.');
            return;
        }
        setListeningField(currentField => (currentField === fieldName ? null : fieldName));
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setSettings(prev => ({
            ...prev,
            [name]: name === 'numScenes' ? parseInt(value, 10) : value
        }));
    };

    const handleGenerateIdea = async () => {
        setIsGeneratingIdea(true);
        try {
            // FIX: Use the withApiKeyRotation function to make an authenticated call.
            const suggestion = await withApiKeyRotation(apiKey => generateTrendingIdea(apiKey));
            setSettings(prev => ({ 
                ...prev, 
                idea: suggestion.idea,
                context: suggestion.context,
                characters: suggestion.characters,
            }));
        } catch (error) {
            console.error("Failed to generate idea:", error);
            alert("Không thể tạo ý tưởng. Vui lòng thử lại.");
        } finally {
            setIsGeneratingIdea(false);
        }
    };


    return (
        <div className="bg-green-800/50 p-6 rounded-lg shadow-lg sticky top-24 border border-green-700">
            <h2 className="text-xl font-bold mb-4 text-yellow-400 border-b border-green-700 pb-2">1. Cài Đặt</h2>
            <div className="space-y-4">
                <div>
                    <div className="flex justify-between items-center mb-1">
                        <label htmlFor="idea" className="block text-sm font-medium text-green-300">Ý Tưởng Video</label>
                         <button
                            type="button"
                            onClick={handleGenerateIdea}
                            disabled={isLoading || isGeneratingIdea}
                            className="flex items-center text-xs px-2 py-1 bg-yellow-600/50 text-yellow-200 rounded-md hover:bg-yellow-600/80 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Tạo ý tưởng ngẫu nhiên theo xu hướng"
                        >
                            {isGeneratingIdea ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <>
                                    <Sparkles className="h-4 w-4 mr-1" />
                                    Gợi ý
                                </>
                            )}
                        </button>
                    </div>
                    <div className="relative">
                        <textarea
                            id="idea"
                            name="idea"
                            value={settings.idea}
                            onChange={handleChange}
                            rows={4}
                            className="w-full bg-green-950 border border-green-600 rounded-md p-2 focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 transition pr-12 text-slate-200 placeholder-green-600"
                            placeholder={listeningField === 'idea' ? 'Đang nghe...' : "ví dụ: Một cô bé khám phá ra khu vườn ma thuật ở sân sau nhà."}
                        />
                         {isApiSupported.current && (
                            <button
                                type="button"
                                onClick={() => handleMicClick('idea')}
                                className={`absolute top-2.5 right-2.5 p-2 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-green-800 focus:ring-yellow-500 ${listeningField === 'idea' ? 'bg-red-500 text-white animate-pulse' : 'bg-green-700 text-green-300 hover:bg-green-600'}`}
                                aria-label={listeningField === 'idea' ? "Dừng đọc cho ý tưởng video" : "Bắt đầu đọc cho ý tưởng video"}
                            >
                                <Mic className="h-4 w-4" />
                            </button>
                        )}
                    </div>
                </div>
                <div>
                    <label htmlFor="context" className="block text-sm font-medium text-green-300 mb-1">Bối Cảnh / Không Gian (Tùy chọn)</label>
                    <div className="relative">
                        <input
                            type="text"
                            id="context"
                            name="context"
                            value={settings.context}
                            onChange={handleChange}
                            className="w-full bg-green-950 border border-green-600 rounded-md p-2 focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 transition pr-12 text-slate-200 placeholder-green-600"
                            placeholder={listeningField === 'context' ? "Đang nghe..." : "ví dụ: Một khu phố yên tĩnh vào mùa xuân."}
                        />
                         {isApiSupported.current && (
                            <button
                                type="button"
                                onClick={() => handleMicClick('context')}
                                className={`absolute top-1/2 -translate-y-1/2 right-2.5 p-2 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-green-800 focus:ring-yellow-500 ${listeningField === 'context' ? 'bg-red-500 text-white animate-pulse' : 'bg-green-700 text-green-300 hover:bg-green-600'}`}
                                aria-label={listeningField === 'context' ? "Dừng đọc cho bối cảnh" : "Bắt đầu đọc cho bối cảnh"}
                            >
                                <Mic className="h-4 w-4" />
                            </button>
                        )}
                    </div>
                </div>
                <div>
                    <label htmlFor="characters" className="block text-sm font-medium text-green-300 mb-1">Nhân Vật (Tùy chọn)</label>
                    <div className="relative">
                        <input
                            type="text"
                            id="characters"
                            name="characters"
                            value={settings.characters}
                            onChange={handleChange}
                            className="w-full bg-green-950 border border-green-600 rounded-md p-2 focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 transition pr-12 text-slate-200 placeholder-green-600"
                            placeholder={listeningField === 'characters' ? "Đang nghe..." : "ví dụ: Cô bé 10 tuổi tò mò với mái tóc đỏ."}
                        />
                        {isApiSupported.current && (
                            <button
                                type="button"
                                onClick={() => handleMicClick('characters')}
                                className={`absolute top-1/2 -translate-y-1/2 right-2.5 p-2 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-green-800 focus:ring-yellow-500 ${listeningField === 'characters' ? 'bg-red-500 text-white animate-pulse' : 'bg-green-700 text-green-300 hover:bg-green-600'}`}
                                aria-label={listeningField === 'characters' ? "Dừng đọc cho nhân vật" : "Bắt đầu đọc cho nhân vật"}
                            >
                                <Mic className="h-4 w-4" />
                            </button>
                        )}
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="style" className="block text-sm font-medium text-green-300 mb-1">Phong Cách</label>
                        <select
                            id="style"
                            name="style"
                            value={settings.style}
                            onChange={handleChange}
                            className="w-full bg-green-950 border border-green-600 rounded-md p-2 focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 transition"
                        >
                            {INITIAL_STYLES.map(style => <option key={style.name} value={style.name}>{style.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label htmlFor="aspectRatio" className="block text-sm font-medium text-green-300 mb-1">Tỷ Lệ Khung Hình</label>
                        <select
                            id="aspectRatio"
                            name="aspectRatio"
                            value={settings.aspectRatio}
                            onChange={handleChange}
                            className="w-full bg-green-950 border border-green-600 rounded-md p-2 focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 transition"
                        >
                            {DIRECTOR_ASPECT_RATIOS.map(ratio => <option key={ratio.name} value={ratio.name}>{ratio.label}</option>)}
                        </select>
                    </div>
                </div>
                 <div>
                    <label htmlFor="numScenes" className="block text-sm font-medium text-green-300 mb-1">Số Lượng Cảnh</label>
                    <input
                        type="number"
                        id="numScenes"
                        name="numScenes"
                        value={settings.numScenes}
                        onChange={handleChange}
                        min="1"
                        max="10"
                        className="w-full bg-green-950 border border-green-600 rounded-md p-2 focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 transition"
                    />
                </div>

                <button
                    onClick={onGenerate}
                    disabled={isLoading || !settings.idea}
                    className="w-full flex items-center justify-center bg-gradient-to-r from-pink-500 via-red-500 to-yellow-500 hover:opacity-90 text-white font-bold py-3 px-4 rounded-md transition-all duration-300 disabled:from-green-600 disabled:to-green-700 disabled:text-slate-400 disabled:cursor-not-allowed transform hover:scale-105"
                >
                    {isLoading ? (
                        <>
                            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                            Đang tạo...
                        </>
                    ) : (
                         <>
                            <Bot className="mr-2 h-5 w-5" />
                            Tạo Kịch Bản
                        </>
                    )}
                </button>
            </div>
        </div>
    );
};

export default SettingsPanel;