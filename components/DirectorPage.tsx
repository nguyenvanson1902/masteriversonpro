

// This is a large component file that includes sub-components for organization
// as per the 'handful of files' constraint. Sub-components are defined outside
// the main DirectorPage component to prevent re-rendering issues.
import React, { useState, useEffect, useCallback, useRef } from 'react';
import * as xlsx from 'xlsx';

import {
    INITIAL_STYLES, PACING_OPTIONS, DIRECTOR_ASPECT_RATIOS, DIALOGUE_LANGUAGES
} from '../constants';
import {
    BackIcon, SparklesIcon, YoutubeIcon, KeyIcon, UploadIcon, DownloadIcon, ClipboardIcon,
    ChevronDownIcon, ArrowRightIcon, FileIcon, CheckCircleIcon, XCircleIcon, SaveIcon, DirectorIcon, SendIcon,
    TranslateIcon, ElaborateIcon, PlayIcon
} from './Icons';
import * as geminiService from '../services/geminiService';
import {
    getApiErrorMessage,
    isInvalidApiKeyError,
    isRateLimitError,
    API_LIMIT_ERROR_MESSAGE
} from '../utils';
import { Loader2 } from 'lucide-react';


// --- HELPER TYPES & FUNCTIONS ---
const formatKeyForDisplay = (key) => `${key.substring(0, 4)}...${key.substring(key.length - 4)}`;

// --- UI SUB-COMPONENTS ---

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


const RawJsonViewer = ({ scriptData }) => {
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
                    {scriptData.scenes.map((scene, index) => (
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
}) => {
    const [isElaboratingAll, setIsElaboratingAll] = useState(false);
    const [isDownloadingSummary, setIsDownloadingSummary] = useState(false);

    const renumberScenes = (scenes) => {
        return scenes.map((scene, index) => ({ ...scene, scene_number: index + 1 }));
    };

    const handleDownloadTxtDetailed = () => {
        if (!scriptData) return;

        const prompts = scriptData.scenes.map(scene => scene.video_prompt.trim());
        const content = prompts.join('\n\n');

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
        if (!scriptData) return;

        // Create the data array for the sheet in the old format
        const dataForSheet = scriptData.scenes.map(scene => {
            const promptObject = {
                scene_number: scene.scene_number,
                video_prompt: scene.video_prompt,
            };
            const promptString = JSON.stringify(promptObject);

            return {
                'STT': scene.scene_number,
                'Prompt': promptString,
                'Trạng thái': '' // Empty status column as requested
            };
        });

        // Create a new workbook and a worksheet
        const ws = xlsx.utils.json_to_sheet(dataForSheet);
        const wb = xlsx.utils.book_new();
        
        // Append the worksheet to the workbook
        xlsx.utils.book_append_sheet(wb, ws, "Dữ Liệu JSON Scenes");

        // Adjust column widths
        ws['!cols'] = [
            { wch: 5 },   // STT
            { wch: 150 }, // Prompt
            { wch: 20 },  // Trạng thái
        ];

        // --- Download ---
        const pp = scriptData.production_plan;
        const filename = `${pp.title.replace(/\s+/g, '_')}_prompts.xlsx`;
        xlsx.writeFile(wb, filename);
    };

    const handleUpdateScene = (index, updatedScene) => {
        if (!scriptData) return;
        const newScenes = [...scriptData.scenes];
        newScenes[index] = { ...newScenes[index], ...updatedScene };
        setScriptData({ ...scriptData, scenes: newScenes });
    };

    const handleElaborateAll = async () => {
        if (!scriptData) return;
        setIsElaboratingAll(true);
        setError(null);
        try {
            const elaboratedScenes = await withApiKeyRotation(apiKey =>
                geminiService.elaborateAllScenes(apiKey, scriptData.production_plan, scriptData.scenes)
            );
            setScriptData({ ...scriptData, scenes: renumberScenes(elaboratedScenes) });
        } catch (err) {
            setError(getApiErrorMessage(err));
        } finally {
            setIsElaboratingAll(false);
        }
    };

    const handleDownloadSummary = async () => {
        if (!scriptData) return;
        setIsDownloadingSummary(true);
        setError(null);
        try {
            const summary = await withApiKeyRotation(apiKey =>
                geminiService.generateSummaryFromPrompts(apiKey, scriptData)
            );
            const blob = new Blob([summary], { type: 'text/plain;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${scriptData.production_plan.title.replace(/\s+/g, '_')}_summary.txt`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (err) {
            setError(getApiErrorMessage(err));
        } finally {
            setIsDownloadingSummary(false);
        }
    };

    const handleElaborateScene = async (sceneIndex) => {
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

    const handleTranslate = async (sceneIndex) => {
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
    
    const handleUpdatePacing = async (sceneIndex, newPacing) => {
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
                     <button onClick={handleElaborateAll} disabled={isElaboratingAll} className="flex items-center px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-lg transition-colors duration-200 text-xs disabled:bg-amber-900 disabled:cursor-wait">
                        <ElaborateIcon className="w-4 h-4 mr-2" /> {isElaboratingAll ? 'Đang xử lý...' : 'Chi tiết hóa Toàn bộ'}
                    </button>
                    <button onClick={handleDownloadSummary} disabled={isDownloadingSummary} className="flex items-center px-3 py-1.5 bg-cyan-600 hover:bg-cyan-700 text-white font-semibold rounded-lg transition-colors duration-200 text-xs disabled:bg-cyan-900 disabled:cursor-wait">
                        <DownloadIcon className="w-4 h-4 mr-2" /> {isDownloadingSummary ? 'Đang tạo...' : 'Tải tóm tắt'}
                    </button>
                     <button onClick={handleDownloadTxtDetailed} className="flex items-center px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-colors duration-200 text-xs">
                        <DownloadIcon className="w-4 h-4 mr-2" /> Tải File TXT
                    </button>
                    <button onClick={handleDownloadXlsx} className="flex items-center px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-lg transition-colors duration-200 text-xs">
                        <DownloadIcon className="w-4 h-4 mr-2" /> Tải File Excel
                    </button>
                </div>
            </div>

            <div className="max-h-[75vh] overflow-y-auto space-y-4 pr-2">
                {scriptData.scenes.map((scene, index) => (
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
                                        <strong className="font-semibold text-gray-400 block mb-1">Prompt Video</strong>
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="flex-grow">
                                                <textarea
                                                    className="w-full p-2 bg-blue-950/50 border border-blue-700 rounded-md text-sm placeholder-gray-400 focus:ring-2 focus:ring-lime-500 transition resize-y min-h-[120px] whitespace-pre-wrap"
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
                        