import { GoogleGenAI, Type, Modality } from "@google/genai";
import { NEGATIVE_PROMPT, PACING_OPTIONS } from '../constants';
import { isInvalidApiKeyError, isRateLimitError } from '../utils';
import type { Settings, CharacterBible, Scene, DirectorScriptData } from '../types';


if (!process.env.API_KEY) {
  console.warn("Initial API_KEY environment variable is not set. The app will rely on user-provided keys.");
}

const getAiClient = (apiKey: string) => new GoogleGenAI({ apiKey });

// --- API Key Validation ---
export async function validateApiKey(apiKey: string): Promise<'ready' | 'invalid' | 'error' | 'exhausted'> {
    try {
        const ai = getAiClient(apiKey);
        await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: 'hello' });
        return 'ready';
    } catch (err) {
        if (isInvalidApiKeyError(err)) {
            return 'invalid';
        }
        if (isRateLimitError(err)) {
            return 'exhausted';
        }
        console.error(`API Key validation error: ${err}`);
        return 'error';
    }
}

// --- Storyteller Functions ---
export async function generateStorytellerScript(apiKey: string, promptTemplate: string, idea: string, characterCount: number, language: string): Promise<string> {
    const ai = getAiClient(apiKey);
    const model = 'gemini-2.5-pro';
    const filledPrompt = promptTemplate.replace('{characterCount}', characterCount.toString());
    const fullPrompt = `${filledPrompt}\n\nHere is the idea: "${idea}".\n\nPlease write the script in ${language === 'vi' ? 'Vietnamese' : 'English'}.`;

    const response = await ai.models.generateContent({
        model: model,
        contents: fullPrompt,
    });

    return response.text;
}

export async function generateSpeech(apiKey: string, textToSpeak: string, voice: string): Promise<string> {
    const ai = getAiClient(apiKey);
    const model = 'gemini-2.5-flash-preview-tts';

    const response = await ai.models.generateContent({
        model,
        contents: [{ parts: [{ text: textToSpeak }] }],
        config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
                voiceConfig: {
                    prebuiltVoiceConfig: { voiceName: voice },
                },
            },
        },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) {
        throw new Error("No audio data returned from API.");
    }
    return base64Audio;
}


// --- Director & Affiliate Script Functions ---

const PRODUCTION_PLAN_SCHEMA = {
    type: Type.OBJECT,
    properties: {
        title: { type: Type.STRING, description: "Creative and catchy title for the video." },
        logline: { type: Type.STRING, description: "A one or two-sentence summary of the story." },
        style_preset_name: { type: Type.STRING, description: "A comma-separated string of the names of the main visual style presets used." },
        style_description: { type: Type.STRING, description: "A detailed paragraph describing the overall visual style, mood, and aesthetic, blending the selected styles." },
        style_keywords: { type: Type.STRING, description: 'A comma-separated string of master keywords that define the visual style. Omit this field entirely if the style is "Cinematic".' },
        character_profiles: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    name: { type: Type.STRING },
                    description: { type: Type.STRING, description: "Detailed description of the character's appearance, clothing, accessories, height, weight, personality, and role. This should be based on any provided reference images." },
                    sound_cues: { type: Type.STRING, description: "Specific sound cues for the character (e.g., 'low growl when tense, happy chirp')." },
                },
                required: ["name", "description"],
            },
        },
        prop_profiles: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    name: { type: Type.STRING },
                    description: { type: Type.STRING, description: "Detailed description of the prop's or entity's appearance and function." },
                    sound_cues: { type: Type.STRING, description: "Specific sound cues for the prop (e.g., 'quiet servo whir, cheerful beep')." },
                },
                required: ["name", "description"],
            },
        },
        setting_description: { type: Type.STRING, description: "A detailed description of the main setting, atmosphere, time of day, etc. This should be based on any provided reference images." },
        setting_profiles: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    name: { type: Type.STRING, description: "Name of a specific, recurring location." },
                    description: { type: Type.STRING, description: "Detailed description of this specific location." },
                },
                required: ["name", "description"],
            },
            description: "Profiles for specific, recurring locations within the main setting.",
        },
        color_palette: {
            type: Type.ARRAY,
            items: { type: Type.STRING, description: 'A hex color code string (e.g., "#FFFFFF").' },
        },
        sound_design: { type: Type.STRING, description: "A detailed paragraph describing the overall sound design, including music mood and key ambient sounds." },
    },
    required: ["title", "logline", "style_preset_name", "style_description", "character_profiles", "setting_description", "color_palette", "sound_design"],
};

const SCENE_SCHEMA = {
    type: Type.OBJECT,
    properties: {
        scene_number: { type: Type.INTEGER },
        video_prompt: { type: Type.STRING, description: 'The master prompt for the video generation AI. The format depends on the style. For "Cinematic" or "Film Noir", it must be a specific markdown structure. For others, it is a detailed paragraph. It MUST also contain any dialogue for the scene.' },
        duration_seconds: { type: Type.INTEGER, description: "Duration of the scene in seconds, MUST be an integer between 4 and 8." },
        aspect_ratio: { type: Type.STRING },
        style: { type: Type.STRING, description: 'A comma-separated string of specific style keywords for this scene. For "Cinematic" or "Film Noir", this field should just contain the style name.' },
        emotional_pacing: { type: Type.STRING, description: `The emotional rhythm of the scene. Must be one of: ${PACING_OPTIONS.map(p => `"${p.value}"`).join(', ')}.` },
        camera_movement: {
            type: Type.OBJECT,
            properties: {
                type: { type: Type.STRING },
                speed: { type: Type.STRING, description: 'e.g., "slow", "fast", "normal"' },
                description: { type: Type.STRING, description: "Detailed, cinematic description of the camera movement." },
            },
            required: ["type", "speed", "description"],
        },
        sound_design: {
            type: Type.OBJECT,
            properties: {
                elements: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            type: { type: Type.STRING, description: "e.g., 'Music', 'SFX', 'Ambience'" },
                            description: { type: Type.STRING },
                        },
                        required: ["type", "description"],
                    },
                },
            },
            required: ["elements"],
        },
    },
    required: ["scene_number", "video_prompt", "duration_seconds", "aspect_ratio", "style", "emotional_pacing", "camera_movement", "sound_design"],
};

export async function generateFullScript(apiKey: string, options: any, onStatusUpdate: (status: string) => void): Promise<DirectorScriptData> {
    const ai = getAiClient(apiKey);
    const model = 'gemini-2.5-pro';

    onStatusUpdate('planning');

    // ** FIX: Separate images from text options to prevent token limit errors **
    const imageParts: any[] = [];
    const textOptions = JSON.parse(JSON.stringify(options)); // Deep copy to avoid mutation

    (textOptions.characters || []).forEach((char: any) => {
        if (char.images) {
            char.images.forEach((img: any) => imageParts.push({ inlineData: { data: img.base64, mimeType: img.mimeType } }));
            delete char.images; // Remove images from the object that will be stringified
        }
    });
    (textOptions.props || []).forEach((prop: any) => {
        if (prop.images) {
            prop.images.forEach((img: any) => imageParts.push({ inlineData: { data: img.base64, mimeType: img.mimeType } }));
            delete prop.images;
        }
    });
    if (textOptions.settingImages) {
        textOptions.settingImages.forEach((img: any) => imageParts.push({ inlineData: { data: img.base64, mimeType: img.mimeType } }));
        delete textOptions.settingImages;
    }
    
    const planPrompt = `Create a detailed production plan for a short video based on the following inputs. Reference images for characters, props, and setting may be provided. Use them to inform your descriptions.
    Inputs: ${JSON.stringify(textOptions)}
    Respond with a single JSON object for the production plan. The object must strictly follow this schema: ${JSON.stringify(PRODUCTION_PLAN_SCHEMA.properties)}`;

    const planRequestParts = [{ text: planPrompt }, ...imageParts];

    const planResponse = await ai.models.generateContent({
        model,
        contents: { parts: planRequestParts },
        config: {
            responseMimeType: 'application/json',
            responseSchema: PRODUCTION_PLAN_SCHEMA,
        }
    });
    const productionPlan = JSON.parse(planResponse.text);

    onStatusUpdate('scening');
    const scenesPrompt = `Based on the following production plan, create a series of ${options.sceneCount} video scenes.
    Production Plan: ${JSON.stringify(productionPlan)}
    Respond with a JSON array of scene objects. Each object in the array must strictly follow this schema: ${JSON.stringify(SCENE_SCHEMA.properties)}`;
    
    const scenesResponse = await ai.models.generateContent({
        model,
        contents: scenesPrompt,
        config: {
            responseMimeType: 'application/json',
            responseSchema: {
                type: Type.ARRAY,
                items: SCENE_SCHEMA,
            },
        }
    });
    const scenes = JSON.parse(scenesResponse.text);

    return { production_plan: productionPlan, scenes: scenes };
}

export async function elaborateScene(apiKey: string, productionPlan: any, sceneToElaborate: any): Promise<any[]> {
    const ai = getAiClient(apiKey);
    const model = 'gemini-2.5-pro'; 
    const prompt = `Given the production plan and a specific scene, elaborate and expand this single scene into 2 to 3 more detailed, consecutive scenes.
    Production Plan: ${JSON.stringify(productionPlan)}
    Scene to Elaborate: ${JSON.stringify(sceneToElaborate)}
    Respond with a JSON array of new scene objects. Each object must strictly follow this schema: ${JSON.stringify(SCENE_SCHEMA.properties)}.
    The new scenes should naturally follow each other and replace the original single scene. Maintain consistency with the production plan.`;

    const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
            responseMimeType: 'application/json',
            responseSchema: {
                type: Type.ARRAY,
                items: SCENE_SCHEMA,
            }
        }
    });

    return JSON.parse(response.text);
}

export async function translatePrompt(apiKey: string, promptToTranslate: string): Promise<string> {
    const ai = getAiClient(apiKey);
    const model = 'gemini-2.5-flash';
    const prompt = `Translate the following English video prompt to Vietnamese. Provide only the translation, without any additional text or explanations.
    Prompt: "${promptToTranslate}"`;
    
    const response = await ai.models.generateContent({
        model,
        contents: prompt,
    });

    return response.text.trim();
}

export async function updateScenePromptWithPacing(apiKey: string, productionPlan: any, scene: any, newPacing: string): Promise<any> {
    const ai = getAiClient(apiKey);
    const model = 'gemini-2.5-pro';
    const pacingLabel = PACING_OPTIONS.find(p => p.value === newPacing)?.label || newPacing;
    const prompt = `Rewrite the video_prompt for the following scene to reflect a new emotional pacing: "${pacingLabel}".
    Adjust the description, action, and camera directions to match the new pacing, but keep the core event of the scene the same.
    Production Plan for context: ${JSON.stringify(productionPlan)}
    Original Scene: ${JSON.stringify(scene)}
    New Pacing: ${newPacing} (${pacingLabel})
    Respond with only the updated JSON object for the scene. The object must strictly follow this schema: ${JSON.stringify(SCENE_SCHEMA.properties)}`;

    const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
            responseMimeType: 'application/json',
            responseSchema: SCENE_SCHEMA,
        }
    });
    return JSON.parse(response.text);
}


// --- Director Chat/Brainstorm Functions ---
// FIX: Add missing generateTrendingIdea function
export async function generateTrendingIdea(apiKey: string): Promise<{ idea: string, context: string, characters: string }> {
    const ai = getAiClient(apiKey);
    const model = 'gemini-2.5-flash';
    const prompt = `Generate a single, random, trending, and viral video idea suitable for social media like YouTube Shorts or TikTok.
Provide a concise idea, context, and main character description.
Respond with only a single JSON object with the following keys: "idea", "context", "characters".
Example: {"idea": "A Corgi tries to 'help' its owner with gardening, causing a cute and funny mess.", "context": "A bright, sunny backyard garden.", "characters": "A clumsy but lovable Corgi and its amused owner."}`;

    const schema = {
        type: Type.OBJECT,
        properties: {
            idea: { type: Type.STRING },
            context: { type: Type.STRING },
            characters: { type: Type.STRING },
        },
        required: ["idea", "context", "characters"]
    };

    const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
            responseMimeType: 'application/json',
            responseSchema: schema,
        }
    });

    return JSON.parse(response.text);
}

export async function getBrainstormResponse(apiKey: string, history: {role: string, content: string}[], newUserInput: string): Promise<string> {
    const ai = getAiClient(apiKey);
    const model = 'gemini-2.5-pro';
    const contents = history.map(h => ({ role: h.role, parts: [{ text: h.content }] }));
    contents.push({ role: 'user', parts: [{ text: newUserInput }] });

    const response = await ai.models.generateContent({
        model,
        contents: contents,
        config: {
            systemInstruction: 'You are a creative assistant for video ideas. Brainstorm 3-5 interesting and trendy video ideas based on the user\'s topic. Present them clearly. For each idea, start with a bolded title like **Idea 1:**. After the ideas, ask the user which one they like best or if they want more suggestions.'
        }
    });

    return response.text;
}

export async function getChatResponseForSummary(apiKey: string, idea: string, sceneCount: number, history: any[], newUserInput: string): Promise<string> {
    const ai = getAiClient(apiKey);
    const model = 'gemini-2.5-pro';
    const contents = history.map(h => ({ role: h.role, parts: [{ text: h.content }] }));
    contents.push({ role: 'user', parts: [{ text: newUserInput }] });

    const response = await ai.models.generateContent({
        model,
        contents: contents,
        config: {
            systemInstruction: `You are a scriptwriting assistant. Your goal is to help the user refine their initial video idea into a technical summary script with ${sceneCount} scenes.
            The user's core idea is: "${idea}".
            Based on the user's instructions, either generate a new summary script or refine the existing one.
            The final output should be a clear, concise summary script, with each scene on a new line, starting with "Scene X:".`
        }
    });

    return response.text;
}


export async function analyzeCharacterImages(apiKey: string, images: { base64: string, mimeType: string }[]): Promise<string> {
    const ai = getAiClient(apiKey);
    const model = 'gemini-2.5-flash';
    const imageParts = images.map(img => ({ inlineData: { data: img.base64, mimeType: img.mimeType } }));
    const prompt = "Analyze the provided image(s) of a character. Describe their appearance, clothing, accessories, and any notable features in a detailed, single paragraph. This description will be used to maintain consistency in an AI video generator. Focus only on visual details.";

    const response = await ai.models.generateContent({
        model,
        contents: { parts: [{ text: prompt }, ...imageParts] }
    });

    return response.text;
}

export async function analyzePropImages(apiKey: string, images: { base64: string, mimeType: string }[]): Promise<string> {
    const ai = getAiClient(apiKey);
    const model = 'gemini-2.5-flash';
    const imageParts = images.map(img => ({ inlineData: { data: img.base64, mimeType: img.mimeType } }));
    const prompt = "Analyze the provided image(s) of a prop or object. Describe its appearance, material, color, and function in a detailed, single paragraph. This description will be used to maintain consistency in an AI video generator. Focus only on visual details.";

    const response = await ai.models.generateContent({
        model,
        contents: { parts: [{ text: prompt }, ...imageParts] }
    });

    return response.text;
}


export async function generateVideoFromScene(apiKey: string, scene: any, aspectRatio: string): Promise<any> {
    const ai = getAiClient(apiKey);
    const model = 'veo-3.1-fast-generate-preview';
    
    // Check if API key selection is available and prompt user if not.
    if (window.aistudio && typeof window.aistudio.hasSelectedApiKey === 'function') {
        const hasKey = await window.aistudio.hasSelectedApiKey();
        if (!hasKey) {
            await window.aistudio.openSelectKey();
        }
    }

    const operation = await ai.models.generateVideos({
        model,
        prompt: scene.video_prompt,
        config: {
            numberOfVideos: 1,
            resolution: '720p',
            aspectRatio: aspectRatio === '1:1' ? '16:9' : aspectRatio, // Veo doesn't support 1:1, fallback to 16:9
        }
    });
    return operation;
}


export async function getVideosOperationStatus(apiKey: string, operation: any): Promise<any> {
    const ai = getAiClient(apiKey);
    return await ai.operations.getVideosOperation({ operation: operation });
}

export async function generateFullAffiliateScript(apiKey: string, options: any): Promise<{ generatedImageBase64: string, scriptData: any }> {
    const ai = getAiClient(apiKey);
    const imageGenModel = 'gemini-2.5-flash-image';
    const scriptGenModel = 'gemini-2.5-pro';

    // Step 1: Generate the image
    const imageGenPrompt = `Create a realistic image for a ${options.platform} video.
    - Aspect Ratio: ${options.aspectRatio}.
    - The scene should feature a person consistent with the reference face image provided.
    - If this is for a fashion post (${options.generationMode === 'fashion'}), the person should be wearing the outfit from the reference clothing image. The final image should be a full-body or half-body shot.
    - If this is for a product post (${options.generationMode === 'product'}), the person should be holding or interacting with the product from the reference product image. Their outfit should be: ${options.outfitSuggestion || 'stylish and appropriate for the product'}.
    - The background should be: ${options.backgroundSuggestion || 'a clean, aesthetically pleasing setting that complements the subject'}.
    - Product context: ${options.productInfo}.
    - Video suggestions: ${options.productSuggestion}.
    - The image should look like a high-quality, authentic social media post.`;

    // FIX: Explicitly type imageGenParts as any[] to allow for mixed content types (text and inlineData).
    const imageGenParts: any[] = [
        { text: imageGenPrompt },
        { inlineData: { mimeType: 'image/jpeg', data: options.modelImageBase64 } },
        { inlineData: { mimeType: 'image/jpeg', data: options.productImageBase64 } }
    ];

    const imageResponse = await ai.models.generateContent({
        model: imageGenModel,
        contents: { parts: imageGenParts },
        config: {
            responseModalities: [Modality.IMAGE],
        },
    });

    const generatedImageBase64 = imageResponse.candidates?.[0]?.content?.parts?.find(p => p.inlineData)?.inlineData?.data;
    if (!generatedImageBase64) {
        throw new Error("Image generation failed.");
    }
    
    // Step 2: Generate the script using the generated image as context
    const scriptGenOptions = {
        idea: options.productInfo || "An affiliate video about a product.",
        summaryScript: `Create a short, engaging script for a ${options.platform} video based on the generated image. The script should be suitable for a ${options.voice} voice with a ${options.region} accent.`,
        styles: [{ name: "Cinematic", description: "High-quality, social media style." }],
        dialogueLanguage: 'vietnamese',
        sceneCount: 3,
        aspectRatio: options.aspectRatio,
        characters: [{ name: "Presenter", description: "The person in the generated image." }],
        props: [{ name: "Product", description: options.productInfo }],
        masterSettingDescription: options.backgroundSuggestion || "The setting in the generated image.",
        includeMusic: true,
        outputLanguage: 'vietnamese',
        settingImages: [{ base64: generatedImageBase64, mimeType: 'image/jpeg' }]
    };

    const scriptData = await generateFullScript(apiKey, scriptGenOptions, () => {});

    return { generatedImageBase64, scriptData };
}

export async function generateSeoTitles(apiKey: string, topic: string): Promise<string[]> {
    const ai = getAiClient(apiKey);
    const model = 'gemini-2.5-flash';
    const prompt = `Generate 5 viral, SEO-optimized YouTube titles for a video about: "${topic}". The titles should be in Vietnamese. Return them as a JSON array of strings. Example: ["Title 1", "Title 2"]`;
    
    const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
            responseMimeType: 'application/json',
            responseSchema: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
            }
        }
    });

    return JSON.parse(response.text);
}

export async function generateSeoContent(apiKey: string, title: string): Promise<any> {
    const ai = getAiClient(apiKey);
    const model = 'gemini-2.5-pro';
    const prompt = `For the YouTube video titled "${title}", generate SEO content in Vietnamese. Provide:
    1. A detailed, engaging description.
    2. A list of relevant hashtags (without the #).
    3. A list of primary keywords.
    4. A list of secondary keywords.
    Return the result as a single JSON object.`;

    const schema = {
        type: Type.OBJECT,
        properties: {
            description: { type: Type.STRING },
            hashtags: { type: Type.ARRAY, items: { type: Type.STRING } },
            primaryKeywords: { type: Type.ARRAY, items: { type: Type.STRING } },
            secondaryKeywords: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: ["description", "hashtags", "primaryKeywords", "secondaryKeywords"]
    };

    const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
            responseMimeType: 'application/json',
            responseSchema: schema,
        }
    });

    return JSON.parse(response.text);
}

export async function generateThumbnail(apiKey: string, options: any): Promise<string[]> {
    const ai = getAiClient(apiKey);
    const model = 'gemini-2.5-flash-image';
    
    let textPrompt = `Create ${options.imageCount} professional, eye-catching thumbnail(s) for a ${options.platform} video.
    - Main text to include: "${options.textPrompt}". This text ${options.showText ? 'MUST' : 'MUST NOT'} be visibly present on the thumbnail.
    - Creative suggestions: ${options.creativeSuggestion || 'None'}.
    - Style should be vibrant, high-contrast, and designed to maximize click-through rate.
    - If reference images are provided, use them as inspiration for the style, characters, or objects in the thumbnail.
    - Mode: ${options.generationMode}. 'Accurate' means stick closely to the text prompts. 'Creative' allows for more artistic interpretation.`;

    const requestParts: any[] = [{ text: textPrompt }];
    if (options.base64Images && options.base64Images.length > 0) {
        options.base64Images.forEach((img: { data: string, mimeType: string }) => {
            requestParts.push({ inlineData: { data: img.data, mimeType: img.mimeType } });
        });
    }

    const allGeneratedImages: string[] = [];

    // The model generates one image at a time, so we loop if needed
    for (let i = 0; i < options.imageCount; i++) {
        const response = await ai.models.generateContent({
            model,
            contents: { parts: requestParts },
            config: {
                responseModalities: [Modality.IMAGE],
            },
        });
        const generatedImageBase64 = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData)?.inlineData?.data;
        if (generatedImageBase64) {
            allGeneratedImages.push(generatedImageBase64);
        }
    }

    if (allGeneratedImages.length === 0) {
        throw new Error("Image generation failed to produce any images.");
    }
    
    return allGeneratedImages;
}

// --- NEW: Functions for PromptToolPage ---

export async function generateBiblesAndOutline(apiKey: string, scriptContent: string, duration: number, imagePayload: { base64: string, mimeType: string } | null): Promise<string> {
    const ai = getAiClient(apiKey);
    const model = 'gemini-2.5-pro';
    
    const prompt = `Based on the provided script content and optional reference image, create a detailed "bible" and a scene outline for a video with a total duration of approximately ${duration} seconds.

    The output should be structured as follows:
    
    [CHARACTER BIBLE]
    - (Detailed description of the main character, their appearance, personality, and key traits. If a reference image is provided, base the description heavily on it to ensure visual consistency.)
    
    [ENVIRONMENT BIBLE]
    - (Detailed description of the setting, mood, time of day, and overall atmosphere.)
    
    [SCENE OUTLINE]
    - Scene 1: (A brief, one-sentence description of the main action in this scene.)
    - Scene 2: (A brief, one-sentence description of the main action in this scene.)
    - (Continue for the appropriate number of scenes for the duration.)
    
    Script Content:
    "${scriptContent}"
    `;
    
    // FIX: Explicitly type requestParts as any[] to allow for mixed content types (text and inlineData).
    const requestParts: any[] = [{ text: prompt }];
    if (imagePayload) {
        requestParts.push({ inlineData: { data: imagePayload.base64, mimeType: imagePayload.mimeType } });
    }

    const response = await ai.models.generateContent({
        model,
        contents: { parts: requestParts },
    });

    return response.text;
}

export async function generateScenesList(apiKey: string, biblesAndOutline: string, startScene: number, endScene: number): Promise<string> {
    const ai = getAiClient(apiKey);
    const model = 'gemini-2.5-pro';

    const prompt = `Using the provided bibles and outline, generate a detailed scene list from scene ${startScene} to ${endScene}. For each scene, describe the actions, camera shots, and any dialogue in detail.

    Bibles and Outline:
    ---
    ${biblesAndOutline}
    ---
    
    Generate the detailed list for scenes ${startScene} to ${endScene} now.
    `;

    const response = await ai.models.generateContent({
        model,
        contents: prompt,
    });
    
    return response.text;
}

const SCENE_JSON_SCHEMA = {
    type: Type.OBJECT,
    properties: {
        characters: { type: Type.STRING, description: "Description of characters present in this scene, consistent with the bible." },
        environment: { type: Type.STRING, description: "Description of the environment for this scene, consistent with the bible." },
        shots: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    duration: { type: Type.NUMBER, description: "Duration of the shot in seconds." },
                    prompt: { type: Type.STRING, description: "Detailed visual prompt for the AI video generator for this shot." },
                    style: { type: Type.STRING },
                    camera: { type: Type.STRING, description: "Description of camera movement or angle." },
                    transition: { type: Type.STRING, description: "Transition to the next shot, if any." },
                    dialogue: { type: Type.STRING },
                    audio: { type: Type.STRING, description: "Description of sound effects or music." },
                },
                required: ["duration", "prompt", "style", "camera"],
            },
        },
    },
    required: ["shots"],
};


export async function generateJsonPrompts(apiKey: string, biblesAndOutline: string, scenesList: string, startScene: number, endScene: number): Promise<string> {
    const ai = getAiClient(apiKey);
    const model = 'gemini-2.5-pro';

    const prompt = `Based on the comprehensive context provided (bibles, outline, and detailed scene list), generate a JSON object for each scene from ${startScene} to ${endScene}.
    Each JSON object must strictly adhere to the provided schema. The 'prompt' within each shot should be incredibly detailed, referencing the character and environment bibles to ensure consistency.

    Full Context:
    ---
    ${biblesAndOutline}
    ---
    ${scenesList}
    ---

    Now, generate a JSON array containing the objects for scenes ${startScene} to ${endScene}.
    `;

    const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
            responseMimeType: 'application/json',
            responseSchema: {
                type: Type.ARRAY,
                items: SCENE_JSON_SCHEMA,
            },
        }
    });

    const scenesArray = JSON.parse(response.text);
    
    // Format the response as expected by the frontend
    const formattedString = scenesArray.map((scene: any) => JSON.stringify(scene, null, 2)).join('\n[PROMPT TIẾP THEO]\n');
    return `[BẮT ĐẦU PROMPT]\n${formattedString}\n[KẾT THÚC PROMPT]`;
}

// FIX: Add missing regenerateScene function
const REGENERATE_SCENE_SCHEMA = {
    type: Type.OBJECT,
    properties: {
        cameraSuggestion: { type: Type.STRING, description: "A creative and cinematic camera shot suggestion for the scene." },
        englishPrompt: { type: Type.STRING, description: "A detailed, new version of the video prompt in English, maintaining the core idea but changing the specifics." },
        vietnameseTranslation: { type: Type.STRING, description: "An accurate Vietnamese translation of the new englishPrompt." },
    },
    required: ["cameraSuggestion", "englishPrompt", "vietnameseTranslation"]
};

export async function regenerateScene(apiKey: string, settings: Settings, characterBible: CharacterBible, originalEnglishPrompt: string): Promise<Omit<Scene, 'id'>> {
    const ai = getAiClient(apiKey);
    const model = 'gemini-2.5-pro';

    const prompt = `You are a creative script assistant. Your task is to regenerate a single video scene.
    Maintain the core idea of the original prompt but provide a fresh, alternative execution.
    
    **Overall Video Context:**
    - Idea: ${settings.idea}
    - Style: ${settings.style}
    - Aspect Ratio: ${settings.aspectRatio}

    **Character Bible (for consistency):**
    ${characterBible.englishPrompt}
    
    **Original Scene Prompt to Regenerate:**
    "${originalEnglishPrompt}"
    
    Now, generate a new version of this scene. Respond with a single JSON object containing 'cameraSuggestion', 'englishPrompt', and 'vietnameseTranslation' for the new scene. The object must strictly follow this schema: ${JSON.stringify(REGENERATE_SCENE_SCHEMA.properties)}`;

    const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
            responseMimeType: 'application/json',
            responseSchema: REGENERATE_SCENE_SCHEMA
        }
    });

    return JSON.parse(response.text);
}