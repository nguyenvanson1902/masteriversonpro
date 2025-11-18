// This is a large component file that includes sub-components for organization
// as per the 'handful of files' constraint. Sub-components are defined outside
// the main DirectorPage component to prevent re-rendering issues.
import React, { useState, useEffect, useCallback, useRef, ChangeEvent } from 'react';
import * as xlsx from 'xlsx';

import {
    INITIAL_STYLES, PACING_OPTIONS, DIRECTOR_ASPECT_RATIOS, DIALOGUE_LANGUAGES
} from '../constants';
import {
    BackIcon, SparklesIcon, YoutubeIcon, KeyIcon, UploadIcon, DownloadIcon, ClipboardIcon,
    ChevronDownIcon, ArrowRightIcon, FileIcon, CheckCircleIcon, XCircleIcon, SaveIcon, DirectorIcon, SendIcon,
    TranslateIcon, ElaborateIcon, PlayIcon, UserIcon, CubeIcon, TrashIcon, ImageIcon
} from './Icons';
import * as geminiService from '../services/geminiService';
import {
    getApiErrorMessage,
    isInvalidApiKeyError,
    isRateLimitError,
    API_LIMIT_ERROR_MESSAGE
} from '../utils';
import { Loader2 } from 'lucide-react';
import type { CharacterProfile, PropProfile, ImageFile } from '../types';


// --- HELPER TYPES & FUNCTIONS ---
const formatKeyForDisplay = (key: string) => `${key.substring(0, 4)}...${key.substring(key.length - 4)}`;
const fileToBase64 = (file: File): Promise<{ base64: string, mimeType: string }> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve({
            base64: (reader.result as string).split(',')[1],
            mimeType: file.type
        });
        reader.onerror = error => reject(error);
    });
};


// --- UI SUB-COMPONENTS ---

const ApiKeyModal = ({
    isOpen,
    onClose,
    onSave,
    initialKeys
}: {
    isOpen: boolean;
    onClose: () => void;
    onSave: (keys: string[]) => void;
    initialKeys: string[];
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
            <div className="bg-blue-900 rounded-xl shadow-2xl w-full max-w-2xl border border-blue-700">
                <div className="p-6">
                    <h2 className="text-xl font-bold text-gray-100">Quản lý API Keys</h2>
                    <p className="text-gray-400 mt-2 mb-4">Dán API key của bạn vào đây, mỗi key một dòng. Ứng dụng sẽ tự động xoay vòng key khi hết hạn mức.</p>
                    <textarea
                        value={keysInput}
                        onChange={(e) => setKeysInput(e.target.value)}
                        placeholder="AIzaSy..."
                        rows={8}
                        className="w-full p-3 bg-blue-950 border border-blue-600 rounded-md focus:ring-2 focus:ring-lime-500 text-gray-200 font-mono"
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


const RawJsonViewer = ({ scriptData }: { scriptData: any }) => {
    const handleCopyJson = () => {
        navigator.clipboard.writeText(JSON.stringify(scriptData, null, 2));
        alert("Đã sao chép JSON vào clipboard!");
    };

    return (
        <div className="bg-blue-900 rounded-xl shadow-lg border border-blue-800">
            <div className="p-4 border-b border-blue-800 flex justify-between items-center">
                <h3 className="text-lg font-semibold text-gray-200">Dữ Liệu JSON Thô</h3>
                <div className="flex items-center space-x-2">
                    <button onClick={handleCopyJson} className="flex items-center px-3 py-1.5 bg-gray-600 hover:bg-gray-500 text-white font-semibold rounded-lg transition-colors duration-200 text-xs" aria-label="Sao chép JSON">
                        <ClipboardIcon className="w-4 h-4 mr-2" /> Sao chép JSON
                    </button>
                </div>
            </div>
            <div className="p-4 text-xs text-gray-300 overflow-y-auto max-h-96 space-y-4">
                <div>
                    <h4 className="font-mono text-sm text-gray-400 mb-2">kế hoạch sản xuất:</h4>
                    <pre className="p-3 bg-blue-950 rounded-md overflow-x-auto">
                        <code>{JSON.stringify(scriptData.production_plan, null, 2)}</code>
                    </pre>
                </div>
                <div>
                    <h4 className="font-mono text-sm text-gray-400 mb-2">các cảnh:</h4>
                    {scriptData.scenes.map((scene: any, index: number) => (
                        <div key={index} className="mb-2">
                            <pre className="p-3 bg-blue-950 rounded-md overflow-x-auto">
                                <code>{JSON.stringify(scene, null, 2)}</code>
                            </pre>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

const ScriptEditor = ({
    scriptData,
    setScriptData,
    withApiKeyRotation,
    setError,
    handleGenerateVideo
}: {
    scriptData: any;
    setScriptData: React.Dispatch<React.SetStateAction<any>>;
    withApiKeyRotation: (apiCall: (apiKey: string) => Promise<any>) => Promise<any>;
    setError: (error: string | null) => void;
    handleGenerateVideo: (sceneIndex: number) => void;
}) => {
    const renumberScenes = (scenes: any[]) => {
        return scenes.map((scene, index) => ({ ...scene, scene_number: index + 1 }));
    };

    const handleCopyJson = () => {
        if (!scriptData) return;
        navigator.clipboard.writeText(JSON.stringify(scriptData, null, 2));
        alert("Đã sao chép JSON vào clipboard!");
    };

    const handleDownloadTxtScenesOnly = () => {
        if (!scriptData || !scriptData.scenes) return;
        const content = scriptData.scenes.map((scene: any) => scene.video_prompt).join('\n\n');
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${scriptData.production_plan.title.replace(/\s+/g, '_')}_prompts.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleDownloadXlsx = () => {
        if (!scriptData || !scriptData.scenes) return;

        const dataForSheet = scriptData.scenes.map((scene: any, index: number) => ({
            'STT': index + 1,
            'prompt': scene.video_prompt,
            'TRẠNG THÁI': '', // Empty column as requested
        }));

        const ws = xlsx.utils.json_to_sheet(dataForSheet);
        
        // Set column widths
        ws['!cols'] = [
            { wch: 5 },  // STT
            { wch: 150 }, // prompt
            { wch: 20 }, // TRẠNG THÁI
        ];

        const wb = xlsx.utils.book_new();
        xlsx.utils.book_append_sheet(wb, ws, 'Prompts');

        const filename = `${scriptData.production_plan.title.replace(/\s+/g, '_')}_prompts.xlsx`;
        xlsx.writeFile(wb, filename);
    };

    const handleUpdateScene = (index: number, updatedScene: any) => {
        if (!scriptData) return;
        const newScenes = [...scriptData.scenes];
        newScenes[index] = { ...newScenes[index], ...updatedScene };
        setScriptData({ ...scriptData, scenes: newScenes });
    };

    const handleElaborateScene = async (sceneIndex: number) => {
        if (!scriptData) return;
        handleUpdateScene(sceneIndex, { isElaborating: true });
        setError(null);
        try {
            const sceneToElaborate = scriptData.scenes[sceneIndex];
            const newDetailedScenes = await withApiKeyRotation(apiKey =>
                geminiService.elaborateScene(apiKey, scriptData.production_plan, sceneToElaborate)
            );
            const newScenes = [...scriptData.scenes];
            newScenes.splice(sceneIndex, 1, ...newDetailedScenes);
            setScriptData({ ...scriptData, scenes: renumberScenes(newScenes) });
        } catch (err) {
            setError(getApiErrorMessage(err));
            handleUpdateScene(sceneIndex, { isElaborating: false });
        }
    };

    const handleTranslate = async (sceneIndex: number) => {
        if (!scriptData) return;
        const scene = scriptData.scenes[sceneIndex];
        if (scene.translatedPrompt) {
             handleUpdateScene(sceneIndex, { translatedPrompt: undefined, isTranslating: false });
             return;
        }
        handleUpdateScene(sceneIndex, { isTranslating: true });
        setError(null);
        try {
            const translation = await withApiKeyRotation(apiKey =>
                geminiService.translatePrompt(apiKey, scene.video_prompt)
            );
            handleUpdateScene(sceneIndex, { translatedPrompt: translation, isTranslating: false });
        } catch (err) {
            setError(getApiErrorMessage(err));
            handleUpdateScene(sceneIndex, { isTranslating: false });
        }
    };
    
    const handleUpdatePacing = async (sceneIndex: number, newPacing: string) => {
        if (!scriptData) return;
        handleUpdateScene(sceneIndex, { isUpdatingPacing: true });
        setError(null);
        try {
            const updatedScene = await withApiKeyRotation(apiKey =>
                geminiService.updateScenePromptWithPacing(apiKey, scriptData.production_plan, scriptData.scenes[sceneIndex], newPacing)
            );
            handleUpdateScene(sceneIndex, { ...updatedScene, isUpdatingPacing: false });
        } catch (err) {
            setError(getApiErrorMessage(err));
            handleUpdateScene(sceneIndex, { isUpdatingPacing: false });
        }
    };


    return (
        <div className="space-y-4">
            <div className="text-center mb-4">
                <h2 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-lime-400 to-green-400">
                    {scriptData.production_plan.title}
                </h2>
                <p className="italic text-gray-400 mt-1 max-w-3xl mx-auto">
                    {scriptData.production_plan.logline}
                </p>
            </div>
            <div className="flex flex-wrap justify-between items-center gap-4 mb-2">
                <h3 className="text-2xl font-bold text-gray-200">Các Phân Cảnh</h3>
                 <div className="flex items-center flex-wrap gap-2">
                    <button onClick={handleDownloadTxtScenesOnly} className="flex items-center px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-colors duration-200 text-xs">
                        <DownloadIcon className="w-4 h-4 mr-2" /> Tải File TXT
                    </button>
                    <button onClick={handleDownloadXlsx} className="flex items-center px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-lg transition-colors duration-200 text-xs">
                        <DownloadIcon className="w-4 h-4 mr-2" /> Tải File Excel
                    </button>
                    <button onClick={handleCopyJson} className="flex items-center px-3 py-1.5 bg-gray-600 hover:bg-gray-500 text-white font-semibold rounded-lg transition-colors duration-200 text-xs">
                        <ClipboardIcon className="w-4 h-4 mr-2" /> Sao chép JSON
                    </button>
                </div>
            </div>

            <div className="max-h-[75vh] overflow-y-auto space-y-4 pr-2">
                {scriptData.scenes.map((scene: any, index: number) => (
                    <div key={scene.scene_number} className="bg-blue-900 border border-blue-800 rounded-lg overflow-hidden transition-shadow hover:shadow-lg hover:shadow-lime-500/10">
                        <div className="p-4 space-y-4 flex flex-col">
                           <div className="flex justify-between items-start">
                                <h4 className="font-bold text-lg text-lime-400">Cảnh {scene.scene_number}</h4>
                                <div className="text-right">
                                    <span className="text-xs font-semibold bg-blue-800 text-gray-300 px-2 py-1 rounded">{scene.duration_seconds} giây</span>
                                    <span className="text-xs font-semibold bg-blue-800 text-gray-300 px-2 py-1 rounded ml-2">{scene.aspect_ratio}</span>
                                </div>
                            </div>
                            <div className="flex-grow space-y-4 text-sm">
                                <div className="space-y-3">
                                    <div>
                                        <strong className="font-semibold text-gray-400 block mb-1">Prompt Video (Đã bao gồm lời thoại)</strong>
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="flex-grow">
                                                <textarea
                                                    className="w-full p-2 bg-blue-950/50 border border-blue-700 rounded-md text-sm placeholder-gray-400 focus:ring-2 focus:ring-lime-500 transition resize-y min-h-[180px] whitespace-pre-wrap"
                                                    aria-label={`Prompt Video cho Cảnh ${scene.scene_number}`}
                                                    value={scene.video_prompt}
                                                    onChange={(e) => handleUpdateScene(index, { video_prompt: e.target.value })}
                                                />
                                                {scene.translatedPrompt && (
                                                    <div className="mt-2 p-2 bg-blue-950/50 border border-blue-700 rounded-md text-sm text-gray-300">
                                                        <p className="whitespace-pre-wrap">{scene.translatedPrompt}</p>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex flex-col space-y-2 flex-shrink-0">
                                                <button onClick={() => navigator.clipboard.writeText(scene.video_prompt)} className="flex items-center justify-center px-2 py-1 bg-gray-600 hover:bg-gray-500 text-white font-semibold rounded-md transition-colors duration-200 text-xs">
                                                    <ClipboardIcon className="w-3 h-3 mr-1.5" /> Sao chép
                                                </button>
                                                <button onClick={() => handleTranslate(index)} disabled={scene.isTranslating} className="flex items-center justify-center px-2 py-1 bg-sky-600 hover:bg-sky-500 text-white font-semibold rounded-md transition-colors duration-200 text-xs disabled:bg-sky-800 disabled:cursor-wait">
                                                    <TranslateIcon className="w-3 h-3 mr-1.5" /> {scene.isTranslating ? '...' : (scene.translatedPrompt ? 'Ẩn' : 'Dịch')}
                                                </button>
                                                 <button onClick={() => handleElaborateScene(index)} disabled={scene.isElaborating} className="flex items-center justify-center px-2 py-1 bg-amber-600 hover:bg-amber-500 text-white font-semibold rounded-md transition-colors duration-200 text-xs disabled:bg-amber-800 disabled:cursor-wait" title="Kéo dài phân cảnh này thành nhiều cảnh chi tiết hơn">
                                                    <ElaborateIcon className="w-3 h-3 mr-1.5" /> {scene.isElaborating ? '...' : 'Chi tiết hóa'}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                    <div>
                                        <strong className="font-semibold text-gray-400 block mb-1">Chỉ đạo Nhịp điệu</strong>
                                        <div className="flex items-center gap-2">
                                            <select
                                                className="w-full p-2 bg-blue-800 border border-blue-700 rounded-md text-sm focus:ring-2 focus:ring-lime-500 transition disabled:opacity-50"
                                                value={scene.emotional_pacing || 'default'}
                                                onChange={(e) => handleUpdatePacing(index, e.target.value)}
                                                disabled={scene.isUpdatingPacing}
                                            >
                                                {PACING_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                            </select>
                                            {scene.isUpdatingPacing && <svg className="animate-spin h-5 w-5 text-lime-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>}
                                        </div>
                                    </div>
                                </div>
                            </div>
                             {/* Video Generation Section */}
                            <div className="mt-4 pt-4 border-t border-blue-800">
                                {(!scene.videoGenerationStatus || scene.videoGenerationStatus === 'idle') && (
                                    <button 
                                        onClick={() => handleGenerateVideo(index)}
                                        className="w-full flex items-center justify-center px-4 py-2 bg-gradient-to-r from-pink-500 via-red-500 to-yellow-500 hover:opacity-90 text-white font-bold rounded-md transition-all duration-300 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed"
                                    >
                                        <PlayIcon className="w-5 h-5 mr-2" /> Tạo Video
                                    </button>
                                )}
                                {(scene.videoGenerationStatus === 'generating' || scene.videoGenerationStatus === 'polling') && (
                                    <div className="flex items-center justify-center p-3 bg-blue-800/50 rounded-lg text-gray-300">
                                        <Loader2 className="animate-spin w-5 h-5 mr-3"/>
                                        <p className="text-sm font-semibold">
                                            {scene.videoGenerationStatus === 'generating' ? 'Đang khởi tạo...' : 'Đang xử lý video... (có thể mất vài phút)'}
                                        </p>
                                    </div>
                                )}
                                {scene.videoGenerationStatus === 'done' && scene.videoUrl && (
                                    <div className="space-y-3">
                                        <video controls src={scene.videoUrl} className="w-full rounded-lg bg-black"></video>
                                        <a 
                                            href={scene.videoUrl} 
                                            download={`scene_${scene.scene_number}.mp4`} 
                                            className="w-full flex items-center justify-center px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-bold rounded-md transition-colors duration-300"
                                        >
                                            <DownloadIcon className="w-5 h-5 mr-2" /> Tải Video
                                        </a>
                                    </div>
                                )}
                                {scene.videoGenerationStatus === 'error' && (
                                    <div className="p-3 bg-red-900/50 border border-red-700 rounded-lg text-red-300 text-sm">
                                        <p><strong className="font-bold">Lỗi tạo video:</strong> {scene.videoError}</p>
                                        <button 
                                            onClick={() => handleUpdateScene(index, { videoGenerationStatus: 'idle', videoError: undefined })}
                                            className="mt-2 text-xs font-semibold text-yellow-300 hover:underline"
                                        >
                                            Thử lại
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};


// --- MAIN DIRECTOR PAGE ---

const DirectorPage = ({ onBack }: { onBack: () => void }) => {
    // Component States
    const [apiKeys, setApiKeys] = useState<string[]>([]);
    const [isKeySet, setIsKeySet] = useState(false);
    const [apiKeyStatuses, setApiKeyStatuses] = useState<{[key: string]: string}>({});
    const apiKeyIndex = useRef(0);
    
    // Input States
    const [idea, setIdea] = useState("");
    const [summaryScript, setSummaryScript] = useState("");
    const [styleOptions, setStyleOptions] = useState(INITIAL_STYLES);
    const [selectedStyles, setSelectedStyles] = useState([INITIAL_STYLES[0].name]);
    const [includeMusic, setIncludeMusic] = useState(true);
    const [dialogueLanguage, setDialogueLanguage] = useState(DIALOGUE_LANGUAGES[0].value);
    const [sceneCount, setSceneCount] = useState(3);
    const [aspectRatio, setAspectRatio] = useState('9:16');
    const [outputLanguage, setOutputLanguage] = useState('english');

    // NEW state for characters, props, and setting
    const [characters, setCharacters] = useState<CharacterProfile[]>([]);
    const [props, setProps] = useState<PropProfile[]>([]);
    const [masterSettingDescription, setMasterSettingDescription] = useState("");
    const [settingImages, setSettingImages] = useState<{base64: string, mimeType: string}[]>([]);

    // UI States
    const [error, setError] = useState<string | null>(null);
    const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);
    const [isSummaryAssistantOpen, setIsSummaryAssistantOpen] = useState(false);
    const [generationStatus, setGenerationStatus] = useState('idle');
    const [scriptData, setScriptData] = useState<any | null>(null);
    const [resultView, setResultView] = useState('editor');

    // Chat states for Summary Assistant
    const [chatHistory, setChatHistory] = useState([
        { role: 'model', content: 'Sẵn sàng nhận ý tưởng. Vui lòng cung cấp ý tưởng video của bạn để tôi phân tích và tạo kịch bản tóm tắt kỹ thuật.' }
    ]);
    const [chatInput, setChatInput] = useState("");
    const [isChatLoading, setIsChatLoading] = useState(false);
    const chatContainerRef = useRef<HTMLDivElement>(null);

    // Chat states for Brainstorming
    const [isBrainstormOpen, setIsBrainstormOpen] = useState(false);
    const [brainstormHistory, setBrainstormHistory] = useState([
        { role: 'model', content: 'Chào bạn! Bạn đang muốn tìm ý tưởng cho video về chủ đề gì?' }
    ]);
    const [brainstormInput, setBrainstormInput] = useState("");
    const [isBrainstormLoading, setIsBrainstormLoading] = useState(false);
    const brainstormContainerRef = useRef<HTMLDivElement>(null);
    
    // Refs for file inputs to manage uploads for specific profiles
    const fileInputRef = useRef<HTMLInputElement>(null);
    const activeProfileRef = useRef<{ type: 'character' | 'prop' | 'setting', index?: number } | null>(null);


    const statusMap: {[key: string]: {text: string, color: string, icon: React.ReactNode}} = {
        ready: { text: 'Sẵn sàng', color: 'bg-green-500/80 text-white', icon: <CheckCircleIcon className="w-5 h-5 text-green-400" /> },
        exhausted: { text: 'Hết hạn', color: 'bg-red-500/80 text-white', icon: <XCircleIcon className="w-5 h-5 text-red-300" /> },
        invalid: { text: 'Không hợp lệ', color: 'bg-yellow-500/80 text-black', icon: <XCircleIcon className="w-5 h-5 text-yellow-800" /> },
        error: { text: 'Lỗi', color: 'bg-gray-500/80 text-white', icon: <XCircleIcon className="w-5 h-5 text-gray-300" /> },
        checking: { text: 'Đang kiểm tra...', color: 'bg-blue-500/80 text-white', icon: <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> }
    };

    useEffect(() => {
        if (outputLanguage === 'english') {
            setDialogueLanguage('english');
        } else if (outputLanguage === 'vietnamese') {
            setDialogueLanguage('vietnamese');
        }
    }, [outputLanguage]);

    useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, [chatHistory]);

    useEffect(() => {
        if (brainstormContainerRef.current) {
            brainstormContainerRef.current.scrollTop = brainstormContainerRef.current.scrollHeight;
        }
    }, [brainstormHistory]);

    useEffect(() => {
        const storedKeys = localStorage.getItem("gemini-api-keys");
        if (storedKeys) {
            const parsedKeys = JSON.parse(storedKeys);
            if (Array.isArray(parsedKeys) && parsedKeys.length > 0) {
              setApiKeys(parsedKeys);
              setIsKeySet(true);
              const initialStatuses: {[key: string]: string} = {};
              parsedKeys.forEach((key) => {
                initialStatuses[key] = 'ready'; // Assume ready on load
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

        const checkingStatuses: {[key: string]: string} = {};
        keys.forEach(key => {
            checkingStatuses[key] = 'checking';
        });
        setApiKeyStatuses(checkingStatuses);

        const newStatuses: {[key: string]: string} = {};
        for (const key of keys) {
            newStatuses[key] = await geminiService.validateApiKey(key);
        }
        setApiKeyStatuses(newStatuses);
    }, []);

    const handleClearAndSetKeys = () => {
         if (window.confirm("Bạn có chắc chắn muốn xóa tất cả các API key đã lưu và nhập lại từ đầu không?")) {
            setApiKeys([]);
            setApiKeyStatuses({});
            localStorage.removeItem("gemini-api-keys");
            setIsKeySet(false);
            setIsApiKeyModalOpen(true);
        }
    };
    
    const handleBrainstormSend = async () => {
        if (!brainstormInput.trim() || isBrainstormLoading) return;
        
        const newUserMessage = { role: 'user', content: brainstormInput };
        setBrainstormHistory(prev => [...prev, newUserMessage]);
        setBrainstormInput("");
        setIsBrainstormLoading(true);
        setError(null);

        try {
            const response = await withApiKeyRotation((key) => 
              geminiService.getBrainstormResponse(key, brainstormHistory, brainstormInput)
            );
            setBrainstormHistory(prev => [...prev, { role: 'model', content: response }]);
        } catch (err) {
            const errorMessage = getApiErrorMessage(err);
            setBrainstormHistory(prev => [...prev, { role: 'model', content: `Lỗi: ${errorMessage}` }]);
        } finally {
            setIsBrainstormLoading(false);
        }
    };

    const handleUseIdea = (rawContent: string) => {
        // Extracts the part of the idea after the intro, typically in quotes.
        const quoteMatch = rawContent.match(/"([^"]+)"/);
        const ideaText = quoteMatch ? quoteMatch[1] : rawContent.split(':').slice(1).join(':').trim();
        
        if (ideaText) {
            setIdea(ideaText);
            setIsBrainstormOpen(false); // Optionally close the panel after selecting
        }
    };

    const handleChatSend = async () => {
        if (!chatInput.trim() || isChatLoading) return;
        
        const newUserMessage = { role: 'user', content: chatInput };
        setChatHistory(prev => [...prev, newUserMessage]);
        setChatInput("");
        setIsChatLoading(true);
        setError(null);

        try {
            const response = await withApiKeyRotation((key) => 
              geminiService.getChatResponseForSummary(key, idea, sceneCount, chatHistory, chatInput)
            );
            setChatHistory(prev => [...prev, { role: 'model', content: response }]);
        } catch (err) {
            const errorMessage = getApiErrorMessage(err);
            setChatHistory(prev => [...prev, { role: 'model', content: `Lỗi: ${errorMessage}` }]);
        } finally {
            setIsChatLoading(false);
        }
    };

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
    }, [apiKeys, apiKeyStatuses]);
    
    // --- PROFILE MANAGEMENT ---

    const handleTriggerImageInput = (type: 'character' | 'prop' | 'setting', index?: number) => {
        activeProfileRef.current = { type, index };
        fileInputRef.current?.click();
    };
    
    const handleFileSelected = async (event: ChangeEvent<HTMLInputElement>) => {
        const profile = activeProfileRef.current;
        const files = event.target.files;
        if (!profile || !files || files.length === 0) return;

        const imagePromises = Array.from(files).map(fileToBase64);
        const newImages = await Promise.all(imagePromises);

        if (profile.type === 'character' && profile.index !== undefined) {
            setCharacters(prev => {
                const newChars = [...prev];
                const char = newChars[profile.index!];
                char.images = [...char.images, ...newImages];
                return newChars;
            });
        } else if (profile.type === 'prop' && profile.index !== undefined) {
            setProps(prev => {
                const newProps = [...prev];
                const prop = newProps[profile.index!];
                prop.images = [...(prop.images || []), ...newImages];
                return newProps;
            });
        } else if (profile.type === 'setting') {
            setSettingImages(prev => [...prev, ...newImages]);
        }
        
        if (fileInputRef.current) fileInputRef.current.value = "";
        activeProfileRef.current = null;
    };

    const handleAnalyzeProfileImages = async (type: 'character' | 'prop', index: number) => {
        setError(null);
        let imagesToAnalyze: {base64: string, mimeType: string}[] | undefined;
        let analysisFn: (apiKey: string, images: any[]) => Promise<string>;

        if (type === 'character') {
            const char = characters[index];
            if (!char.images || char.images.length === 0) return;
            imagesToAnalyze = char.images;
            analysisFn = geminiService.analyzeCharacterImages;
            setCharacters(p => p.map((c, i) => i === index ? { ...c, isAnalyzing: true } : c));
        } else { // prop
            const prop = props[index];
            if (!prop.images || prop.images.length === 0) return;
            imagesToAnalyze = prop.images;
            analysisFn = geminiService.analyzePropImages;
            setProps(p => p.map((pr, i) => i === index ? { ...pr, isAnalyzing: true } : pr));
        }

        try {
            const description = await withApiKeyRotation(apiKey => analysisFn(apiKey, imagesToAnalyze!));
             if (type === 'character') {
                setCharacters(p => p.map((c, i) => i === index ? { ...c, description } : c));
            } else {
                setProps(p => p.map((pr, i) => i === index ? { ...pr, description } : pr));
            }
        } catch (err) {
            // Error is set in withApiKeyRotation
        } finally {
             if (type === 'character') {
                setCharacters(p => p.map((c, i) => i === index ? { ...c, isAnalyzing: false } : c));
            } else {
                setProps(p => p.map((pr, i) => i === index ? { ...pr, isAnalyzing: false } : pr));
            }
        }
    };
    
    // --- END PROFILE MANAGEMENT ---


    const handleExportProject = () => {
        // This function will be implemented fully later.
        alert("Chức năng xuất dự án đang được phát triển!");
    };

    const handleImportProjectClick = () => {
        // This is now the general file input ref
        activeProfileRef.current = null; // Ensure we're not in profile mode
        fileInputRef.current?.click();
    };
    
    const handleStyleClick = (styleName: string) => {
        setSelectedStyles(prevStyles => {
            if (prevStyles.includes(styleName)) {
                // Prevent deselecting the last style
                if (prevStyles.length === 1) {
                    return prevStyles;
                }
                return prevStyles.filter(s => s !== styleName);
            } else {
                return [...prevStyles, styleName];
            }
        });
    };

    const handleGenerateScript = async () => {
        if (!isKeySet || (!idea.trim() && !summaryScript.trim())) {
            setError("Vui lòng nhập Ý tưởng Cốt lõi hoặc Kịch bản Tóm tắt.");
            return;
        }
        setGenerationStatus('planning');
        setError(null);
        setScriptData(null);

        try {
            const styles = styleOptions.filter(s => selectedStyles.includes(s.name));
            if (styles.length === 0) {
                throw new Error("Invalid style selected.");
            }

            const script = await withApiKeyRotation(apiKey =>
                geminiService.generateFullScript(apiKey, {
                    idea,
                    summaryScript,
                    styles,
                    dialogueLanguage,
                    sceneCount,
                    aspectRatio,
                    characters,
                    props,
                    masterSettingDescription, // This needs to be generated from settingImages if empty
                    includeMusic,
                    outputLanguage,
                }, (status: string) => {
                    if (status === 'scening') {
                        setGenerationStatus('scening');
                    }
                })
            );
            setScriptData(script);
            setResultView('editor'); // Default to editor view on new generation
        } catch (err) {
            // Error is set by withApiKeyRotation
            console.error("Script generation failed:", err);
        } finally {
            setGenerationStatus('idle');
        }
    };

    const handleUpdateSingleScene = useCallback((sceneIndex: number, updates: any) => {
        setScriptData((prev: any) => {
            if (!prev) return null;
            const newScenes = [...prev.scenes];
            newScenes[sceneIndex] = { ...newScenes[sceneIndex], ...updates };
            return { ...prev, scenes: newScenes };
        });
    }, []);

    const handleGenerateVideo = useCallback(async (sceneIndex: number) => {
        if (!scriptData) return;

        handleUpdateSingleScene(sceneIndex, { videoGenerationStatus: 'generating', videoError: undefined });

        try {
            const operation = await withApiKeyRotation(apiKey =>
                geminiService.generateVideoFromScene(apiKey, scriptData.scenes[sceneIndex], scriptData.scenes[sceneIndex].aspect_ratio)
            );
            handleUpdateSingleScene(sceneIndex, { videoGenerationStatus: 'polling', videoOperation: operation });
        } catch (err) {
            const errorMsg = getApiErrorMessage(err);
            setError(errorMsg);
            handleUpdateSingleScene(sceneIndex, { videoGenerationStatus: 'error', videoError: errorMsg });
        }
    }, [scriptData, withApiKeyRotation, handleUpdateSingleScene]);

    useEffect(() => {
        const POLLING_INTERVAL = 10000; // 10 seconds
        const scenesToPoll = scriptData?.scenes.filter((s: any) => s.videoGenerationStatus === 'polling' && s.videoOperation);
        if (!scenesToPoll || scenesToPoll.length === 0) {
            return;
        }
    
        const poll = async (scene: any, sceneIndex: number) => {
            try {
                const updatedOperation = await withApiKeyRotation(apiKey =>
                    geminiService.getVideosOperationStatus(apiKey, scene.videoOperation)
                );
                
                if (updatedOperation.done) {
                    if (updatedOperation.response) {
                        const videoUri = updatedOperation.response.generatedVideos?.[0]?.video?.uri;
                        if (videoUri) {
                            const currentApiKey = apiKeys[apiKeyIndex.current];
                            const res = await fetch(`${videoUri}&key=${currentApiKey}`);
                            const blob = await res.blob();
                            const videoUrl = URL.createObjectURL(blob);
                            handleUpdateSingleScene(sceneIndex, { videoGenerationStatus: 'done', videoUrl, videoOperation: undefined });
                        } else {
                             throw new Error("API did not return a video URI.");
                        }
                    } else {
                         throw new Error(updatedOperation.error?.message || "Video generation failed without a specific error message.");
                    }
                } else {
                     handleUpdateSingleScene(sceneIndex, { videoOperation: updatedOperation });
                }
            } catch (err) {
                const errorMsg = getApiErrorMessage(err);
                handleUpdateSingleScene(sceneIndex, { videoGenerationStatus: 'error', videoError: errorMsg, videoOperation: undefined });
            }
        };
    
        const intervalId = setInterval(() => {
            scriptData?.scenes.forEach((scene: any, index: number) => {
                if (scene.videoGenerationStatus === 'polling' && scene.videoOperation && !scene.videoOperation.done) {
                    poll(scene, index);
                }
            });
        }, POLLING_INTERVAL);
    
        return () => clearInterval(intervalId);
    
    }, [scriptData, apiKeys, withApiKeyRotation, handleUpdateSingleScene]);
    
    const assistantButtonTitle = !idea.trim() 
        ? "Vui lòng nhập Ý Tưởng Cốt Lõi để kích hoạt trợ lý." 
        : isSummaryAssistantOpen 
            ? "Đóng Trợ lý AI" 
            : "Sử dụng AI để tạo kịch bản tóm tắt";

    const isGenerating = generationStatus !== 'idle';

    const generateButtonTitle = (() => {
        if (isGenerating) return "Đang xử lý, vui lòng chờ...";
        if (!isKeySet) return "Vui lòng thiết lập API Key của bạn trước khi tạo.";
        if (!idea.trim() && !summaryScript.trim()) return "Vui lòng nhập Ý Tưởng Cốt Lõi hoặc kịch bản tóm tắt để tạo kịch bản.";
        return "Tạo Kịch Bản Video Chi Tiết";
    })();

    const generateButtonText = {
        idle: "Tạo Kịch Bản",
        planning: "Đang tạo Kế hoạch Sản xuất...",
        scening: "Đang tạo Phân cảnh..."
    }[generationStatus];


    return (
        <div className="min-h-screen bg-blue-950 text-gray-100 font-sans p-4 sm:p-6 lg:p-8">
            <ApiKeyModal
                isOpen={isApiKeyModalOpen}
                onClose={() => setIsApiKeyModalOpen(false)}
                onSave={handleSaveApiKeys}
                initialKeys={apiKeys}
            />
             {/* Single hidden file input for all uploads */}
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelected}
                accept="image/*"
                multiple
                style={{ display: 'none' }}
            />
            <div className="container mx-auto">
                <header className="text-center mb-10 relative">
                     <button onClick={onBack} className="absolute left-0 top-1/2 -translate-y-1/2 p-2 bg-blue-900 hover:bg-blue-800 rounded-full transition-colors" aria-label="Quay lại">
                        <BackIcon className="w-6 h-6 text-gray-300" />
                    </button>
                    <h1 className="text-5xl mb-2 font-black text-aurora-glow-7-colors">RIVER SƠN MASTER</h1>
                    <h1 className="text-xl sm:text-2xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-lime-400 via-green-400 to-emerald-500 py-2">
                        DIRECTOR
                    </h1>
                    <p className="mt-4 text-lg text-gray-300 max-w-7xl mx-auto">
                        Biến ý tưởng thành kịch bản, trực quan hóa bằng storyboard, và tinh chỉnh qua trò chuyện.
                    </p>
                     <div className="mt-4 flex justify-center">
                        <a href="https://www.youtube.com/channel/UCUd2-445om-KIlCOlHSDPsQ?sub_confirmation=1" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-4 py-2 bg-red-600/20 text-red-300 rounded-lg border border-red-600/50 hover:bg-red-600/40 transition-colors">
                            <YoutubeIcon className="w-5 h-5"/>
                            <span className="font-semibold">ỦNG HỘ KÊNH</span>
                        </a>
                    </div>
                </header>

                 <main>
                    {/* Project Management */}
                     <div className="w-full max-w-7xl mx-auto bg-blue-900/50 p-6 rounded-xl shadow-lg border border-blue-800 mb-8">
                        <div className="flex items-center mb-6">
                            <FileIcon className="w-6 h-6 mr-3 text-yellow-400" />
                            <h2 className="text-xl font-bold text-gray-200">Quản lý Dự án</h2>
                        </div>
                        <div className="grid grid-cols-1 md:max-w-lg mx-auto gap-6">
                            {/* API Key Card */}
                            <div className="bg-blue-950/50 p-4 rounded-lg border border-blue-800 flex flex-col">
                                <h3 className="text-lg font-semibold text-gray-200 mb-4 flex items-center"><KeyIcon className="w-5 h-5 mr-2 text-yellow-400" />Quản lý API Key (Hỗ trợ nhiều Key)</h3>
                                <div className="flex-grow flex flex-col">
                                    <div className="space-y-2 mb-4">
                                        {apiKeys.length > 0 ? apiKeys.map(key => {
                                            const status = apiKeyStatuses[key] || 'checking';
                                            const { text, color, icon } = statusMap[status];
                                            return (
                                                <div key={key} className="flex items-center justify-between p-2 rounded-md bg-blue-900">
                                                    <div className="flex items-center space-x-3">
                                                         {icon}
                                                        <span className="text-gray-300 font-mono text-sm">{formatKeyForDisplay(key)}</span>
                                                    </div>
                                                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${color}`}>
                                                        {text}
                                                    </span>
                                                </div>
                                            )
                                        }) : <p className="text-sm text-gray-400 text-center py-2">Chưa có API Key nào.</p>}
                                    </div>
                                    <p className="text-xs text-gray-400 mb-4">Ứng dụng sẽ tự động chuyển sang key tiếp theo khi một key hết hạn mức trong ngày.</p>
                                    <button onClick={() => setIsApiKeyModalOpen(true)} className="mt-auto px-3 py-1.5 bg-lime-600 hover:bg-lime-700 text-white font-bold rounded-lg transition-colors text-sm">
                                        {isKeySet ? 'Thêm / Sửa Keys' : 'Nhập API Keys'}
                                    </button>
                                     {isKeySet && <button onClick={handleClearAndSetKeys} className="mt-2 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg transition-colors text-sm">Xóa tất cả Keys & Nhập lại</button>}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Brainstorm AI Section */}
                    <div className="w-full max-w-7xl mx-auto mb-8">
                        <div className="bg-blue-900 rounded-xl shadow-lg border border-blue-800">
                            <button 
                                className="w-full flex justify-between items-center p-4 text-left" 
                                onClick={() => setIsBrainstormOpen(!isBrainstormOpen)}
                                aria-expanded={isBrainstormOpen}
                                title="Brainstorm Ý Tưởng"
                            >
                                <div className="flex items-center">
                                    <SparklesIcon className="w-6 h-6 mr-3 text-lime-400" />
                                    <h2 className="text-lg font-semibold text-gray-200">Brainstorm Ý Tưởng với AI</h2>
                                </div>
                                <ChevronDownIcon className={`w-6 h-6 text-gray-400 transition-transform duration-300 ${isBrainstormOpen ? 'transform rotate-180' : ''}`} />
                            </button>
                            {isBrainstormOpen && (
                                <div className="border-t border-blue-800">
                                    <div ref={brainstormContainerRef} className="p-4 h-72 overflow-y-auto space-y-4">
                                        {brainstormHistory.map((msg, index) => (
                                            <div key={index} className={`flex items-end gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                                {msg.role === 'model' && (
                                                    <div className="w-6 h-6 rounded-full bg-lime-500 flex-shrink-0 flex items-center justify-center">
                                                        <SparklesIcon className="w-4 h-4 text-lime-200" />
                                                    </div>
                                                )}
                                                <div className={`max-w-md p-3 rounded-lg ${msg.role === 'user' ? 'bg-lime-600 text-white' : 'bg-blue-800 text-gray-200'}`}>
                                                    <p className="whitespace-pre-wrap">{msg.content}</p>
                                                    {msg.role === 'model' && msg.content.includes(':') && !msg.content.startsWith('Lỗi:') && (
                                                        <button 
                                                            onClick={() => handleUseIdea(msg.content)}
                                                            className="mt-3 block text-xs font-bold text-lime-300 hover:text-lime-200 bg-lime-900/50 hover:bg-lime-900/80 px-2 py-1 rounded-md transition-colors"
                                                        >
                                                            Sử dụng ý tưởng này
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                        {isBrainstormLoading && (
                                            <div className="flex items-end gap-2 justify-start">
                                                <div className="w-6 h-6 rounded-full bg-lime-500 flex-shrink-0 flex items-center justify-center">
                                                    <SparklesIcon className="w-4 h-4 text-lime-200" />
                                                </div>
                                                <div className="max-w-md p-3 rounded-lg bg-blue-800 text-gray-200">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-2 h-2 bg-lime-300 rounded-full animate-pulse delay-75"></div>
                                                        <div className="w-2 h-2 bg-lime-300 rounded-full animate-pulse delay-150"></div>
                                                        <div className="w-2 h-2 bg-lime-300 rounded-full animate-pulse delay-300"></div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    <div className="p-4 border-t border-blue-800 flex items-center gap-2">
                                        <input
                                            type="text"
                                            placeholder="Nhập chủ đề..."
                                            className="flex-grow p-2 bg-blue-800 border border-blue-700 rounded-md focus:ring-2 focus:ring-lime-500 disabled:bg-blue-900"
                                            value={brainstormInput}
                                            onChange={(e) => setBrainstormInput(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleBrainstormSend()}
                                            disabled={isBrainstormLoading || !isKeySet}
                                        />
                                        <button 
                                            onClick={handleBrainstormSend}
                                            disabled={isBrainstormLoading || !brainstormInput.trim() || !isKeySet}
                                            className="p-2 bg-lime-600 hover:bg-lime-700 text-white rounded-md disabled:bg-lime-900 disabled:cursor-not-allowed transition-colors"
                                            aria-label="Gửi"
                                        >
                                           <SendIcon className="w-6 h-6" />
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                    
                    {/* Main Form Section */}
                    <div className="w-full max-w-7xl mx-auto bg-blue-900 p-8 rounded-xl shadow-lg border border-blue-800">
                        <div className="space-y-8">
                            {/* Idea */}
                            <div>
                                <label htmlFor="user_idea" className="block text-lg font-semibold mb-2 text-gray-200">Ý Tưởng Cốt Lõi (Tùy chọn)</label>
                                <textarea
                                    id="user_idea"
                                    placeholder="Ví dụ: Một chú mèo cam là chỉ huy của một nhà máy vận chuyển ở Nhật Bản."
                                    className="w-full p-3 bg-blue-800 border border-blue-700 rounded-md focus:ring-2 focus:ring-lime-500 focus:border-lime-500 transition-shadow duration-200 text-gray-100 placeholder-gray-400"
                                    rows={3}
                                    value={idea}
                                    onChange={(e) => setIdea(e.target.value)}
                                />
                            </div>

                            {/* Summary Script */}
                            <div>
                                <div className="flex justify-between items-center mb-2">
                                    <label htmlFor="summary_script" className="block text-lg font-semibold text-gray-200">Kịch bản Tóm tắt (Khuyên dùng)</label>
                                    <button
                                        onClick={() => setIsSummaryAssistantOpen(prev => !prev)}
                                        disabled={!idea.trim()}
                                        className="flex items-center gap-2 px-3 py-1.5 bg-green-600 hover:bg-green-700 disabled:bg-green-900 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors duration-200 text-sm"
                                        title={assistantButtonTitle}
                                    >
                                        <SparklesIcon className="w-4 h-4" />
                                        {isSummaryAssistantOpen ? 'Đóng Trợ lý' : 'Mở Trợ lý AI'}
                                    </button>
                                </div>
                                <textarea
                                    id="summary_script"
                                    placeholder={`Dán kịch bản tóm tắt tại đây, hoặc dùng Trợ lý AI. Ví dụ:\nCảnh 1: Mèo điệp viên hạ cánh trên mái nhà.\nCảnh 2: Nó lẻn qua các ống thông gió.\nCảnh 3: Nó đối mặt với con chuột cyber.`}
                                    className="w-full p-3 bg-blue-800 border border-blue-700 rounded-md focus:ring-2 focus:ring-lime-500 focus:border-lime-500 transition-shadow duration-200 text-gray-100 placeholder-gray-400"
                                    rows={5}
                                    value={summaryScript}
                                    onChange={(e) => setSummaryScript(e.target.value)}
                                />
                                {isSummaryAssistantOpen && (
                                    <div className="w-full bg-blue-950/50 border border-blue-800 rounded-lg shadow-inner mt-4">
                                        <div className="p-3 border-b border-blue-800 flex justify-between items-center">
                                            <h3 className="text-md font-semibold text-gray-200 flex items-center">
                                                <SparklesIcon className="w-5 h-5 mr-2 text-lime-400"/>
                                                Trợ lý Kịch bản Tóm tắt
                                            </h3>
                                            <button onClick={() => setIsSummaryAssistantOpen(false)} aria-label="Đóng Trợ lý">
                                                <XCircleIcon className="w-6 h-6 text-gray-500 hover:text-gray-300 transition-colors" />
                                            </button>
                                        </div>
                                        <div ref={chatContainerRef} className="p-4 h-72 overflow-y-auto space-y-4">
                                            {chatHistory.map((msg, index) => (
                                                <div key={index} className={`flex items-end gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                                    {msg.role === 'model' && (
                                                        <div className="w-6 h-6 rounded-full bg-lime-500 flex-shrink-0 flex items-center justify-center">
                                                           <SparklesIcon className="w-4 h-4 text-lime-200" />
                                                        </div>
                                                    )}
                                                    <div className={`max-w-md p-3 rounded-lg ${msg.role === 'user' ? 'bg-lime-600 text-white' : 'bg-blue-800 text-gray-200'}`}>
                                                        <p className="whitespace-pre-wrap">{msg.content}</p>
                                                    </div>
                                                </div>
                                            ))}
                                            {isChatLoading && (
                                                <div className="flex items-end gap-2 justify-start">
                                                    <div className="w-6 h-6 rounded-full bg-lime-500 flex-shrink-0 flex items-center justify-center">
                                                        <SparklesIcon className="w-4 h-4 text-lime-200" />
                                                    </div>
                                                    <div className="max-w-md p-3 rounded-lg bg-blue-800 text-gray-200">
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-2 h-2 bg-lime-300 rounded-full animate-pulse delay-75"></div>
                                                            <div className="w-2 h-2 bg-lime-300 rounded-full animate-pulse delay-150"></div>
                                                            <div className="w-2 h-2 bg-lime-300 rounded-full animate-pulse delay-300"></div>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                        <div className="p-3 border-t border-blue-800 flex items-center gap-2">
                                            <input
                                                type="text"
                                                placeholder="Nhập yêu cầu hoặc chỉnh sửa..."
                                                className="flex-grow p-2 bg-blue-800 border border-blue-700 rounded-md focus:ring-2 focus:ring-lime-500 disabled:bg-blue-900"
                                                value={chatInput}
                                                onChange={(e) => setChatInput(e.target.value)}
                                                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleChatSend()}
                                                disabled={isChatLoading || !isKeySet || !idea.trim()}
                                            />
                                            <button 
                                                onClick={handleChatSend}
                                                disabled={isChatLoading || !chatInput.trim() || !isKeySet || !idea.trim()}
                                                className="p-2 bg-lime-600 hover:bg-lime-700 text-white rounded-md disabled:bg-lime-900 disabled:cursor-not-allowed transition-colors"
                                                aria-label="Gửi"
                                            >
                                               <SendIcon className="w-6 h-6" />
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                            
                           <div className="space-y-8 pt-6 border-t border-gray-700">
                                {/* Character Profiles */}
                                <div>
                                    <h3 className="text-lg font-semibold text-gray-200 mb-4">Tham Chiếu Nhân Vật (Tùy chọn)</h3>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6">
                                        {characters.map((char, index) => (
                                            <div key={char.id} className="p-4 bg-gray-900/50 rounded-lg border border-gray-700 flex flex-col gap-4">
                                                <div className="flex justify-between items-center">
                                                    <input 
                                                        className="bg-transparent text-gray-200 font-semibold text-lg border-none focus:ring-0 p-0 w-full" 
                                                        type="text" 
                                                        value={char.name}
                                                        onChange={(e) => setCharacters(p => p.map((c, i) => i === index ? { ...c, name: e.target.value } : c))}
                                                    />
                                                    <button 
                                                        className="bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold hover:bg-red-500 transition-colors flex-shrink-0" 
                                                        aria-label={`Xóa ${char.name}`}
                                                        onClick={() => setCharacters(p => p.filter((_, i) => i !== index))}
                                                    >
                                                        ✕
                                                    </button>
                                                </div>
                                                <div className="flex-grow">
                                                    <div className="grid grid-cols-2 gap-3">
                                                        {char.images.map((img, imgIndex) => (
                                                             <div key={imgIndex} className="relative group">
                                                                <img alt={`Reference ${imgIndex + 1}`} className="w-full rounded-md object-cover border-2 border-gray-600 aspect-square" src={`data:${img.mimeType};base64,${img.base64}`} />
                                                                <button 
                                                                    className="absolute top-1 right-1 bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold hover:bg-red-500 transition-all opacity-0 group-hover:opacity-100" 
                                                                    aria-label={`Remove image ${imgIndex + 1}`}
                                                                    onClick={() => setCharacters(p => p.map((c, i) => i === index ? {...c, images: c.images.filter((_, i2) => i2 !== imgIndex)} : c))}
                                                                >
                                                                    ✕
                                                                </button>
                                                            </div>
                                                        ))}
                                                        <button
                                                            onClick={() => handleTriggerImageInput('character', index)}
                                                            className="cursor-pointer bg-gray-700 hover:bg-gray-600 text-gray-200 font-bold rounded-md transition-colors duration-200 flex flex-col items-center justify-center text-center w-full border border-dashed border-gray-600 aspect-square"
                                                        >
                                                            <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg>
                                                            <span className="text-xs mt-1">Thêm ảnh</span>
                                                        </button>
                                                    </div>
                                                </div>
                                                <button 
                                                    onClick={() => handleAnalyzeProfileImages('character', index)}
                                                    disabled={!char.images || char.images.length === 0 || char.isAnalyzing}
                                                    className="w-full flex items-center justify-center px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-900 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors duration-200 text-sm"
                                                >
                                                    {char.isAnalyzing ? <Loader2 className="w-5 h-5 mr-2 animate-spin"/> : <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.293 2.293a1 1 0 010 1.414L13 12l-1.293-1.293a1 1 0 010-1.414L14 7m5 5l2.293 2.293a1 1 0 010 1.414L19 19l-1.293-1.293a1 1 0 010-1.414L20 14m-3-3l2.293 2.293a1 1 0 010 1.414L17 16l-1.293-1.293a1 1 0 010-1.414L18 11z"></path></svg>}
                                                    {char.isAnalyzing ? `Đang phân tích...` : `Phân tích ${char.name} bằng AI`}
                                                </button>
                                                <textarea 
                                                    placeholder={`Mô tả chi tiết cho ${char.name}...`} 
                                                    className="w-full p-3 bg-gray-700 border border-gray-600 rounded-md focus:ring-2 focus:ring-indigo-500 text-sm placeholder-gray-400" 
                                                    rows={3}
                                                    value={char.description}
                                                    onChange={(e) => setCharacters(p => p.map((c, i) => i === index ? { ...c, description: e.target.value } : c))}
                                                ></textarea>
                                                <textarea 
                                                    placeholder="Gợi ý Âm thanh Đặc trưng (Tùy chọn)..." 
                                                    className="w-full mt-2 p-3 bg-gray-700 border border-gray-600 rounded-md focus:ring-2 focus:ring-indigo-500 text-sm placeholder-gray-400" 
                                                    rows={2}
                                                    value={char.soundCues}
                                                    onChange={(e) => setCharacters(p => p.map((c, i) => i === index ? { ...c, soundCues: e.target.value } : c))}
                                                ></textarea>
                                            </div>
                                        ))}
                                        <button 
                                            onClick={() => setCharacters(prev => [...prev, { id: Date.now().toString(), name: `Nhân vật ${prev.length + 1}`, description: '', soundCues: '', images: [] }])}
                                            className="flex flex-col items-center justify-center p-4 aspect-square bg-gray-900/50 rounded-lg border-2 border-dashed border-gray-700 hover:bg-gray-800/70 hover:border-indigo-500 transition-colors duration-200 text-gray-400 hover:text-white" 
                                            aria-label="Thêm nhân vật mới"
                                        >
                                            <span className="text-5xl font-thin">+</span>
                                            <span className="mt-2 font-semibold">Thêm Nhân vật</span>
                                        </button>
                                    </div>
                                </div>
                                
                                {/* Prop Profiles */}
                                 <div>
                                    <h3 className="text-lg font-semibold text-gray-200 mb-4">Đạo cụ & Thực thể Quan trọng (Tùy chọn)</h3>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6">
                                        {props.map((prop, index) => (
                                             <div key={prop.id} className="p-4 bg-gray-900/50 rounded-lg border border-gray-700 flex flex-col gap-4">
                                                <div className="flex justify-between items-center">
                                                    <input className="bg-transparent text-gray-200 font-semibold text-lg border-none focus:ring-0 p-0 w-full" type="text" value={prop.name} onChange={(e) => setProps(p => p.map((pr, i) => i === index ? { ...pr, name: e.target.value } : pr))} />
                                                    <button className="bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold hover:bg-red-500 transition-colors flex-shrink-0" aria-label={`Xóa ${prop.name}`} onClick={() => setProps(p => p.filter((_, i) => i !== index))}>✕</button>
                                                </div>
                                                <textarea placeholder={`Mô tả chi tiết cho ${prop.name}...`} className="w-full p-3 bg-gray-700 border border-gray-600 rounded-md focus:ring-2 focus:ring-indigo-500 text-sm placeholder-gray-400" rows={3} value={prop.description} onChange={(e) => setProps(p => p.map((pr, i) => i === index ? { ...pr, description: e.target.value } : pr))}></textarea>
                                                <textarea placeholder="Gợi ý Âm thanh Đặc trưng (Tùy chọn)..." className="w-full mt-2 p-3 bg-gray-700 border border-gray-600 rounded-md focus:ring-2 focus:ring-indigo-500 text-sm placeholder-gray-400" rows={2} value={prop.soundCues} onChange={(e) => setProps(p => p.map((pr, i) => i === index ? { ...pr, soundCues: e.target.value } : pr))}></textarea>
                                            </div>
                                        ))}
                                        <button onClick={() => setProps(prev => [...prev, { id: Date.now().toString(), name: `Đạo cụ ${prev.length + 1}`, description: '', soundCues: '' }])} className="flex flex-col items-center justify-center p-4 aspect-square bg-gray-900/50 rounded-lg border-2 border-dashed border-gray-700 hover:bg-gray-800/70 hover:border-indigo-500 transition-colors duration-200 text-gray-400 hover:text-white" aria-label="Thêm đạo cụ mới">
                                            <span className="text-5xl font-thin">+</span>
                                            <span className="mt-2 font-semibold">Thêm Đạo cụ</span>
                                        </button>
                                    </div>
                                </div>

                                {/* Setting Profiles */}
                                <div>
                                    <h3 className="text-lg font-semibold text-gray-200 mb-4">Tham Chiếu Bối Cảnh (Tùy chọn)</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 bg-gray-900/50 rounded-lg border border-gray-700">
                                        <div className="space-y-4">
                                            <div className="grid grid-cols-2 gap-3">
                                                 {settingImages.map((img, imgIndex) => (
                                                     <div key={imgIndex} className="relative group">
                                                        <img alt={`Reference ${imgIndex + 1}`} className="w-full rounded-md object-cover border-2 border-gray-600 aspect-square" src={`data:${img.mimeType};base64,${img.base64}`} />
                                                        <button className="absolute top-1 right-1 bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold hover:bg-red-500 transition-all opacity-0 group-hover:opacity-100" aria-label={`Remove image ${imgIndex + 1}`} onClick={() => setSettingImages(p => p.filter((_, i2) => i2 !== imgIndex))}>✕</button>
                                                    </div>
                                                ))}
                                                <button onClick={() => handleTriggerImageInput('setting')} className="cursor-pointer bg-gray-700 hover:bg-gray-600 text-gray-200 font-bold rounded-md transition-colors duration-200 flex flex-col items-center justify-center text-center w-full border border-dashed border-gray-600 aspect-square">
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg>
                                                    <span className="text-xs mt-1">Thêm ảnh</span>
                                                </button>
                                            </div>
                                            {/* Note: Analyze Setting button can be added here if needed */}
                                        </div>
                                        <textarea placeholder="Mô tả chi tiết về bối cảnh tổng thể, không khí, thời gian trong ngày, v.v. để AI có thêm ngữ cảnh." className="w-full h-full p-3 bg-gray-700 border border-gray-600 rounded-md focus:ring-2 focus:ring-indigo-500 text-sm placeholder-gray-400 min-h-[200px]" value={masterSettingDescription} onChange={(e) => setMasterSettingDescription(e.target.value)}></textarea>
                                    </div>
                                </div>
                            </div>


                            {/* Style Presets */}
                            <div>
                                <h3 className="text-lg font-semibold text-gray-200 mb-3">Phong Cách Video (Chọn một hoặc nhiều)</h3>
                                <div className="flex flex-wrap gap-3">
                                    {styleOptions.map(style => (
                                        <button
                                            key={style.name}
                                            onClick={() => handleStyleClick(style.name)}
                                            title={style.description}
                                            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-blue-900
                                                ${selectedStyles.includes(style.name)
                                                    ? 'bg-lime-600 text-white focus:ring-lime-500'
                                                    : 'bg-blue-800 text-gray-300 hover:bg-blue-700 focus:ring-gray-500'
                                                }`}
                                        >
                                            {style.name}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            
                            {/* Detailed Customization */}
                             <div className="space-y-8 pt-6 border-t border-blue-800">
                                <div className="bg-blue-800/50 p-4 rounded-lg border border-blue-700">
                                    <label htmlFor="include-music-toggle" className="flex items-center cursor-pointer">
                                        <div className="relative">
                                            <input id="include-music-toggle" className="sr-only peer" type="checkbox" checked={includeMusic} onChange={() => setIncludeMusic(!includeMusic)} />
                                            <div className="w-14 h-8 bg-blue-700 rounded-full peer-checked:bg-lime-600 transition-colors"></div>
                                            <div className="absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform peer-checked:translate-x-full"></div>
                                        </div>
                                        <div className="ml-4">
                                            <span className="text-lg font-semibold text-gray-100">Bao gồm Âm nhạc</span>
                                            <p className="text-sm text-gray-400">TẮT tùy chọn này nếu bạn muốn tự thêm nhạc nền sau.</p>
                                        </div>
                                    </label>
                                </div>
                                
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                                     <div>
                                        <label htmlFor="scene-count" className="block text-sm font-semibold mb-2 text-gray-300">Số Lượng Cảnh</label>
                                        <input
                                            id="scene-count"
                                            type="number"
                                            value={sceneCount}
                                            onChange={(e) => setSceneCount(Math.max(1, parseInt(e.target.value, 10)))}
                                            className="w-full p-3 bg-blue-800 border border-blue-700 rounded-md focus:ring-2 focus:ring-lime-500"
                                            min="1"
                                            max="15"
                                        />
                                    </div>
                                    <div>
                                        <label htmlFor="aspect-ratio" className="block text-sm font-semibold mb-2 text-gray-300">Tỷ lệ khung hình</label>
                                        <select
                                            id="aspect-ratio"
                                            value={aspectRatio}
                                            onChange={(e) => setAspectRatio(e.target.value)}
                                            className="w-full p-3 bg-blue-800 border border-blue-700 rounded-md focus:ring-2 focus:ring-lime-500"
                                        >
                                            {DIRECTOR_ASPECT_RATIOS.map(ratio => (
                                                <option key={ratio.name} value={ratio.name}>{ratio.label}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label htmlFor="dialogue-language" className="block text-sm font-semibold mb-2 text-gray-300">Ngôn ngữ Thoại</label>
                                        <select
                                            id="dialogue-language"
                                            value={dialogueLanguage}
                                            onChange={(e) => setDialogueLanguage(e.target.value)}
                                            className="w-full p-3 bg-blue-800 border border-blue-700 rounded-md focus:ring-2 focus:ring-lime-500"
                                        >
                                            {DIALOGUE_LANGUAGES.map(lang => (
                                                <option key={lang.value} value={lang.value}>{lang.label}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold mb-2 text-gray-300">Ngôn ngữ Prompt Video</label>
                                        <div className="inline-flex rounded-lg shadow-sm w-full">
                                            <button
                                                onClick={() => setOutputLanguage('english')}
                                                type="button"
                                                className={`w-1/2 px-4 py-2.5 text-sm font-medium transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-lime-500 rounded-l-lg ${
                                                    outputLanguage === 'english'
                                                        ? 'bg-lime-600 text-white'
                                                        : 'bg-blue-800 text-gray-300 hover:bg-blue-700'
                                                }`}
                                            >
                                                Tiếng Anh
                                            </button>
                                            <button
                                                onClick={() => setOutputLanguage('vietnamese')}
                                                type="button"
                                                className={`w-1/2 px-4 py-2.5 text-sm font-medium transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-lime-500 rounded-r-lg ${
                                                    outputLanguage === 'vietnamese'
                                                        ? 'bg-lime-600 text-white'
                                                        : 'bg-blue-800 text-gray-300 hover:bg-blue-700'
                                                }`}
                                            >
                                                Tiếng Việt
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Generate Button */}
                        <div className="mt-8 text-center">
                            <button
                                onClick={handleGenerateScript}
                                disabled={isGenerating || !isKeySet || (!idea.trim() && !summaryScript.trim())}
                                className="w-full max-w-md flex items-center justify-center gap-3 px-8 py-4 bg-gradient-to-r from-lime-500 via-green-500 to-emerald-500 hover:opacity-90 text-white font-bold text-lg rounded-lg shadow-lg shadow-green-500/20 transform hover:-translate-y-1 transition-all duration-300 disabled:from-gray-600 disabled:to-gray-700 disabled:text-gray-400 disabled:shadow-none disabled:cursor-not-allowed"
                                title={generateButtonTitle}
                            >
                                {isGenerating ? <Loader2 className="w-6 h-6 animate-spin" /> : <DirectorIcon className="w-6 h-6" />}
                                {generateButtonText}
                            </button>
                        </div>
                    </div>
                    
                    {/* Results Section */}
                    {scriptData && (
                        <div className="w-full max-w-7xl mx-auto mt-8 bg-blue-900/50 p-6 rounded-xl shadow-lg border border-blue-800 animate-fadeInUp">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-2xl font-bold text-gray-200">Kết quả</h2>
                                <div className="flex items-center space-x-2 bg-blue-800 p-1 rounded-lg">
                                    <button 
                                        onClick={() => setResultView('editor')}
                                        className={`px-3 py-1.5 text-sm font-semibold rounded-md transition-colors ${resultView === 'editor' ? 'bg-lime-600 text-white' : 'text-gray-300 hover:bg-blue-700'}`}
                                    >
                                        Trình chỉnh sửa
                                    </button>
                                     <button 
                                        onClick={() => setResultView('json')}
                                        className={`px-3 py-1.5 text-sm font-semibold rounded-md transition-colors ${resultView === 'json' ? 'bg-lime-600 text-white' : 'text-gray-300 hover:bg-blue-700'}`}
                                    >
                                        Xem JSON
                                    </button>
                                </div>
                            </div>
                            
                            {resultView === 'editor' ? (
                                <ScriptEditor 
                                    scriptData={scriptData} 
                                    setScriptData={setScriptData} 
                                    withApiKeyRotation={withApiKeyRotation} 
                                    setError={setError}
                                    handleGenerateVideo={handleGenerateVideo}
                                />
                            ) : (
                                <RawJsonViewer scriptData={scriptData} />
                            )}
                        </div>
                    )}
                </main>

                {error && (
                    <div className="fixed bottom-4 right-4 w-full max-w-md bg-red-800/90 text-white p-4 rounded-lg shadow-lg border border-red-600 backdrop-blur-sm animate-fadeInUp z-50">
                        <div className="flex justify-between items-start">
                             <div className="whitespace-pre-wrap"><strong className="font-bold">Đã xảy ra lỗi:</strong><br/>{error}</div>
                             <button onClick={() => setError(null)} className="p-1 -mt-1 -mr-1"><XCircleIcon className="w-6 h-6"/></button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default DirectorPage;