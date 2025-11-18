import React, { useState } from 'react';
import type { Scene, Settings, CharacterBible } from '../types';
import SceneCard from './SceneCard';
import { regenerateScene } from '../services/geminiService';

interface StoryboardDisplayProps {
    scenes: Scene[];
    setScenes: React.Dispatch<React.SetStateAction<Scene[]>>;
    settings: Settings;
    characterBible: CharacterBible | null;
    // FIX: Add withApiKeyRotation prop to handle authenticated API calls consistently.
    withApiKeyRotation: (apiCall: (apiKey: string) => Promise<any>) => Promise<any>;
}

const StoryboardDisplay: React.FC<StoryboardDisplayProps> = ({ scenes, setScenes, settings, characterBible, withApiKeyRotation }) => {
    const [regeneratingSceneId, setRegeneratingSceneId] = useState<string | null>(null);

    const handleDeleteScene = (id: string) => {
        setScenes(prevScenes => prevScenes.filter(scene => scene.id !== id));
    };
    
    const handleRegenerateScene = async (id: string) => {
        const sceneToRegen = scenes.find(s => s.id === id);
        if (!sceneToRegen || !characterBible) return;

        setRegeneratingSceneId(id);
        try {
            // FIX: Use the withApiKeyRotation function to make an authenticated call.
            const newSceneData = await withApiKeyRotation(apiKey => regenerateScene(apiKey, settings, characterBible, sceneToRegen.englishPrompt));
            setScenes(prevScenes => prevScenes.map(scene =>
                scene.id === id ? { ...newSceneData, id: scene.id } : scene
            ));
        } catch (error) {
            console.error("Không thể tạo lại cảnh:", error);
            alert("Rất tiếc, không thể tạo lại cảnh này. Vui lòng thử lại.");
        } finally {
            setRegeneratingSceneId(null);
        }
    };
    
    const updateScene = (id: string, field: keyof Omit<Scene, 'id'>, value: string) => {
        setScenes(prev => prev.map(scene => scene.id === id ? { ...scene, [field]: value } : scene));
    };

    return (
        <div className="bg-green-800/50 p-6 rounded-lg shadow-lg border border-green-700">
            <h2 className="text-xl font-bold mb-4 text-yellow-400 border-b border-green-700 pb-2">3. Kịch Bản Phân Cảnh (Storyboard)</h2>
            <div className="space-y-6">
                {scenes.map((scene, index) => (
                    <SceneCard
                        key={scene.id}
                        scene={scene}
                        sceneNumber={index + 1}
                        onDelete={handleDeleteScene}
                        onRegenerate={handleRegenerateScene}
                        isRegenerating={regeneratingSceneId === scene.id}
                        onUpdate={updateScene}
                    />
                ))}
            </div>
        </div>
    );
};

export default StoryboardDisplay;