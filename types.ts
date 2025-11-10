// Types for Storyteller Tool
export type APIKeyStatus = {
    [key: string]: 'ready' | 'exhausted' | 'invalid' | 'error' | 'checking';
};

export interface StorytellerTopic {
    id: string;
    name: string;
    description: string;
    prompt: string;
}

export interface TTSVoice {
    label: string;
    value: string;
}

// Types for Director Tool
export interface StyleOption {
    name: string;
    description: string;
}

export interface PacingOption {
    value: string;
    label: string;
}

export interface LanguageOption {
    value: string;
    label: string;
}

export interface DirectorAspectRatio {
    name: string;
    label: string;
}

export interface ImageFile {
    name: string;
    base64: string;
}

export interface CharacterProfile {
    name: string;
    description: string;
    soundCues: string;
}

export interface PropProfile {
    name: string;
    description: string;
    soundCues: string;
}

export interface DirectorProductionPlan {
    title: string;
    logline: string;
    style_preset_name: string;
    characters?: { name: string; description: string }[];
}

export interface CameraMovement {
    type: string;
    speed: string;
    description: string;
}

export interface SoundDesignElement {
    type: string;
    description: string;
}

export interface SoundDesign {
    elements: SoundDesignElement[];
}

export interface DirectorScene {
    scene_number: number;
    duration_seconds: number;
    aspect_ratio: string;
    video_prompt: string;
    style: string;
    camera_movement: CameraMovement;
    sound_design: SoundDesign;
    emotional_pacing?: string;
    translatedPrompt?: string;
    isTranslating?: boolean;
    isElaborating?: boolean;
    isUpdatingPacing?: boolean;
    videoGenerationStatus?: 'idle' | 'generating' | 'polling' | 'done' | 'error';
    videoUrl?: string;
    videoOperation?: any;
    videoError?: string;
}

export interface DirectorScriptData {
    production_plan: DirectorProductionPlan;
    scenes: DirectorScene[];
}

export interface SavedProject {
    version: string;
    scriptData: DirectorScriptData;
}
export interface Settings {
    idea: string;
    context: string;
    characters: string;
    style: string;
    aspectRatio: string;
    numScenes: number;
}

export interface CharacterBible {
    englishPrompt: string;
    vietnamesePrompt: string;
}

export interface Scene {
    id: string;
    cameraSuggestion: string;
    englishPrompt: string;
    vietnameseTranslation: string;
}
