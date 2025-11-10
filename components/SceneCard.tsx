import React from 'react';
import type { Scene } from '../types';
import { Trash2, RefreshCw, Loader2 } from 'lucide-react';

interface SceneCardProps {
    scene: Scene;
    sceneNumber: number;
    onDelete: (id: string) => void;
    onRegenerate: (id: string) => void;
    isRegenerating: boolean;
    onUpdate: (id: string, field: keyof Omit<Scene, 'id'>, value: string) => void;
}

const EditableField: React.FC<{ label: string; value: string; onChange: (newValue: string) => void; rows?: number }> = ({ label, value, onChange, rows = 6 }) => {
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
    );
};


const SceneCard: React.FC<SceneCardProps> = ({ scene, sceneNumber, onDelete, onRegenerate, isRegenerating, onUpdate }) => {

    const handleUpdate = (field: keyof Omit<Scene, 'id'>, value: string) => {
        onUpdate(scene.id, field, value);
    };
    
    return (
        <div className="bg-green-950/70 p-4 rounded-lg border border-green-700 relative transition-all duration-300">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-yellow-400">Cảnh {sceneNumber}</h3>
                <div className="flex items-center space-x-2">
                    <button 
                        onClick={() => onRegenerate(scene.id)}
                        disabled={isRegenerating}
                        className="p-2 rounded-full text-slate-400 hover:bg-green-700 hover:text-yellow-400 disabled:opacity-50 disabled:cursor-wait transition"
                        title="Tạo lại cảnh này"
                    >
                        {isRegenerating ? <Loader2 className="h-5 w-5 animate-spin" /> : <RefreshCw className="h-5 w-5" />}
                    </button>
                     <button 
                        onClick={() => onDelete(scene.id)}
                        disabled={isRegenerating}
                        className="p-2 rounded-full text-slate-400 hover:bg-green-700 hover:text-rose-500 disabled:opacity-50 transition"
                        title="Xóa cảnh này"
                    >
                        <Trash2 className="h-5 w-5" />
                    </button>
                </div>
            </div>
            
            <div className="space-y-4">
                 <EditableField 
                    label="Gợi ý góc máy"
                    value={scene.cameraSuggestion}
                    onChange={(value) => handleUpdate('cameraSuggestion', value)}
                    rows={1}
                />
                <EditableField 
                    label="Kịch bản gốc (Tiếng Anh)"
                    value={scene.englishPrompt}
                    onChange={(value) => handleUpdate('englishPrompt', value)}
                />
                 <EditableField 
                    label="Kịch bản dịch (Tiếng Việt)"
                    value={scene.vietnameseTranslation}
                    onChange={(value) => handleUpdate('vietnameseTranslation', value)}
                />
            </div>
        </div>
    );
};

export default SceneCard;
