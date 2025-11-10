import React, { useState, useCallback, useRef, useEffect } from 'react';
import { GoogleGenAI, Modality, Type } from "@google/genai";
import * as xlsx from 'xlsx';
import { BackIcon, KeyIcon, UploadIcon, WandIcon, CheckCircleIcon, XCircleIcon, ElaborateIcon, TranslateIcon, SaveIcon, DownloadIcon } from './Icons';
import * as geminiService from '../services/geminiService';
import { getApiErrorMessage, isInvalidApiKeyError, isRateLimitError } from '../utils';
import { Loader2, ClipboardIcon } from 'lucide-react';
import { PACING_OPTIONS } from '../constants';


interface ImageData {
    file: File;
    previewUrl: string;
    base64: string;
}

// --- Inlined components/Icons.tsx ---
const FilmIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
    </svg>
);

const CopyIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </svg>
);

const CheckIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
);

const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            const result = reader.result as string;
            resolve(result.split(',')[1]);
        };
        reader.onerror = error => reject(error);
    });
};

const ImageUploader = ({ title, onImageUpload }: { title: string; onImageUpload: (imageData: ImageData) => void; }) => {
    const [preview, setPreview] = useState<string | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            if (preview) {
                URL.revokeObjectURL(preview);
            }
            const previewUrl = URL.createObjectURL(file);
            setPreview(previewUrl);

            const base64 = await fileToBase64(file);
            onImageUpload({
                file: file,
                previewUrl: previewUrl,
                base64: base64,
            });
        }
    }, [onImageUpload, preview]);

    const handleClick = () => {
        inputRef.current?.click();
    };

    return (
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 flex flex-col items-center justify-center text-center transition-all duration-300 hover:border-blue-500 hover:bg-slate-800">
            <h3 className="text-lg font-semibold text-slate-300 mb-3">{title}</h3>
            <input
                type="file"
                ref={inputRef}
                onChange={handleFileChange}
                className="hidden"
                accept="image/png, image/jpeg, image/webp"
            />
            <div
                onClick={handleClick}
                className="w-full aspect-square bg-slate-900/70 rounded-lg cursor-pointer flex items-center justify-center border-2 border-dashed border-slate-600 hover:border-blue-600 transition-colors relative"
            >
                {preview ? (
                    <img src={preview} alt="Uploaded preview" className="w-full h-full object-cover rounded-lg" />
                ) : (
                    <div className="flex flex-col items-center text-slate-500">
                        <UploadIcon />
                        <p className="mt-2 text-sm">Nhấp để tải lên</p>
                    </div>
                )}
            </div>
        </div>
    );
};

const SkeletonLoader = () => (
    <div className="w-full animate-pulse flex flex-col gap-4">
        <div className="aspect-square bg-slate-700 rounded-lg"></div>
        <div className="h-4 bg-slate-700 rounded w-3/4"></div>
        <div className="h-4 bg-slate-700 rounded w-full"></div>
        <div className="h-4 bg-slate-700 rounded w-1/2"></div>
    </div>
);

const AffiliateScriptDisplay = ({
    scriptData,
    setScriptData,
    withApiKeyRotation,
    setError,
}) => {
    const [isElaboratingAll, setIsElaboratingAll] = useState(false);
    const [isDownloadingSummary, setIsDownloadingSummary] = useState(false);
    const [resultView, setResultView] = useState('editor');

    const renumberScenes = (scenes) => scenes.map((scene, index) => ({ ...scene, scene_number: index + 1 }));

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
    
    const handleDownloadTxt = () => {
        if (!scriptData) return;
        let content = `Title: ${scriptData.production_plan.title}\nLogline: ${scriptData.production_plan.logline}\n\n`;
        scriptData.scenes.forEach(scene => {
            content += `SCENE ${scene.scene_number}\nPROMPT: ${scene.video_prompt}\n\n`;
        });
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${scriptData.production_plan.title.replace(/\s+/g, '_')}_script.txt`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleDownloadXlsx = () => {
        if (!scriptData) return;
        const dataForSheet = scriptData.scenes.map(s => ({
            'scene_number': s.scene_number, 'video_prompt': s.video_prompt, 'duration_seconds': s.duration_seconds,
            'aspect_ratio': s.aspect_ratio, 'style': s.style, 'emotional_pacing': s.emotional_pacing || 'N/A',
        }));
        const worksheet = xlsx.utils.json_to_sheet(dataForSheet);
        worksheet['!cols'] = [{ wch: 15 }, { wch: 150 }, { wch: 15 }, { wch: 15 }, { wch: 30 }, { wch: 20 }];
        const workbook = xlsx.utils.book_new();
        xlsx.utils.book_append_sheet(workbook, worksheet, 'Scenes');
        xlsx.writeFile(workbook, `${scriptData.production_plan.title.replace(/\s+/g, '_')}_script.xlsx`);
    };

    const handleElaborateScene = async (sceneIndex) => {
        if (!scriptData) return;
        handleUpdateScene(sceneIndex, { isElaborating: true });
        try {
            const newDetailedScenes = await withApiKeyRotation(apiKey =>
                geminiService.elaborateScene(apiKey, scriptData.production_plan, scriptData.scenes[sceneIndex])
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
        <div className="mt-12">
            <div className="text-center mb-4">
                <h2 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400">
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
                    <button onClick={handleDownloadTxt} className="flex items-center px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-colors duration-200 text-xs"><DownloadIcon className="w-4 h-4 mr-2"/>Tải File TXT</button>
                    <button onClick={handleDownloadXlsx} className="flex items-center px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-lg transition-colors duration-200 text-xs"><DownloadIcon className="w-4 h-4 mr-2"/>Tải File Excel</button>
                </div>
            </div>

            <div className="max-h-[75vh] overflow-y-auto space-y-4 pr-2">
                {scriptData.scenes.map((scene, index) => (
                    <div key={scene.scene_number} className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden transition-shadow hover:shadow-lg hover:shadow-indigo-500/10">
                        <div className="p-4 space-y-4 flex flex-col">
                           <div className="flex justify-between items-start">
                                <h4 className="font-bold text-lg text-indigo-400">Cảnh {scene.scene_number}</h4>
                                <div className="text-right">
                                    <span className="text-xs font-semibold bg-gray-700 text-gray-300 px-2 py-1 rounded">{scene.duration_seconds} giây</span>
                                    <span className="text-xs font-semibold bg-gray-700 text-gray-300 px-2 py-1 rounded ml-2">{scene.aspect_ratio}</span>
                                </div>
                            </div>
                            <div className="flex-grow space-y-4 text-sm">
                                <div className="space-y-3">
                                    <div>
                                        <strong className="font-semibold text-gray-400 block mb-1">Prompt Video</strong>
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="flex-grow">
                                                <textarea
                                                    className="w-full p-2 bg-gray-900/50 border border-gray-700 rounded-md text-sm placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 transition resize-y min-h-[120px] whitespace-pre-wrap"
                                                    value={scene.video_prompt}
                                                    onChange={(e) => handleUpdateScene(index, { video_prompt: e.target.value })}
                                                />
                                                {scene.translatedPrompt && (
                                                    <div className="mt-2 p-2 bg-gray-900/50 border border-gray-700 rounded-md text-sm text-gray-300">
                                                        <p className="whitespace-pre-wrap">{scene.translatedPrompt}</p>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex flex-col space-y-2 flex-shrink-0">
                                                <button onClick={() => navigator.clipboard.writeText(scene.video_prompt)} className="flex items-center justify-center px-2 py-1 bg-gray-600 hover:bg-gray-500 text-white font-semibold rounded-md transition-colors duration-200 text-xs"><ClipboardIcon className="w-3 h-3 mr-1.5" /> Sao chép</button>
                                                <button onClick={() => handleTranslate(index)} disabled={scene.isTranslating} className="flex items-center justify-center px-2 py-1 bg-sky-600 hover:bg-sky-500 text-white font-semibold rounded-md transition-colors duration-200 text-xs disabled:bg-sky-800 disabled:cursor-wait"><TranslateIcon className="w-3 h-3 mr-1.5" /> {scene.isTranslating ? '...' : (scene.translatedPrompt ? 'Ẩn' : 'Dịch')}</button>
                                                 <button onClick={() => handleElaborateScene(index)} disabled={scene.isElaborating} className="flex items-center justify-center px-2 py-1 bg-amber-600 hover:bg-amber-500 text-white font-semibold rounded-md transition-colors duration-200 text-xs disabled:bg-amber-800 disabled:cursor-wait" title="Kéo dài phân cảnh này"><ElaborateIcon className="w-3 h-3 mr-1.5" /> {scene.isElaborating ? '...' : 'Chi tiết hóa'}</button>
                                            </div>
                                        </div>
                                    </div>
                                    <div>
                                        <strong className="font-semibold text-gray-400 block mb-1">Chỉ đạo Nhịp điệu</strong>
                                        <div className="flex items-center gap-2">
                                            <select
                                                className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-sm focus:ring-2 focus:ring-indigo-500 transition disabled:opacity-50"
                                                value={scene.emotional_pacing || 'default'}
                                                onChange={(e) => handleUpdatePacing(index, e.target.value)}
                                                disabled={scene.isUpdatingPacing}
                                            >
                                                {PACING_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                            </select>
                                            {scene.isUpdatingPacing && <Loader2 className="h-5 w-5 animate-spin text-indigo-400"/>}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};


// FIX: Making children optional to resolve incorrect TypeScript errors.
const OptionGroup = ({ label, children }: { label: string; children?: React.ReactNode }) => (
    <div className="flex flex-col items-center gap-2">
        <label className="block text-sm font-medium text-slate-400">{label}</label>
        <div className="flex items-center gap-3 flex-wrap justify-center">{children}</div>
    </div>
);

// FIX: Making children optional to resolve incorrect TypeScript errors.
const OptionButton = ({ selected, onClick, children }: { selected: boolean; onClick: () => void; children?: React.ReactNode }) => (
    <button
        onClick={onClick}
        className={`px-6 py-3 text-lg rounded-lg font-semibold tracking-wide transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-blue-500 transform active:translate-y-0.5 ${selected
            ? 'bg-blue-600 text-white border-b-4 border-blue-800 shadow-xl'
            : 'bg-slate-700 text-slate-300 border-b-4 border-slate-800 hover:bg-slate-600 shadow-lg'
            }`}
    >
        {children}
    </button>
);

const AffiliatePage = ({ onBack }: { onBack: () => void }) => {
    const [modelImage, setModelImage] = useState<ImageData | null>(null);
    const [productImage, setProductImage] = useState<ImageData | null>(null);
    
    const [generatedData, setGeneratedData] = useState<any[] | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [generationMode, setGenerationMode] = useState('product');
    const [aspectRatio, setAspectRatio] = useState('9:16');
    const [voice, setVoice] = useState('female');
    const [region, setRegion] = useState('south');
    const [numberOfResults, setNumberOfResults] = useState(1);
    const [platform, setPlatform] = useState('tiktok');
    const [outfitSuggestion, setOutfitSuggestion] = useState('');
    const [backgroundSuggestion, setBackgroundSuggestion] = useState('');
    const [productInfo, setProductInfo] = useState('');
    const [productSuggestion, setProductSuggestion] = useState('');
    
    const withApiKeyRotation = useCallback(async (apiCall: (apiKey: string) => Promise<any>) => {
        // A placeholder for the API key rotation logic, assuming a single key from env for simplicity now
        try {
             if (!process.env.API_KEY) {
                throw new Error("API key is not configured.");
            }
            return await apiCall(process.env.API_KEY);
        } catch (err) {
            setError(getApiErrorMessage(err));
            throw err;
        }
    }, []);

    const setScriptDataForIndex = (index: number, data: any) => {
        setGeneratedData(prev => {
            if (!prev) return null;
            const newData = [...prev];
            newData[index].scriptData = data;
            return newData;
        });
    };

    const handleGenerateContent = useCallback(async () => {
        if (!modelImage || !productImage) {
            setError('Vui lòng tải lên cả ảnh người mẫu và ảnh sản phẩm.');
            return;
        }

        setIsLoading(true);
        setError(null);
        setGeneratedData(null);

        try {
            const promises = Array.from({ length: numberOfResults }, (_, i) => 
                withApiKeyRotation(apiKey => 
                    geminiService.generateFullAffiliateScript(apiKey, {
                        modelImageBase64: modelImage.base64,
                        productImageBase64: productImage.base64,
                        aspectRatio, voice, region, generationMode,
                        outfitSuggestion, backgroundSuggestion, productInfo, productSuggestion, platform
                    })
                )
            );
            
            const results = await Promise.all(promises);
            setGeneratedData(results.map((res, index) => ({ 
                id: `result-${index}-${Date.now()}`,
                imageUrl: `data:image/jpeg;base64,${res.generatedImageBase64}`,
                scriptData: res.scriptData,
            })));

        } catch (err) {
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    }, [modelImage, productImage, aspectRatio, voice, region, numberOfResults, generationMode, outfitSuggestion, backgroundSuggestion, productInfo, productSuggestion, platform]);

    return (
        <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center p-4 lg:p-8 font-sans">
            <div className="w-full max-w-7xl mx-auto flex flex-col gap-8">
                <header className="text-center relative">
                    <button onClick={onBack} className="absolute left-0 top-1/2 -translate-y-1/2 flex items-center bg-slate-800/60 backdrop-blur-sm border border-cyan-500 text-cyan-300 font-semibold px-4 py-2 rounded-lg shadow-lg shadow-cyan-500/10 hover:bg-cyan-500/20 hover:text-cyan-200 hover:shadow-cyan-500/30 transition-all duration-300 transform hover:-translate-y-1">
                        <BackIcon className="w-5 h-5 mr-2" />
                        <span>Quay Lại</span>
                    </button>
                    <h1 className="text-4xl lg:text-5xl font-bold">
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500">MASTER RIVER SƠN AFFILIATE</span>
                    </h1>
                    <p className="text-slate-400 mt-2">
                        Ứng dụng tạo ảnh sản phẩm và kịch bản quảng cáo chi tiết cho Tiktok và Facebook.
                    </p>
                </header>

                <main className="flex flex-col gap-8 w-full">
                    { !generatedData && (
                        <>
                            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 flex flex-wrap items-center justify-center gap-x-8 gap-y-6">
                                <OptionGroup label="Nền tảng">
                                    <OptionButton selected={platform === 'tiktok'} onClick={() => setPlatform('tiktok')}>TikTok</OptionButton>
                                    <OptionButton selected={platform === 'facebook'} onClick={() => setPlatform('facebook')}>Facebook</OptionButton>
                                </OptionGroup>
                                <OptionGroup label="Loại Nội dung">
                                    <OptionButton selected={generationMode === 'product'} onClick={() => setGenerationMode('product')}>Sản phẩm cầm tay</OptionButton>
                                    <OptionButton selected={generationMode === 'fashion'} onClick={() => setGenerationMode('fashion')}>Trang phục</OptionButton>
                                </OptionGroup>
                                <OptionGroup label="Tỷ lệ ảnh">
                                    <OptionButton selected={aspectRatio === '9:16'} onClick={() => setAspectRatio('9:16')}>9:16</OptionButton>
                                    <OptionButton selected={aspectRatio === '16:9'} onClick={() => setAspectRatio('16:9')}>16:9</OptionButton>
                                </OptionGroup>
                                <OptionGroup label="Số lượng kết quả">
                                    <select
                                        value={numberOfResults}
                                        onChange={(e) => setNumberOfResults(Number(e.target.value))}
                                        className="bg-slate-700 text-slate-200 border-b-4 border-slate-800 rounded-lg px-6 py-3 text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    >
                                        {[...Array(5)].map((_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}
                                    </select>
                                </OptionGroup>
                            </div>

                            <div className="flex flex-col gap-6 w-full max-w-4xl mx-auto">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="flex flex-col">
                                        <label htmlFor="outfit-suggestion" className="block text-sm font-medium text-slate-400 mb-2">Gợi ý trang phục (không bắt buộc)</label>
                                        <input
                                            type="text"
                                            id="outfit-suggestion"
                                            value={outfitSuggestion}
                                            onChange={(e) => setOutfitSuggestion(e.target.value)}
                                            disabled={generationMode === 'fashion'}
                                            placeholder={generationMode === 'fashion' ? 'AI sẽ tự động phối đồ' : 'VD: váy maxi đi biển...'}
                                            className="w-full bg-slate-900/70 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
                                        />
                                    </div>
                                    <div className="flex flex-col">
                                        <label htmlFor="background-suggestion" className="block text-sm font-medium text-slate-400 mb-2">Gợi ý bối cảnh (không bắt buộc)</label>
                                        <input
                                            type="text"
                                            id="background-suggestion"
                                            value={backgroundSuggestion}
                                            onChange={(e) => setBackgroundSuggestion(e.target.value)}
                                            placeholder="VD: quán cafe sân vườn, bãi biển hoàng hôn..."
                                            className="w-full bg-slate-900/70 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="flex flex-col">
                                        <label htmlFor="product-info" className="block text-sm font-medium text-slate-400 mb-2">Thông tin sản phẩm (để tạo lời thoại)</label>
                                        <textarea
                                            id="product-info"
                                            value={productInfo}
                                            onChange={(e) => setProductInfo(e.target.value)}
                                            placeholder={generationMode === 'fashion' ? 'Ví dụ: Áo sơ mi lụa, chống nhăn...' : 'Ví dụ: Son môi siêu lì, giữ màu 8 tiếng...'}
                                            rows={4}
                                            className="w-full bg-slate-900/70 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>
                                    <div className="flex flex-col">
                                        <label htmlFor="product-suggestion" className="block text-sm font-medium text-slate-400 mb-2">Gợi ý về video (không bắt buộc)</label>
                                        <textarea
                                            id="product-suggestion"
                                            value={productSuggestion}
                                            onChange={(e) => setProductSuggestion(e.target.value)}
                                            placeholder="Ví dụ: hợp với giới trẻ, nhấn mạnh chống nước..."
                                            rows={4}
                                            className="w-full bg-slate-900/70 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-4xl mx-auto">
                                <ImageUploader title="1. Tải ảnh khuôn mặt" onImageUpload={setModelImage} />
                                <ImageUploader title={generationMode === 'product' ? "2. Tải ảnh sản phẩm" : "2. Tải ảnh trang phục"} onImageUpload={setProductImage} />
                            </div>

                            <div className="flex justify-center">
                                <button
                                    onClick={handleGenerateContent}
                                    disabled={!modelImage || !productImage || isLoading}
                                    className="w-full md:w-auto flex items-center justify-center gap-3 px-8 py-3 bg-blue-600 text-white font-bold rounded-lg shadow-lg border-b-4 border-blue-800 hover:bg-blue-700 disabled:bg-slate-600 disabled:cursor-not-allowed transform active:translate-y-1"
                                >
                                    {isLoading ? <Loader2 className="w-5 h-5 animate-spin"/> : <WandIcon />}
                                    <span className="text-lg">{isLoading ? `Đang tạo ${numberOfResults} kết quả...` : 'Tạo Nội dung'}</span>
                                </button>
                            </div>
                        </>
                    )}
                    
                    {isLoading && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {Array.from({ length: numberOfResults }).map((_, index) => (
                                <div key={index} className="bg-slate-800/50 border border-slate-700 rounded-xl p-4"><SkeletonLoader /></div>
                            ))}
                        </div>
                    )}

                    {!isLoading && generatedData && generatedData.length > 0 && (
                        <div className="w-full max-w-7xl mx-auto mt-12 space-y-8">
                             {generatedData.map((data, index) => (
                                <div key={data.id} className="bg-gray-900/50 p-6 rounded-xl shadow-lg border border-gray-800">
                                    <h2 className="text-2xl font-bold text-gray-200 mb-4 pb-2 border-b border-gray-700">Kết quả {index + 1}</h2>
                                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                                        <div className="lg:col-span-1">
                                            <h3 className="text-xl font-semibold text-gray-300 mb-3">Ảnh quảng cáo</h3>
                                            <img src={data.imageUrl} alt={`Generated content ${index + 1}`} className="w-full object-contain rounded-lg shadow-lg"/>
                                        </div>
                                        <div className="lg:col-span-2">
                                            <AffiliateScriptDisplay
                                                scriptData={data.scriptData}
                                                setScriptData={(newScriptData) => setScriptDataForIndex(index, newScriptData)}
                                                withApiKeyRotation={withApiKeyRotation}
                                                setError={setError}
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                    
                    {error && (
                        <div className="mt-4 w-full max-w-3xl mx-auto p-4 bg-red-900/50 border border-red-500 text-red-300 rounded-lg text-center" dangerouslySetInnerHTML={{ __html: error }} />
                    )}
                </main>
            </div>
        </div>
    );
};

export default AffiliatePage;