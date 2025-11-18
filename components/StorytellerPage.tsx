



import React, { useState, useEffect, useRef, useCallback } from 'react';
import { STORYTELLER_TOPICS, TTS_VOICES } from '../constants';
import * as geminiService from '../services/geminiService';
import { decode, decodeAudioData, createWavBlob, getApiErrorMessage, isInvalidApiKeyError, isRateLimitError, API_LIMIT_ERROR_MESSAGE } from '../utils';
import {
    BackIcon, SparklesIcon, YoutubeIcon, KeyIcon, DownloadIcon,
    XCircleIcon, CheckCircleIcon, SendIcon, PlayIcon
} from './Icons';

// --- HELPER CONSTANTS & FUNCTIONS ---

const formatKeyForDisplay = (key) => `${key.substring(0, 4)}...${key.substring(key.length - 4)}`;

// --- SUB-COMPONENTS ---

const ApiKeyModal = ({
    isOpen,
    onClose,
    onSave,
    initialKeys
}) => {
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


const PlayButton = ({ text, onPlay, isLoading, position }) => {
    if (!position || !text) return null;
    return (
        <div className="absolute z-50" style={{ top: position.top, left: position.left }}>
            <button
                onClick={() => onPlay(text)}
                disabled={isLoading}
                className="flex items-center px-3 py-1.5 bg-lime-600 hover:bg-lime-700 disabled:bg-lime-900 text-white font-semibold rounded-lg shadow-lg transition-all transform hover:scale-110"
            >
                {isLoading ? (
                     <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                ) : (
                    <><PlayIcon className="w-5 h-5 mr-1" /> Nghe thử</>
                )}
            </button>
        </div>
    );
};


const StorytellerPage = ({ onBack }) => {
    const [apiKeys, setApiKeys] = useState([]);
    const [isKeySet, setIsKeySet] = useState(false);
    const [apiKeyStatuses, setApiKeyStatuses] = useState({});
    const apiKeyIndex = useRef(0);

    const [idea, setIdea] = useState("");
    const [selectedTopicId, setSelectedTopicId] = useState(STORYTELLER_TOPICS[0].id);
    const [generatedScript, setGeneratedScript] = useState("");
    const [language, setLanguage] = useState("vi");
    const [selectedVoice, setSelectedVoice] = useState(TTS_VOICES[0]);
    const [characterCount, setCharacterCount] = useState(1500);
    
    const [isGeneratingScript, setIsGeneratingScript] = useState(false);
    const [isGeneratingSpeech, setIsGeneratingSpeech] = useState(false);
    const [error, setError] = useState(null);
    const [selectedText, setSelectedText] = useState("");
    const [playButtonPosition, setPlayButtonPosition] = useState(null);
    const [isSamplePlaying, setIsSamplePlaying] = useState(false);
    const [fullAudioUrl, setFullAudioUrl] = useState(null);
    
    const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);

    // New states for voice testing
    const [testSentence, setTestSentence] = useState('Đây là bản nghe thử giọng nói do AI tạo ra.');
    const [isTestingVoice, setIsTestingVoice] = useState(false);

    const audioContextRef = useRef(null);
    const scriptTextAreaRef = useRef(null);
    
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
              const initialStatuses = {};
              parsedKeys.forEach((key) => {
                initialStatuses[key] = 'ready';
              });
              setApiKeyStatuses(initialStatuses);
            }
        }
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        return () => {
            audioContextRef.current?.close();
        };
    }, []);

    const handleSaveApiKeys = useCallback(async (keys) => {
        localStorage.setItem("gemini-api-keys", JSON.stringify(keys));
        setApiKeys(keys);
        setIsKeySet(keys.length > 0);
        setIsApiKeyModalOpen(false);
        apiKeyIndex.current = 0;
        
        const checkingStatuses = {};
        keys.forEach(key => {
            checkingStatuses[key] = 'checking';
        });
        setApiKeyStatuses(checkingStatuses);

        const newStatuses = {};
        for (const key of keys) {
            newStatuses[key] = await geminiService.validateApiKey(key);
        }
        setApiKeyStatuses(newStatuses);
    }, []);

    const withApiKeyRotation = async (apiCall) => {
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

    const handleGenerateScript = async () => {
        if (!idea.trim()) {
            setError("Vui lòng nhập ý tưởng chính.");
            return;
        }
        setIsGeneratingScript(true);
        setError(null);
        setGeneratedScript("");
        try {
            const topic = STORYTELLER_TOPICS.find(t => t.id === selectedTopicId);
            if (!topic) throw new Error("Chủ đề không hợp lệ.");
            
            const script = await withApiKeyRotation((key) =>
                geminiService.generateStorytellerScript(key, topic.prompt, idea, characterCount, language)
            );
            setGeneratedScript(script);
        } catch (err) {
            // Error is handled by withApiKeyRotation
        } finally {
            setIsGeneratingScript(false);
        }
    };
    
    const handleGenerateSpeech = async (isSample) => {
        const textToSpeak = isSample ? selectedText : generatedScript;
        if (!textToSpeak.trim()) {
            setError("Không có văn bản để tạo giọng nói.");
            return;
        }

        const loadingSetter = isSample ? setIsSamplePlaying : setIsGeneratingSpeech;
        loadingSetter(true);
        setError(null);
        if (!isSample) setFullAudioUrl(null);
        
        try {
            const voiceForApi = selectedVoice.value;
            const base64Audio = await withApiKeyRotation(
                (key) => geminiService.generateSpeech(key, textToSpeak, voiceForApi)
            );
            const pcmData = decode(base64Audio);

            if (isSample) {
                if (audioContextRef.current) {
                    const audioBuffer = await decodeAudioData(pcmData, audioContextRef.current, 24000, 1);
                    const source = audioContextRef.current.createBufferSource();
                    source.buffer = audioBuffer;
                    source.connect(audioContextRef.current.destination);
                    source.start(0);
                    source.onended = () => setIsSamplePlaying(false);
                }
            } else {
                const wavBlob = createWavBlob(pcmData);
                const audioUrl = URL.createObjectURL(wavBlob);
                setFullAudioUrl(audioUrl);
            }

        } catch (err) {
            // error is handled by withApiKeyRotation
        } finally {
             if (!isSample || (isSample && isSamplePlaying === false)) {
                loadingSetter(false);
            }
        }
    };
    
    const handleTestVoice = async () => {
        if (!testSentence.trim()) {
            setError("Vui lòng nhập văn bản để nghe thử.");
            return;
        }
    
        setIsTestingVoice(true);
        setError(null);
        
        try {
            const voiceForApi = selectedVoice.value;
            const base64Audio = await withApiKeyRotation(
                (key) => geminiService.generateSpeech(key, testSentence, voiceForApi)
            );
            const pcmData = decode(base64Audio);
    
            if (audioContextRef.current) {
                const audioBuffer = await decodeAudioData(pcmData, audioContextRef.current, 24000, 1);
                const source = audioContextRef.current.createBufferSource();
                source.buffer = audioBuffer;
                source.connect(audioContextRef.current.destination);
                source.start(0);
                source.onended = () => setIsTestingVoice(false);
            } else {
                setIsTestingVoice(false);
            }
    
        } catch (err) {
            setIsTestingVoice(false);
            // error is handled by withApiKeyRotation
        }
    };

    const handleTextSelection = () => {
        const text = window.getSelection()?.toString() || "";
        if (text.trim() && scriptTextAreaRef.current) {
            const selection = window.getSelection();
            if (selection && selection.rangeCount > 0) {
                const range = selection.getRangeAt(0);
                const rect = range.getBoundingClientRect();
                const containerRect = scriptTextAreaRef.current.getBoundingClientRect();
                setPlayButtonPosition({
                    top: rect.top - containerRect.top - 45,
                    left: rect.left - containerRect.top + (rect.width / 2) - 60,
                });
            }
            setSelectedText(text);
        } else {
            setSelectedText("");
            setPlayButtonPosition(null);
        }
    };
    
    const handleVoiceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newLabel = e.target.value;
        const newVoiceObject = TTS_VOICES.find(v => v.label === newLabel);
        if (newVoiceObject) {
            setSelectedVoice(newVoiceObject);
        }
    };

    const selectedTopic = STORYTELLER_TOPICS.find(t => t.id === selectedTopicId);
    
    return (
        <div className="min-h-screen bg-blue-950 text-gray-100 font-sans p-4 sm:p-6 lg:p-8">
            <ApiKeyModal isOpen={isApiKeyModalOpen} onClose={() => setIsApiKeyModalOpen(false)} onSave={handleSaveApiKeys} initialKeys={apiKeys} />
            <div className="container mx-auto">
                <header className="text-center mb-10 relative">
                     <button onClick={onBack} className="absolute left-0 top-1/2 -translate-y-1/2 p-2 bg-blue-900 hover:bg-blue-800 rounded-full transition-colors" aria-label="Quay lại">
                        <BackIcon className="w-6 h-6 text-gray-300" />
                    </button>
                    <h1 className="text-5xl mb-2 font-black text-gray-100">RIVER SƠN MASTER</h1>
                    <h1 className="text-xl sm:text-2xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-lime-300 via-green-300 to-emerald-400 py-2">
                        STORYTELLING
                    </h1>
                    <p className="mt-4 text-lg text-gray-300 max-w-3xl mx-auto">
                        Tạo kịch bản lồng tiếng chuyên nghiệp và chuyển đổi thành giọng nói AI chất lượng cao.
                    </p>
                     <div className="mt-4 flex justify-center">
                        <a href="https://www.youtube.com/channel/UCUd2-445om-KIlCOlHSDPsQ?sub_confirmation=1" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-4 py-2 bg-red-600/20 text-red-300 rounded-lg border border-red-600/50 hover:bg-red-600/40 transition-colors">
                            <YoutubeIcon className="w-5 h-5"/>
                            <span className="font-semibold">ỦNG HỘ KÊNH</span>
                        </a>
                    </div>
                </header>

                <main className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                   {/* Left Column - Inputs */}
                   <div className="bg-blue-900/50 p-6 rounded-xl shadow-lg border border-blue-800 space-y-6">
                       <h2 className="text-2xl font-bold text-gray-200 border-b border-blue-800 pb-3">Bước 1: Tạo kịch bản</h2>
                       
                       {/* API Key */}
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
                       
                        <div>
                            <label htmlFor="idea" className="block text-lg font-semibold mb-2 text-gray-200">Ý tưởng chính</label>
                            <textarea id="idea" value={idea} onChange={e => setIdea(e.target.value)} placeholder="Ví dụ: Kể về một ngôi nhà ma ám trên ngọn đồi, nơi có những linh hồn không siêu thoát..." className="w-full p-3 bg-blue-800 border border-blue-700 rounded-md focus:ring-2 focus:ring-lime-500 transition-shadow duration-200" rows={3}></textarea>
                        </div>
                        <div>
                             <label htmlFor="topic" className="block text-lg font-semibold mb-2 text-gray-200">Chủ đề & Phong cách</label>
                             <select id="topic" value={selectedTopicId} onChange={e => setSelectedTopicId(e.target.value)} className="w-full p-3 bg-blue-800 border border-blue-700 rounded-md focus:ring-2 focus:ring-lime-500 transition-shadow duration-200">
                                 {STORYTELLER_TOPICS.map(topic => <option key={topic.id} value={topic.id}>{topic.name}</option>)}
                             </select>
                              {selectedTopic && <p className="text-sm text-gray-400 mt-2">{selectedTopic.description}</p>}
                        </div>
                        <div>
                             <label htmlFor="charCount" className="block text-lg font-semibold mb-2 text-gray-200">Độ dài Kịch bản (Ký tự)</label>
                             <div className="flex items-center gap-4">
                                <input id="charCount" type="range" min="500" max="50000" step="500" value={characterCount} onChange={e => setCharacterCount(Number(e.target.value))} className="w-full h-2 bg-blue-700 rounded-lg appearance-none cursor-pointer" />
                                <span className="font-mono text-lg text-lime-300 w-20 text-center">{characterCount}</span>
                             </div>
                        </div>
                        <button onClick={handleGenerateScript} disabled={isGeneratingScript || !idea || !isKeySet} className="w-full flex items-center justify-center gap-3 px-8 py-4 bg-lime-600 hover:bg-lime-700 disabled:bg-lime-900 disabled:text-gray-400 disabled:cursor-not-allowed text-white font-bold rounded-lg shadow-lg transform hover:scale-105 transition-all duration-300">
                            {isGeneratingScript ? (
                                <>
                                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                    Đang sáng tạo...
                                </>
                            ) : (
                                <><SparklesIcon className="w-6 h-6" /> Tạo Kịch Bản</>
                            )}
                        </button>
                   </div>
                   
                   {/* Right Column - Output & TTS */}
                   <div className="bg-blue-900/50 p-6 rounded-xl shadow-lg border border-blue-800 space-y-6">
                       <h2 className="text-2xl font-bold text-gray-200 border-b border-blue-800 pb-3">Bước 2: Chuyển thành giọng nói</h2>
                       <div className="relative">
                            <PlayButton text={selectedText} onPlay={() => handleGenerateSpeech(true)} isLoading={isSamplePlaying} position={playButtonPosition} />
                            <textarea ref={scriptTextAreaRef} onMouseUp={handleTextSelection} onBlur={() => { setTimeout(() => { setSelectedText(""); setPlayButtonPosition(null); }, 150) }} value={generatedScript} onChange={e => setGeneratedScript(e.target.value)} placeholder="Kịch bản do AI tạo sẽ xuất hiện ở đây..." className="w-full p-4 bg-blue-950/70 border border-blue-700 rounded-md focus:ring-2 focus:ring-lime-500 transition-shadow duration-200 h-64 resize-y"></textarea>
                       </div>
                       
                        {/* TTS Settings */}
                        <div className="space-y-4">
                            <div>
                                <label htmlFor="voice" className="block text-lg font-semibold mb-2 text-gray-200">Giọng đọc</label>
                                <select id="voice" value={selectedVoice.label} onChange={handleVoiceChange} className="w-full p-3 bg-blue-800 border border-blue-700 rounded-md focus:ring-2 focus:ring-lime-500">
                                    {TTS_VOICES.map(v => <option key={v.label} value={v.label}>{v.label}</option>)}
                                </select>
                                {selectedVoice.style && (
                                    <p className="text-sm text-gray-400 mt-2 p-3 bg-blue-950/50 rounded-lg border border-blue-800">{selectedVoice.style}</p>
                                )}
                                <div className="mt-3 p-3 bg-blue-950/50 rounded-lg border border-blue-800">
                                    <label htmlFor="test-sentence" className="block text-sm font-semibold mb-2 text-gray-300">Nghe thử giọng nói đã chọn</label>
                                    <div className="flex items-center gap-2">
                                        <input 
                                            id="test-sentence"
                                            type="text"
                                            value={testSentence}
                                            onChange={e => setTestSentence(e.target.value)}
                                            className="w-full p-2 bg-blue-800 border border-blue-700 rounded-md focus:ring-2 focus:ring-lime-500"
                                        />
                                        <button 
                                            onClick={handleTestVoice}
                                            disabled={isTestingVoice || !testSentence.trim() || !isKeySet}
                                            className="flex-shrink-0 px-4 py-2 bg-sky-600 hover:bg-sky-700 disabled:bg-sky-900 text-white font-semibold rounded-lg flex items-center justify-center"
                                            style={{minWidth: '120px'}}
                                            title="Nghe thử giọng nói với văn bản mẫu"
                                        >
                                            {isTestingVoice ? (
                                                <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                </svg>
                                            ) : (
                                                <><PlayIcon className="w-5 h-5 mr-1.5" /> Nghe thử</>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <button onClick={() => handleGenerateSpeech(false)} disabled={isGeneratingSpeech || !generatedScript || !isKeySet} className="w-full flex items-center justify-center gap-3 px-8 py-4 bg-lime-600 hover:bg-lime-700 disabled:bg-lime-900 disabled:text-gray-400 disabled:cursor-not-allowed text-white font-bold rounded-lg shadow-lg transform hover:scale-105 transition-all duration-300">
                           {isGeneratingSpeech ? (
                                <>
                                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                    Đang tạo âm thanh...
                                </>
                            ) : (
                                <> <SendIcon className="w-6 h-6" /> Tạo Âm thanh</>
                            )}
                        </button>
                        
                        {fullAudioUrl && (
                            <div className="mt-4 p-4 bg-blue-950/50 rounded-lg border border-blue-800 animate-fadeInUp">
                                <h3 className="font-semibold mb-2 text-gray-200">Âm thanh đã tạo:</h3>
                                <audio controls src={fullAudioUrl} className="w-full"></audio>
                                <a href={fullAudioUrl} download="river_son_storyteller_audio.wav" className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-colors">
                                    <DownloadIcon className="w-5 h-5"/> Tải xuống file .WAV
                                </a>
                            </div>
                        )}
                   </div>
                </main>

                {error && (
                    <div className="fixed bottom-4 right-4 w-full max-w-md bg-red-800/90 text-white p-4 rounded-lg shadow-lg border border-red-600 backdrop-blur-sm animate-fadeInUp">
                        <div className="flex justify-between items-start">
                             <div className="whitespace-pre-wrap"><strong className="font-bold">Đã xảy ra lỗi:</strong><br/>{error}</div>
                             <button onClick={() => setError(null)} className="p-1 -mt-1 -mr-1"><XCircleIcon className="w-6 h-6"/></button>
                        </div>
                    </div>
                )}

                 <footer className="text-center mt-16 text-gray-500 text-sm flex flex-col items-center">
                    <p>PHÁT TRIỂN BỞI RIVER SƠN MASTER.</p>
                    <p>Donate để chúng tôi có động lực phát triển App đẳng cấp tối thượng hơn nữa, xin cảm ơn!</p>
                    <img 
                        src="https://img.vietqr.io/image/TCB-19037518595018-compact2.png?amount=100000&addInfo=TOOL%20AFFILIATE%20VINH%20VIEN&accountName=NGUYEN%20VAN%20SON" 
                        alt="QR Code for Bank Transfer" 
                        className="w-64 h-64 rounded-lg shadow-lg border-2 border-slate-600 mt-4"
                    />
                </footer>
            </div>
        </div>
    );
};


export default StorytellerPage;