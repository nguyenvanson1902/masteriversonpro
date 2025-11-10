import React from 'react';
import type { CharacterBible, Settings } from '../types';

interface CharacterBibleDisplayProps {
    bible: CharacterBible;
    setBible: React.Dispatch<React.SetStateAction<CharacterBible | null>>;
    settings: Settings;
}

const EditableField: React.FC<{ label: string; value: string; onChange: (newValue: string) => void; rows?: number }> = ({ label, value, onChange, rows = 8 }) => {
    return (
        <div>
            <label className="block text-sm font-bold text-green-300 mb-1">{label}</label>
            <textarea
                value={value}
                onChange={(e) => onChange(e.target.value)}
                rows={rows}
                className="w-full bg-green-950 border border-green-600 rounded-md p-3 text-sm leading-relaxed focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 transition text-slate-200"
            />
        </div>
    )
}

const CharacterBibleDisplay: React.FC<CharacterBibleDisplayProps> = ({ bible, setBible }) => {

    const handleEnglishChange = (newValue: string) => {
        setBible(prev => prev ? { ...prev, englishPrompt: newValue } : null);
    };

    const handleVietnameseChange = (newValue: string) => {
        setBible(prev => prev ? { ...prev, vietnamesePrompt: newValue } : null);
    };

    return (
        <div className="bg-green-800/50 p-6 rounded-lg shadow-lg border border-green-700">
            <h2 className="text-xl font-bold mb-4 text-yellow-400 border-b border-green-700 pb-2">2. Hồ Sơ Nhân Vật</h2>
            <div className="space-y-4">
                <EditableField
                    label="Kịch bản gốc (Tiếng Anh)"
                    value={bible.englishPrompt}
                    onChange={handleEnglishChange}
                />
                 <EditableField
                    label="Kịch bản dịch (Tiếng Việt)"
                    value={bible.vietnamesePrompt}
                    onChange={handleVietnameseChange}
                />
            </div>
        </div>
    );
};

export default CharacterBibleDisplay;
