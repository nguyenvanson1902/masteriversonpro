import React, { useState } from 'react';
import { BackIcon, WandIcon } from './Icons';
import { STYLES, PROMPT_TOOL_ASPECT_RATIOS, NEGATIVE_PROMPT } from '../constants';
import { ClipboardIcon as ClipboardIconLucide, CheckCircle as CheckCircleIconLucide } from 'lucide-react';

const PromptWizardPage: React.FC<{ onBack: () => void }> = ({ onBack }) => {
    const [formData, setFormData] = useState({
        context: '',
        character: '',
        action: '',
        details: '',
        selectedStyles: [] as string[],
        aspectRatio: '16:9',
    });
    const [generatedPrompt, setGeneratedPrompt] = useState('');
    const [copySuccess, setCopySuccess] = useState(false);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const toggleStyle = (styleName: string) => {
        setFormData(prev => {
            const newStyles = prev.selectedStyles.includes(styleName)
                ? prev.selectedStyles.filter(s => s !== styleName)
                : [...prev.selectedStyles, styleName];
            return { ...prev, selectedStyles: newStyles };
        });
    };
    
    const handleGenerate = () => {
        const { context, character, action, details, selectedStyles, aspectRatio } = formData;
        const parts = [];
        if (context.trim()) parts.push(context.trim());
        if (character.trim()) parts.push(character.trim());
        parts.push(action.trim());
        if (details.trim()) parts.push(details.trim());
        
        let prompt = parts.join(', ');

        if (selectedStyles.length > 0) {
            prompt += `, in the style of ${selectedStyles.join(' and ')}`;
        }

        prompt += `, aspect ratio ${aspectRatio}`;
        prompt += `. --no ${NEGATIVE_PROMPT}`;

        setGeneratedPrompt(prompt);
    };

    const handleReset = () => {
        setFormData({
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
    
    return (
        <div className="min-h-screen bg-blue-950 text-gray-100 p-4 sm:p-8 animate-fadeInUp">
            <header className="text-center mb-10 relative">
                <button onClick={onBack} className="absolute left-0 top-1/2 -translate-y-1/2 p-2 bg-blue-900 hover:bg-blue-800 rounded-full transition-colors" aria-label="Quay lại"><BackIcon className="w-6 h-6 text-gray-300" /></button>
                <h1 className="text-5xl mb-2 font-black text-aurora-glow-7-colors">RIVER SƠN MASTER</h1>
                <h1 className="text-xl sm:text-2xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-400 to-red-400 py-2">Trợ lý tạo Prompt Video</h1>
            </header>
            
            <div className="max-w-4xl mx-auto bg-blue-900/50 p-6 rounded-xl shadow-lg border border-blue-800">
                {generatedPrompt ? (
                    <div className="space-y-6 animate-fadeInUp text-center">
                         <h2 className="text-2xl font-bold text-gray-200">Prompt của bạn đã sẵn sàng!</h2>
                         <div className="bg-blue-950 p-4 rounded-md min-h-[150px] flex items-center justify-center">
                             <p className="text-gray-200 whitespace-pre-wrap select-all text-lg">{generatedPrompt}</p>
                         </div>
                         <div className="flex flex-col sm:flex-row gap-4">
                            <button onClick={handleReset} className="w-full py-3 bg-gray-600 hover:bg-gray-700 rounded-lg font-semibold">Tạo prompt mới</button>
                            <button onClick={handleCopy} className="w-full flex items-center justify-center gap-2 py-3 bg-green-600 hover:bg-green-700 rounded-lg font-semibold">{copySuccess ? <CheckCircleIconLucide className="w-5 h-5" /> : <ClipboardIconLucide className="w-5 h-5" />} {copySuccess ? 'Đã sao chép!' : 'Sao chép'}</button>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-6 animate-fadeInUp">
                        <h2 className="text-2xl font-bold text-gray-200">Xây dựng Prompt của bạn</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-6">
                                <div>
                                    <label htmlFor="context" className="block text-sm font-semibold mb-2">Bối cảnh / Không gian (tùy chọn)</label>
                                    <textarea id="context" name="context" value={formData.context} onChange={handleChange} rows={3} className="w-full p-2 bg-blue-800 border border-blue-700 rounded-md" placeholder="VD: một khu rừng vào ban đêm..."></textarea>
                                </div>
                                <div>
                                    <label htmlFor="character" className="block text-sm font-semibold mb-2">Nhân vật (tùy chọn)</label>
                                    <textarea id="character" name="character" value={formData.character} onChange={handleChange} rows={3} className="w-full p-2 bg-blue-800 border border-blue-700 rounded-md" placeholder="VD: một chiến binh mặc giáp..."></textarea>

                                </div>
                            </div>
                            <div className="space-y-6">
                                <div>
                                    <label htmlFor="action" className="block text-sm font-semibold mb-2">Hành động chính <span className="text-red-400">*</span></label>
                                    <textarea id="action" name="action" value={formData.action} onChange={handleChange} rows={3} className="w-full p-2 bg-blue-800 border border-blue-700 rounded-md" placeholder="VD: đang chiến đấu với một con rồng lửa..."></textarea>
                                </div>
                                <div>
                                    <label htmlFor="details" className="block text-sm font-semibold mb-2">Chi tiết bổ sung (tùy chọn)</label>
                                    <textarea id="details" name="details" value={formData.details} onChange={handleChange} rows={3} className="w-full p-2 bg-blue-800 border border-blue-700 rounded-md" placeholder="VD: tia lửa bay khắp nơi, hiệu ứng slow motion..."></textarea>
                                </div>
                            </div>
                        </div>
                        <div>
                            <h3 className="text-sm font-semibold text-gray-200 mb-2">Phong cách (tùy chọn)</h3>
                            <div className="flex flex-wrap gap-2">
                                {STYLES.map(style => (
                                    <button key={style} onClick={() => toggleStyle(style)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${formData.selectedStyles.includes(style) ? 'bg-lime-600 text-white' : 'bg-blue-800 text-gray-300'}`}>{style}</button>
                                ))}
                            </div>
                        </div>
                         <div>
                            <h3 className="text-sm font-semibold text-gray-200 mb-2">Tỷ lệ khung hình</h3>
                            <div className="flex gap-3">
                                {PROMPT_TOOL_ASPECT_RATIOS.map(ratio => (
                                    <button key={ratio} onClick={() => setFormData(p => ({...p, aspectRatio: ratio}))} className={`flex-grow py-2 rounded-lg font-semibold ${formData.aspectRatio === ratio ? 'bg-lime-600 text-white' : 'bg-blue-800 text-gray-300'}`}>{ratio}</button>
                                ))}
                            </div>
                        </div>
                        <button onClick={handleGenerate} disabled={!formData.action.trim()} className="w-full flex items-center justify-center gap-2 py-3 mt-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg font-semibold disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed"><WandIcon className="w-5 h-5"/> Tạo Prompt</button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PromptWizardPage;
