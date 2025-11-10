import { GoogleGenAI, Type, Modality } from "@google/genai";
import { NEGATIVE_PROMPT, PACING_OPTIONS } from '../constants';
import { isInvalidApiKeyError, isRateLimitError } from '../utils';


if (!process.env.API_KEY) {
  console.warn("Initial API_KEY environment variable is not set. The app will rely on user-provided keys.");
}

const getAiClient = (apiKey: string) => new GoogleGenAI({ apiKey });

// --- NEW/UPDATED SCHEMAS AND FUNCTIONS ---

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
                    description: { type: Type.STRING, description: "Detailed description of the character's appearance, clothing, accessories, height, weight, personality, and role." },
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
        setting_description: { type: Type.STRING, description: "A detailed description of the main setting, atmosphere, time of day, etc." },
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
        video_prompt: { type: Type.STRING, description: 'The master prompt for the video generation AI. The format depends on the style. For "Cinematic" or "Film Noir", it must be a specific markdown structure. For others, it is a detailed paragraph.' },
        duration_seconds: { type: Type.INTEGER, description: "Duration of the scene in seconds, MUST be an integer between 4 and 8." },
        aspect_ratio: { type: Type.STRING },
        style: { type: Type.STRING, description: 'A comma-separated string of specific style keywords for this scene. For "Cinematic" or "Film Noir", this field should just contain the style name.' },
        emotional_pacing: { type: Type.STRING, description: 'The emotional rhythm of the scene, e.g., "rising_tension", "action_peak".' },
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
                            type: { type: Type.STRING, description: '"sound effect", "music", "dialogue", or "ambience"' },
                            description: { type: Type.STRING, description: "Detailed description of the sound element." },
                        },
                        required: ["type", "description"],
                    },
                },
            },
            required: ["elements"],
        },
    },
    required: ["scene_number", "video_prompt", "duration_seconds", "aspect_ratio", "style", "camera_movement", "sound_design"],
};

const SCENE_ARRAY_SCHEMA = { type: Type.ARRAY, items: SCENE_SCHEMA };

const CHARACTER_PROFILE_SCHEMA = {
    type: Type.OBJECT,
    properties: {
        name: { type: Type.STRING, description: "A creative and fitting name for the character based on the description. The name should be unique and memorable." },
        description: { type: Type.STRING, description: "An expanded and more detailed description of the character's appearance, clothing, personality, and role, based on the user's input. This should be written in a professional, script-ready format in English." },
        sound_cues: { type: Type.STRING, description: "Suggest specific sound cues for the character in English (e.g., 'deep, gravelly voice', 'light, airy laugh', 'footsteps are heavy and slow')." },
    },
    required: ["name", "description", "sound_cues"],
};

const PROP_PROFILE_SCHEMA = {
    type: Type.OBJECT,
    properties: {
        name: { type: Type.STRING, description: "A creative and fitting name for the prop or entity based on the description. The name should be unique and memorable." },
        description: { type: Type.STRING, description: "An expanded and more detailed description of the prop's appearance, materials, function, and role, based on the user's input. This should be written in a professional, script-ready format in English." },
        sound_cues: { type: Type.STRING, description: "Suggest specific sound cues for the prop in English (e.g., 'soft, electronic whirring', 'heavy, metallic clank', 'a cheerful beep when activated')." },
    },
    required: ["name", "description", "sound_cues"],
};

export const validateApiKey = async (apiKey: string) => {
    if (!apiKey) return 'invalid';
    try {
        const ai = getAiClient(apiKey);
        await ai.models.generateContent({ model: "gemini-2.5-flash", contents: "say the word test" });
        return 'ready';
    } catch (error) {
        console.error("API Key validation failed:", error);
        if (isInvalidApiKeyError(error)) {
            return 'invalid';
        }
        if (isRateLimitError(error)) {
            return 'exhausted';
        }
        return 'error';
    }
};

const getMusicRule = (includeMusic: boolean) => {
    if (includeMusic) return "";
    return `
--- QUY TẮC TUYỆT ĐỐI VỀ ÂM NHẠC (KHÔNG THỂ THAY ĐỔI) ---
Người dùng đã TẮT âm nhạc. Đối với MỌI đối tượng cảnh bạn tạo trong đầu ra JSON, mảng 'sound_design.elements' KHÔNG ĐƯỢC chứa bất kỳ đối tượng nào có trường 'type' là 'music'. Bạn BỊ CẤM tạo ra bất kỳ mô tả, bản nhạc hoặc gợi ý âm nhạc nào. Chỉ tập trung vào hiệu ứng âm thanh, hội thoại và không khí.
    `;
};

export const generateCharacterProfileFromDescription = async (
    apiKey: string,
    userDescription: string
) => {
    const ai = getAiClient(apiKey);
    const prompt = `Bạn là một trợ lý kịch bản. Dựa trên mô tả sau của người dùng, hãy tạo một hồ sơ nhân vật chi tiết. Hồ sơ phải ở định dạng JSON và bao gồm 'name' sáng tạo, 'description' chi tiết và 'sound_cues' liên quan. Toàn bộ văn bản đầu ra phải bằng tiếng Anh.

    Mô tả người dùng: "${userDescription}"`;

    const result = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: CHARACTER_PROFILE_SCHEMA
        }
    });

    const jsonText = result.text.trim();
    if (!jsonText) {
        throw new Error("Received empty response from AI when generating character profile.");
    }
    return JSON.parse(jsonText);
};

export const generatePropProfileFromDescription = async (
    apiKey: string,
    userDescription: string
) => {
    const ai = getAiClient(apiKey);
    const prompt = `Bạn là một trợ lý kịch bản. Dựa trên mô tả sau của người dùng về một đạo cụ hoặc thực thể quan trọng, hãy tạo một hồ sơ chi tiết cho nó. Hồ sơ phải ở định dạng JSON và bao gồm 'name' sáng tạo, 'description' chi tiết và 'sound_cues' liên quan. Toàn bộ văn bản đầu ra phải bằng tiếng Anh.

    Mô tả người dùng: "${userDescription}"`;

    const result = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: PROP_PROFILE_SCHEMA
        }
    });

    const jsonText = result.text.trim();
    if (!jsonText) {
        throw new Error("Received empty response from AI when generating prop profile.");
    }
    return JSON.parse(jsonText);
};

export const generateSummaryFromIdea = async (
    apiKey: string,
    idea: string,
    sceneCount: number
) => {
    const ai = getAiClient(apiKey);
    const prompt = `Bạn là một trợ lý kịch bản. Nhiệm vụ của bạn là mở rộng một ý tưởng cốt lõi thành một kịch bản tóm tắt với một số lượng cảnh cụ thể.
    Người dùng muốn một kịch bản có ${sceneCount} cảnh.
    Ý tưởng cốt lõi là: "${idea}"

    Dựa vào đây, tạo một tóm tắt ngắn gọn cho mỗi cảnh. Đầu ra phải là một chuỗi văn bản thuần túy, với mỗi tóm tắt cảnh trên một dòng mới.
    Ví dụ:
    Cảnh 1: Một thám tử đến một hiện trường vụ án mưa gió.
    Cảnh 2: Anh ta tìm thấy một manh mối bí ẩn bên trong một chiếc mề đay.
    Cảnh 3: Manh mối dẫn anh ta đến một nhà kho cũ, bị bỏ hoang.
    ... và cứ thế.

    Không thêm bất kỳ tiêu đề, giới thiệu hoặc định dạng nào khác. Chỉ cần các tóm tắt cảnh.`;

    const result = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt
    });

    if (!result.text) {
        throw new Error("Received empty response from AI when generating summary.");
    }
    return result.text.trim();
};

export const getBrainstormResponse = async (
    apiKey: string,
    chatHistory: { role: string; content: string }[],
    userMessage: string
) => {
    const ai = getAiClient(apiKey);

    const systemInstruction = `Bạn là một trợ lý AI để brainstorm ý tưởng video. Mục tiêu của bạn là lấy một chủ đề hoặc từ khóa của người dùng và mở rộng nó thành một logline hấp dẫn hoặc một ý tưởng cốt lõi ngắn gọn cho một video. Giao tiếp một cách thân thiện, trò chuyện bằng tiếng Việt. Khi bạn đề xuất một ý tưởng cụ thể, vui lòng diễn đạt nó một cách rõ ràng và ngắn gọn, ví dụ: "Tuyệt vời! Vậy ý tưởng cho video là: [Ý tưởng của bạn ở đây]".`;

    const contents = [
        ...chatHistory.map(turn => ({
            role: turn.role,
            parts: [{ text: turn.content }],
        })),
        { role: 'user', parts: [{ text: userMessage }] }
    ];

    const result = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: contents,
        config: {
            systemInstruction: systemInstruction,
        }
    });

    if (!result.text) {
        throw new Error("Received empty response from AI during brainstorm chat.");
    }
    return result.text.trim();
};

export const getChatResponseForSummary = async (
    apiKey: string,
    idea: string,
    sceneCount: number,
    chatHistory: { role: string; content: string }[],
    userMessage: string
) => {
    const ai = getAiClient(apiKey);

    const systemInstruction = `Bạn là một "Trợ lý Kịch bản tóm tắt" cho một công cụ tạo video. Mục tiêu của bạn là giúp người dùng brainstorm và tạo ra một kịch bản tóm tắt kỹ thuật dựa trên ý tưởng cốt lõi của họ.
- Ý tưởng cốt lõi của người dùng là: "${idea}"
- Người dùng muốn một kịch bản có khoảng ${sceneCount} cảnh.
- Đầu ra cuối cùng của bạn phải là một bản tóm tắt theo từng cảnh, như "Cảnh 1: [mô tả]".
- Trò chuyện với người dùng để tinh chỉnh ý tưởng. Hỏi các câu hỏi làm rõ nếu cần.
- Khi bạn cung cấp kịch bản cuối cùng, hãy đảm bảo đó chỉ là văn bản thuần túy của các cảnh, không có bất kỳ cuộc trò chuyện hay định dạng thừa nào, để người dùng có thể dễ dàng sao chép nó.
- Phản hồi của bạn phải bằng tiếng Việt.`;

    const contents = [
        ...chatHistory.map(turn => ({
            role: turn.role,
            parts: [{ text: turn.content }],
        })),
        { role: 'user', parts: [{ text: userMessage }] }
    ];

    const result = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: contents,
        config: {
            systemInstruction: systemInstruction,
        }
    });

    if (!result.text) {
        throw new Error("Received empty response from AI during chat.");
    }
    return result.text.trim();
};

export const generateFullScript = async (
    apiKey: string,
    params: any,
    onProgress: (status: string) => void
) => {
    const ai = getAiClient(apiKey);
    
    // --- Step 1: Generate Production Plan ---
    const stylesInput = params.styles.map((s: any) => `- "${s.name}": ${s.description}`).join('\n');
    const productionPlanPrompt = `Bạn là một đạo diễn phim và nhà văn sáng tạo bậc thầy AI. Nhiệm vụ của bạn là tạo ra một "Kế hoạch sản xuất" toàn diện cho một video bằng cách kết hợp nhiều phong cách dựa trên ý tưởng sáng tạo của người dùng. Đầu ra phải là một đối tượng JSON hợp lệ duy nhất tuân thủ nghiêm ngặt schema được cung cấp.

DỮ LIỆU NGƯỜI DÙNG:
- Ý tưởng cốt lõi: "${params.idea}"
- Kịch bản tóm tắt (tùy chọn): "${params.summaryScript}"
- Các preset phong cách video để kết hợp:
${stylesInput}
- Hồ sơ nhân vật: ${JSON.stringify(params.characters.map((c: any) => ({ name: c.name, description: c.description, sound_cues: c.soundCues })))}
- Hồ sơ đạo cụ: ${JSON.stringify(params.props.map((p: any) => ({ name: p.name, description: p.description, sound_cues: p.soundCues })))}
- Mô tả bối cảnh chính: "${params.masterSettingDescription}"

NHIỆM VỤ CỦA BẠN:
Dựa trên TẤT CẢ các dữ liệu được cung cấp, hãy tạo ra JSON Kế hoạch Sản xuất.
- title: Tạo một tiêu đề hấp dẫn, sáng tạo.
- logline: Viết một tóm tắt câu chuyện hấp dẫn trong một câu.
- style_preset_name: Tạo một chuỗi các tên phong cách đã chọn, được phân tách bằng dấu phẩy: "${params.styles.map((s: any) => s.name).join(', ')}".
- style_description: Viết một đoạn văn phong phú, chi tiết mô tả thẩm mỹ hình ảnh, tâm trạng, ánh sáng và cảm giác tổng thể, kết hợp các đặc điểm của tất cả các phong cách đã chọn thành một tầm nhìn độc đáo, mạch lạc.
- style_keywords: Nếu sự kết hợp phong cách KHÔNG bao gồm "Cinematic", hãy tạo một chuỗi từ khóa phân tách bằng dấu phẩy cho phong cách hình ảnh (ví dụ: 'hoạt hình 3D, màu sắc rực rỡ, nhân vật thân thiện, ánh sáng dịu'). Nếu "Cinematic" LÀ một trong những phong cách, HÃY BỎ QUA trường này khỏi JSON.
- character_profiles: Sử dụng hồ sơ nhân vật được cung cấp. Nếu không có, hãy tạo chúng dựa trên ý tưởng. Đảm bảo mô tả chi tiết.
- prop_profiles: Sử dụng hồ sơ đạo cụ được cung cấp. Nếu không có, hãy tạo chúng nếu chúng là trung tâm của ý tưởng.
- setting_description: Sử dụng mô tả bối cảnh chính của người dùng, nhưng mở rộng nó với nhiều chi tiết cảm quan hơn, phản ánh phong cách kết hợp. Nếu không có, hãy tạo một cái.
- setting_profiles: Xác định các địa điểm cụ thể, lặp lại nếu câu chuyện ngụ ý chúng.
- color_palette: Đề xuất 5-7 mã màu hex phù hợp với phong cách kết hợp được mô tả.
- sound_design: Mô tả toàn cảnh âm thanh tổng thể, bao gồm phong cách âm nhạc và các âm thanh môi trường chính.`;

    let productionPlan;
    try {
        const planResult = await ai.models.generateContent({
            model: "gemini-2.5-pro",
            contents: productionPlanPrompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: PRODUCTION_PLAN_SCHEMA,
                temperature: 0.8,
            }
        });
        productionPlan = JSON.parse(planResult.text.trim());
    } catch (e) {
        console.error("Lỗi trong quá trình tạo Kế hoạch sản xuất:", e);
        if (e instanceof SyntaxError) {
            throw new Error("Lỗi phân tích cú pháp Kế hoạch sản xuất. AI có thể đã trả về định dạng không hợp lệ.");
        }
        throw e; // Re-throw other errors (like API errors) to be handled by the caller
    }

    // Call progress callback
    onProgress('scening');

    // --- Step 2: Generate Scenes ---
    const scenesPrompt = `Bạn là một nhà biên kịch và đạo diễn cảnh quay bậc thầy AI. Nhiệm vụ của bạn là tạo ra một mảng các đối tượng cảnh cho một video, dựa trên một "Kế hoạch sản xuất" và một kịch bản tóm tắt. Đầu ra phải là một mảng JSON hợp lệ duy nhất của các đối tượng cảnh, tuân thủ nghiêm ngặt schema được cung cấp.

BỐI CẢNH:
- Kế hoạch sản xuất: ${JSON.stringify(productionPlan)}
- Kịch bản tóm tắt: "${params.summaryScript}"
- Số lượng cảnh mong muốn: ${params.sceneCount}
- Tỷ lệ khung hình: "${params.aspectRatio}"
- Ngôn ngữ đầu ra cho prompt: ${params.outputLanguage}
${getMusicRule(params.includeMusic)}

NHIỆM VỤ CỦA BẠN:
Tạo chính xác ${params.sceneCount} đối tượng cảnh.
- QUY TẮC QUAN TRỌNG VỀ TÍNH NHẤT QUÁN CỦA NHÂN VẬT: Khi viết 'video_prompt', nếu một nhân vật từ 'character_profiles' trong Kế hoạch Sản xuất xuất hiện, bạn PHẢI sử dụng mô tả chính xác của họ để đảm bảo ngoại hình của họ nhất quán trong tất cả các cảnh. Ví dụ, nếu nhân vật 'ZARA' được mô tả là 'một thợ máy cyberpunk với tóc hồng và một cánh tay robot', thì mọi prompt có ZARA đều phải đề cập đến những đặc điểm này. Điều này là rất quan trọng.
- Sử dụng kịch bản tóm tắt làm hướng dẫn chính cho hành động trong mỗi cảnh. Nếu không có kịch bản tóm tắt, hãy sử dụng logline từ Kế hoạch sản xuất để tạo ra một chuỗi cảnh logic.
- scene_number: Đánh số tuần tự bắt đầu từ 1.
- video_prompt: Đây là prompt CHÍNH cho AI tạo video.
    - Nếu các phong cách đã chọn bao gồm "Cinematic" hoặc "Film Noir", prompt PHẢI tuân theo định dạng markdown cụ thể này, kết hợp các yếu tố từ các phong cách khác vào mô tả:
    \`\`\`markdown
    **Shot:** [Mô tả chi tiết về cảnh quay, góc máy và hành động của nhân vật.]
    **Style:** [Danh sách các từ khóa phong cách phản ánh phong cách kết hợp, ví dụ: Cinematic, thẩm mỹ Anime, ánh sáng kịch tính, độ tương phản cao.]
    **Setting:** [Mô tả môi trường ngay lập tức.]
    **Color:** [Các màu chính cho cảnh quay.]
    **Lighting:** [Mô tả ánh sáng chi tiết.]
    **Sound:** [Các yếu tố âm thanh chính cho cảnh quay.]
    **Composition:** [Mô tả khung hình và bố cục, ví dụ: quy tắc một phần ba, đường dẫn.]
    \`\`\`
    - Đối với tất cả các kết hợp phong cách khác, hãy viết một đoạn văn mô tả phong phú, duy nhất bao gồm các chi tiết về hành động, phong cách kết hợp, bối cảnh, màu sắc và ánh sáng.
    - TẤT CẢ các prompt video PHẢI được viết bằng ${params.outputLanguage}.
    - Nối thêm NEGATIVE_PROMPT: "${NEGATIVE_PROMPT}" vào cuối MỌI video_prompt.
- duration_seconds: Phải là một số nguyên từ 4 đến 8. Thay đổi thời lượng để tạo ra nhịp điệu tốt.
- aspect_ratio: Sử dụng giá trị chính xác: "${params.aspectRatio}".
- style: Cung cấp một danh sách các từ khóa liên quan được phân tách bằng dấu phẩy từ kế hoạch sản xuất áp dụng cho cảnh.
- emotional_pacing: Chọn một nhịp điệu phù hợp từ danh sách này: [${PACING_OPTIONS.map(p => p.value).join(', ')}].
- camera_movement: Mô tả một chuyển động máy quay phù hợp cho mỗi cảnh.
- sound_design: Chi tiết hóa các âm thanh cụ thể cho mỗi cảnh, tôn trọng quy tắc về âm nhạc.`;

    try {
        const scenesResult = await ai.models.generateContent({
            model: "gemini-2.5-pro",
            contents: scenesPrompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: SCENE_ARRAY_SCHEMA,
                temperature: 1.0,
            }
        });
        const scenes = JSON.parse(scenesResult.text.trim());
        return { production_plan: productionPlan, scenes };
    } catch (e) {
        console.error("Lỗi trong quá trình tạo Phân cảnh:", e);
        if (e instanceof SyntaxError) {
            throw new Error("Lỗi phân tích cú pháp Phân cảnh. Kế hoạch sản xuất đã được tạo, nhưng bước tạo cảnh thất bại do định dạng không hợp lệ.");
        }
        throw e; // Re-throw other errors
    }
};


export const translatePrompt = async (apiKey: string, prompt: string) => {
    const ai = getAiClient(apiKey);
    const result = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: `Dịch văn bản tiếng Anh sau sang tiếng Việt:\n\n"${prompt}"`
    });
    return result.text.trim();
};

export const analyzeCharacterImages = async (apiKey: string, images: any[]) => {
    const ai = getAiClient(apiKey);
    const parts: any[] = [{ text: "Phân tích các hình ảnh nhân vật sau. Cung cấp một mô tả chi tiết, mạch lạc về ngoại hình, quần áo, các đặc điểm chính và phong cách tổng thể của nhân vật. Mô tả phải phù hợp cho một hồ sơ nhân vật trong kịch bản. Viết bằng TIẾNG ANH." }];
    images.forEach(img => {
        parts.push({
            inlineData: {
                data: img.base64,
                mimeType: img.file.type,
            }
        });
    });

    const result = await ai.models.generateContent({ model: "gemini-2.5-flash-image", contents: { parts } });
    return result.text.trim();
};

export const analyzePropImages = async (apiKey: string, images: any[]) => {
    const ai = getAiClient(apiKey);
    const parts: any[] = [{ text: "Phân tích các hình ảnh sau của một đạo cụ hoặc thực thể. Cung cấp một mô tả chi tiết, mạch lạc về ngoại hình, vật liệu, các đặc điểm chính và chức năng của nó. Mô tả phải phù hợp cho một hồ sơ đạo cụ trong kịch bản. Viết bằng TIẾNG ANH." }];
    images.forEach(img => {
        parts.push({
            inlineData: {
                data: img.base64,
                mimeType: img.file.type,
            }
        });
    });

    const result = await ai.models.generateContent({ model: "gemini-2.5-flash-image", contents: { parts } });
    return result.text.trim();
}

export const analyzeSettingImages = async (apiKey: string, images: any[]) => {
    const ai = getAiClient(apiKey);
    const parts: any[] = [{ text: "Phân tích các hình ảnh sau của một bối cảnh. Cung cấp một mô tả chi tiết, mạch lạc về không khí, các yếu tố chính, kiến trúc, ánh sáng, thời gian trong ngày và tâm trạng tổng thể của địa điểm. Mô tả phải phù hợp cho một mô tả bối cảnh chính trong kịch bản. Viết bằng TIẾNG ANH." }];
    images.forEach(img => {
        parts.push({
            inlineData: {
                data: img.base64,
                mimeType: img.file.type,
            }
        });
    });

    const result = await ai.models.generateContent({ model: "gemini-2.5-flash-image", contents: { parts } });
    return result.text.trim();
}

export const elaborateAllScenes = async (apiKey: string, productionPlan: any, originalScenes: any[]) => {
    const ai = getAiClient(apiKey);
    const prompt = `Bạn là một biên tập kịch bản bậc thầy AI. Nhiệm vụ của bạn là lấy một kịch bản video hoàn chỉnh (kế hoạch sản xuất và danh sách các cảnh) và chi tiết hóa nó để làm cho nó trở nên điện ảnh và chi tiết hơn. Bạn nên tăng tổng số cảnh lên khoảng 50-75% bằng cách chia nhỏ các cảnh hiện có và thêm các cảnh quay kết nối hoặc phản ứng mới. Đầu ra phải là một mảng JSON hợp lệ của danh sách các đối tượng cảnh mới, hoàn chỉnh, tuân thủ nghiêm ngặt schema được cung cấp.

--- BỐI CẢNH ---
- Kế hoạch sản xuất: ${JSON.stringify(productionPlan)}
- Mảng cảnh gốc: ${JSON.stringify(originalScenes)}

--- NHIỆM VỤ CỦA BẠN ---
1.  Xem xét toàn bộ vòng cung câu chuyện từ các cảnh gốc.
2.  Mở rộng kịch bản một cách thông minh. Điều này có nghĩa là:
    - Chia nhỏ các cảnh dài thành nhiều cảnh quay tập trung hơn.
    - Thêm các cảnh chuyển tiếp ngắn (ví dụ: cảnh thiết lập, phản ứng của nhân vật).
    - Tăng cường các khoảnh khắc quan trọng với các chuỗi hành động chi tiết hơn.
3.  Viết một mảng mới, hoàn chỉnh của các đối tượng cảnh cho toàn bộ kịch bản đã được chi tiết hóa.
4.  QUY TẮC TÍNH NHẤT QUÁN CỦA NHÂN VẬT: Khi viết 'video_prompt' cho mỗi cảnh mới, nếu một nhân vật từ 'character_profiles' xuất hiện, bạn PHẢI sử dụng mô tả chính xác từ Kế hoạch Sản xuất để đảm bảo ngoại hình của họ nhất quán.
5.  Đảm bảo một luồng logic và hấp dẫn trong suốt kịch bản mới.
6.  Gán số cảnh giữ chỗ (ví dụ: 1, 2, 3...) vì chúng sẽ được ứng dụng đánh số lại.
7.  Chỉ trả về mảng JSON của danh sách các cảnh mới, hoàn chỉnh. Không bọc nó trong bất kỳ đối tượng nào khác.`;

    const result = await ai.models.generateContent({
        model: "gemini-2.5-pro",
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: SCENE_ARRAY_SCHEMA
        }
    });
    const jsonText = result.text.trim();
    if (!jsonText) {
        throw new Error("Received empty response from AI when elaborating all scenes.");
    }
    return JSON.parse(jsonText);
};


export const elaborateScene = async (apiKey: string, productionPlan: any, sceneToElaborate: any) => {
    const ai = getAiClient(apiKey);
    const prompt = `Bạn là một biên tập kịch bản bậc thầy AI. Nhiệm vụ của bạn là lấy một cảnh cấp cao duy nhất và chi tiết hóa nó thành một chuỗi từ 2 đến 3 cảnh liên tiếp, chi tiết hơn. Chuỗi mới này nên chia nhỏ hành động từ cảnh gốc thành các khoảnh khắc nhỏ hơn, chi tiết hơn. Đầu ra phải là một mảng JSON hợp lệ của các đối tượng cảnh mới, tuân thủ nghiêm ngặt schema được cung cấp.

--- BỐI CẢNH ---
- Kế hoạch sản xuất: ${JSON.stringify(productionPlan)}
- Cảnh gốc cần chi tiết hóa: ${JSON.stringify(sceneToElaborate)}

--- NHIỆM VỤ CỦA BẠN ---
1.  Phân tích hành động và ý định của cảnh gốc.
2.  Tái cấu trúc nó thành một chuỗi logic của 2-3 cảnh mới.
3.  Đối với mỗi cảnh mới, tạo một đối tượng cảnh hoàn chỉnh với 'video_prompt' chi tiết và tất cả các trường bắt buộc khác.
4.  QUY TẮC TÍNH NHẤT QUÁN CỦA NHÂN VẬT: Khi viết 'video_prompt' cho các cảnh mới này, nếu một nhân vật từ 'character_profiles' xuất hiện, bạn PHẢI sử dụng mô tả chính xác từ Kế hoạch Sản xuất để đảm bảo ngoại hình của họ nhất quán.
5.  Đảm bảo các cảnh mới chảy một cách logic và cùng nhau đại diện cho nội dung của cảnh gốc, nhưng với nhiều chi tiết và sắc thái hơn.
6.  Duy trì phong cách và tông màu tổng thể được xác định trong Kế hoạch sản xuất.
7.  Gán số cảnh giữ chỗ (ví dụ: -1, -2, -3), vì chúng sẽ được ứng dụng đánh số lại.
8.  Chỉ trả về mảng JSON của các đối tượng cảnh mới. Không bọc nó trong bất kỳ đối tượng nào khác.`;

    const result = await ai.models.generateContent({
        model: "gemini-2.5-pro",
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: SCENE_ARRAY_SCHEMA
        }
    });
    const jsonText = result.text.trim();
    if (!jsonText) {
        throw new Error("Received empty response from AI when elaborating scene.");
    }
    return JSON.parse(jsonText);
};


export const updateScenePromptWithPacing = async (apiKey: string, productionPlan: any, scene: any, newPacingValue: string) => {
    const ai = getAiClient(apiKey);
    const newPacingLabel = PACING_OPTIONS.find(p => p.value === newPacingValue)?.label || newPacingValue;
    const prompt = `Bạn là một nhà biên kịch bậc thầy AI. Nhiệm vụ của bạn là sửa đổi prompt video của một cảnh duy nhất để phản ánh một nhịp điệu cảm xúc mới, trong khi giữ nguyên tất cả dữ liệu cảnh khác. Đầu ra phải là một đối tượng JSON hợp lệ duy nhất cho cảnh đã cập nhật, tuân thủ nghiêm ngặt schema được cung cấp.

--- BỐI CẢNH ---
- Kế hoạch sản xuất: ${JSON.stringify(productionPlan)}
- Đối tượng cảnh gốc: ${JSON.stringify(scene)}
- Nhịp điệu cảm xúc mới: "${newPacingLabel} (${newPacingValue})" - Điều này nên hướng dẫn tông màu của prompt được sửa đổi.

--- NHIỆM VỤ CỦA BẠN ---
1.  Phân tích 'video_prompt' gốc.
2.  Viết lại 'video_prompt' để truyền tải mạnh mẽ nhịp điệu cảm xúc mới của "${newPacingLabel}". QUAN TRỌNG: Nếu có bất kỳ nhân vật nào từ Kế hoạch Sản xuất được đề cập, hãy đảm bảo mô tả của họ trong prompt mới vẫn nhất quán với hồ sơ của họ.
3.  Giữ NGUYÊN tất cả các trường khác của đối tượng cảnh (scene_number, duration_seconds, v.v.) trừ khi một thay đổi là hoàn toàn cần thiết để phù hợp với nhịp điệu mới.
4.  Cập nhật trường 'emotional_pacing' thành "${newPacingValue}".
5.  Chỉ trả về đối tượng JSON hoàn chỉnh, đã cập nhật cho cảnh duy nhất. Không bọc nó trong bất kỳ đối tượng nào khác.`;

    const result = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: SCENE_SCHEMA
        }
    });
    const jsonText = result.text.trim();
    if (!jsonText) {
        throw new Error("Received empty response from AI when updating pacing.");
    }
    return JSON.parse(jsonText);
};

export const generateSummaryFromPrompts = async (apiKey: string, script: any) => {
    const ai = getAiClient(apiKey);
    const prompt = `
        Bạn là một trợ lý kịch bản. Bạn sẽ được cung cấp một loạt các prompt video, được phân tách bằng '---'. 
        Đối với mỗi prompt, bạn phải tóm tắt hành động và nội dung chính thành một câu tiếng Việt ngắn gọn, súc tích.
        Đầu ra cuối cùng của bạn PHẢI tuân theo định dạng chính xác này, với mỗi bản tóm tắt trên một dòng mới. KHÔNG thêm bất kỳ văn bản, giới thiệu hoặc định dạng markdown nào khác.

        Định dạng:
        Cảnh 1: [Tóm tắt tiếng Việt của bạn cho cảnh 1]
        Cảnh 2: [Tóm tắt tiếng Việt của bạn cho cảnh 2]
        Cảnh 3: [Tóm tắt tiếng Việt của bạn cho cảnh 3]
        ...và cứ thế cho tất cả các cảnh được cung cấp.

        Đây là các prompt:
        ---
        ${script.scenes.map((s: any) => `Cảnh ${s.scene_number}:\n${s.video_prompt}`).join("\n\n---\n\n")}
        ---
    `;
    const result = await ai.models.generateContent({ model: "gemini-2.5-flash", contents: prompt });
    if (!result.text) {
        throw new Error("Phản hồi tóm tắt từ AI trống.");
    }
    return result.text.trim();
};

export const generateStorytellerScript = async (apiKey: string, topicPrompt: string, idea: string, charCount: number, language: string) => {
    const ai = getAiClient(apiKey);
    let fullPrompt = (language === 'en' ? `--- LANGUAGE RULE (ABSOLUTE) ---\nThe ENTIRE output script MUST be written in professional, high-quality ENGLISH.\n\n` : `--- QUY TẮC NGÔN NGỮ (TUYỆT ĐỐI) ---\nToàn bộ kịch bản đầu ra PHẢI được viết bằng TIẾNG VIỆT chuyên nghiệp, chất lượng cao.\n\n`) + topicPrompt.replace('{characterCount}', charCount.toString());
    fullPrompt += `\n\nThis is the specific idea: "${idea}"`;
    fullPrompt += `\n\nQUAN TRỌNG: Đảm bảo kịch bản trả về CHỈ chứa văn bản sạch để lồng tiếng. Xóa tất cả các tiêu đề, ghi chú hoặc bất cứ thứ gì không phải là nội dung chính của kịch bản.`;

    const result = await ai.models.generateContent({ model: "gemini-2.5-flash", contents: fullPrompt });
    if (!result.text) {
        throw new Error("Phản hồi tạo kịch bản từ AI trống.");
    }
    return result.text.trim();
};

export const generateSpeech = async (apiKey: string, text: string, voice: string, style: string, temperature: number) => {
    const ai = new GoogleGenAI({ apiKey });
    const prompt = `Hãy đọc ${style}: "${text}"`;

    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: prompt }] }],
        config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
                voiceConfig: {
                    prebuiltVoiceConfig: { voiceName: voice },
                },
            },
            temperature: temperature
        },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) {
        throw new Error("Không nhận được dữ liệu âm thanh từ API.");
    }
    return base64Audio;
};

export const generateVideoFromScene = async (apiKey: string, scene: any, aspectRatio: string) => {
    const ai = new GoogleGenAI({ apiKey });
    let operation = await ai.models.generateVideos({
        model: 'veo-3.1-fast-generate-preview',
        prompt: scene.video_prompt,
        config: {
            numberOfVideos: 1,
            resolution: '720p',
            aspectRatio: aspectRatio,
        }
    });
    return operation;
};

export const getVideosOperationStatus = async (apiKey: string, operation: any) => {
    const ai = new GoogleGenAI({ apiKey });
    const updatedOperation = await ai.operations.getVideosOperation({ operation: operation });
    return updatedOperation;
};

export const generatePromptIdea = async (apiKey: string) => {
    const ai = getAiClient(apiKey);
    const schema = {
        type: Type.OBJECT,
        properties: {
            context: { type: Type.STRING, description: "Bối cảnh hoặc không gian của video, bằng tiếng Việt." },
            character: { type: Type.STRING, description: "Nhân vật chính của video, bằng tiếng Việt." },
            action: { type: Type.STRING, description: "Hành động chính hoặc cốt lõi của video, bằng tiếng Việt." },
            details: { type: Type.STRING, description: "Các chi tiết bổ sung, thú vị để làm video hấp dẫn hơn, bằng tiếng Việt." }
        },
        required: ["context", "character", "action", "details"]
    };

    const prompt = `Bạn là một chuyên gia sáng tạo nội dung cho trẻ em. Hãy tạo ra một ý tưởng video ngắn theo xu hướng (trending) cho YouTube Shorts hoặc TikTok, chủ đề thiếu nhi. Ý tưởng cần phải vui nhộn, giàu trí tưởng tượng và hấp dẫn. Cung cấp chi tiết cho các mục sau bằng tiếng Việt.`;

    const result = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: schema,
            temperature: 1.0
        }
    });

    const jsonText = result.text.trim();
    if (!jsonText) {
        throw new Error("Received empty response from AI when generating prompt idea.");
    }
    return JSON.parse(jsonText);
};

export const generateTrendingIdea = async () => {
    const ai = getAiClient(process.env.API_KEY as string);
    const prompt = "Generate a single, short, trending video idea for a YouTube Short or TikTok. Provide a core idea, context/setting, and main characters. Respond in JSON format.";

    const result = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    idea: { type: Type.STRING, description: "A short, catchy, and trending video idea." },
                    context: { type: Type.STRING, description: "A brief description of the setting or context for the idea." },
                    characters: { type: Type.STRING, description: "A brief description of the main character(s)." },
                },
                required: ["idea", "context", "characters"],
            }
        }
    });
    const jsonText = result.text.trim();
    if (!jsonText) {
        throw new Error("Received empty response from AI when generating trending idea.");
    }
    return JSON.parse(jsonText);
};

export const regenerateScene = async (settings: any, characterBible: any, englishPrompt: string) => {
    const ai = getAiClient(process.env.API_KEY as string);

    const schema = {
        type: Type.OBJECT,
        properties: {
            cameraSuggestion: { type: Type.STRING, description: "A creative camera angle or movement suggestion for the scene." },
            vietnameseTranslation: { type: Type.STRING, description: "A professional Vietnamese translation of the new English prompt." },
            englishPrompt: { type: Type.STRING, description: "A slightly rewritten or improved version of the original English prompt, keeping the core idea." }
        },
        required: ["cameraSuggestion", "vietnameseTranslation", "englishPrompt"],
    };

    const generationPrompt = `
    Given the following scene context, regenerate the scene details.
    
    Original English Prompt to improve: "${englishPrompt}"
    
    Overall Video Settings:
    - Style: ${settings.style}
    - Core Idea: ${settings.idea}
    - Main Characters: ${settings.characters}
    
    Character Bible (if available):
    ${characterBible ? JSON.stringify(characterBible) : 'Not provided.'}

    Your task is to:
    1. Slightly rewrite and improve the original English prompt to make it more vivid and descriptive.
    2. Provide a creative camera suggestion for the new prompt.
    3. Provide a professional Vietnamese translation of the *new* English prompt.

    Respond in the required JSON format.
    `;

    const result = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: generationPrompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: schema
        }
    });

    const jsonText = result.text.trim();
    if (!jsonText) {
        throw new Error("Received empty response from AI when regenerating scene.");
    }
    return JSON.parse(jsonText);
};

export const generateSeoTitles = async (apiKey: string, shortTitle: string) => {
    const ai = getAiClient(apiKey);
    const schema = {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        maxItems: 5,
        minItems: 5,
    };
    const prompt = `Bạn là một chuyên gia SEO YouTube. Với một ý tưởng video ngắn gọn sau đây, hãy tạo ra 5 tiêu đề hấp dẫn, chuẩn SEO, và có khả năng thu hút lượt xem cao. Trả về kết quả dưới dạng một mảng JSON chứa 5 chuỗi.
    
    Ý tưởng video: "${shortTitle}"`;
    
    const result = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: schema,
            temperature: 0.8
        }
    });

    const jsonText = result.text.trim();
    if (!jsonText) {
        throw new Error("Không nhận được phản hồi khi tạo tiêu đề SEO.");
    }
    return JSON.parse(jsonText);
};

export const generateSeoContent = async (apiKey: string, selectedTitle: string) => {
    const ai = getAiClient(apiKey);
    const schema = {
        type: Type.OBJECT,
        properties: {
            description: { type: Type.STRING, description: "Một đoạn mô tả video chi tiết, dài khoảng 3-4 đoạn văn, chuẩn SEO, chứa các từ khóa chính và phụ một cách tự nhiên, và có lời kêu gọi hành động." },
            hashtags: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Một danh sách khoảng 5-7 hashtag YouTube phù hợp nhất." },
            primaryKeywords: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Một danh sách 5-8 từ khóa chính quan trọng nhất." },
            secondaryKeywords: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Một danh sách 10-15 từ khóa phụ, từ khóa dài liên quan." }
        },
        required: ["description", "hashtags", "primaryKeywords", "secondaryKeywords"]
    };
    const prompt = `Bạn là một chuyên gia SEO YouTube hàng đầu. Với tiêu đề video cuối cùng sau đây, hãy tạo một gói SEO hoàn chỉnh bằng tiếng Việt.
    
    Tiêu đề video: "${selectedTitle}"

    Gói SEO phải bao gồm:
    1.  **description**: Một mô tả video chi tiết, hấp dẫn, chuẩn SEO.
    2.  **hashtags**: Một danh sách các hashtag phù hợp.
    3.  **primaryKeywords**: Một danh sách các từ khóa chính.
    4.  **secondaryKeywords**: Một danh sách các từ khóa phụ liên quan.

    Trả về kết quả dưới dạng một đối tượng JSON duy nhất.`;

    const result = await ai.models.generateContent({
        model: "gemini-2.5-pro",
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: schema,
            temperature: 0.7
        }
    });
    
    const jsonText = result.text.trim();
    if (!jsonText) {
        throw new Error("Không nhận được phản hồi khi tạo nội dung SEO.");
    }
    return JSON.parse(jsonText);
};

export const generateThumbnail = async (
    apiKey: string,
    params: any
) => {
    const ai = getAiClient(apiKey);
    const { platform, textPrompt, creativeSuggestion, imageCount, showText, base64Images } = params;

    let fullPrompt;
    const parts: any[] = [];

    // Add uploaded images if they exist, which changes the prompt to be an editing task
    if (base64Images.length > 0) {
        fullPrompt = `You are a professional graphic designer specializing in thumbnails. Your task is to edit the provided image(s) to create a thumbnail for a ${platform} video.

--- ABSOLUTE REQUIREMENT: TEXT ACCURACY ---
The text, if requested, MUST be rendered EXACTLY as provided, with no spelling errors. The language of the text is Vietnamese.

--- EDITING INSTRUCTIONS ---
1. Use the uploaded image(s) as the base. You can combine them, use one as a background, or feature a subject from one.
2. ${showText ? `Add this EXACT Vietnamese text in a bold, easy-to-read, and stylish font: "${textPrompt}". The spelling must be perfect.` : "Do not add any text."}
3. Adjust colors, lighting, and composition to make the thumbnail eye-catching and professional.
4. ${creativeSuggestion ? `Follow these specific creative directions: "${creativeSuggestion}"` : ''}
5. The final result must be a single, polished thumbnail image. If text was added, it must be spelled correctly: "${textPrompt}".
        `;

        base64Images.forEach((img: any) => {
            parts.push({
                inlineData: {
                    data: img.data,
                    mimeType: img.mimeType,
                }
            });
        });
    } else {
        // This is a text-to-image task
        fullPrompt = `Create a professional, eye-catching, and high-click-through-rate thumbnail for a ${platform} video.

--- ABSOLUTE REQUIREMENT: TEXT ACCURACY ---
If text is requested, it MUST be rendered EXACTLY as provided, with no spelling errors. The language of the text is Vietnamese.

--- Main Text to Display ---
${showText ? `The thumbnail MUST prominently feature this EXACT Vietnamese text: "${textPrompt}". The text must be large, readable, stylish, and spelled correctly.` : "The thumbnail should NOT contain any text."}

--- Creative Direction ---
Theme/Concept: Create a visually compelling image based on the theme: "${textPrompt}".
Style: Modern, vibrant, high-contrast, professional graphic design.
${creativeSuggestion ? `Specific user instructions: "${creativeSuggestion}"` : ''}

--- Rules ---
- The image must be extremely high quality.
- The composition must be clear and focus on the main subject.
- The text "${textPrompt}" must be spelled perfectly. Do not add, remove, or change any characters or accents.
- The text must be legible, even at small sizes.
        `;
    }

    parts.push({ text: fullPrompt });

    const promises = [];
    
    for (let i = 0; i < imageCount; i++) {
        const config: any = {
            responseModalities: [Modality.IMAGE],
            temperature: 0.85,
        };
        if (imageCount > 1) {
            config.seed = Math.floor(Math.random() * 1000000);
        }

        const promise = ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: { parts },
            config,
        }).then(response => {
            const part = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
            if (part?.inlineData?.data) {
                return part.inlineData.data;
            } else {
                console.warn(`Image generation failed for iteration ${i + 1}. Response:`, response);
                return null;
            }
        });
        promises.push(promise);
    }
    
    const results = await Promise.all(promises);
    const successfulImages = results.filter((img) => img !== null);
    
    if(successfulImages.length === 0) {
        throw new Error("AI did not return any images. Please try refining your prompt or checking the API key quota.");
    }

    return successfulImages;
};

// Functions from index.html that are needed for CharacterConsistencyPromptPage
export const generateBiblesAndOutline = async (apiKey: string, content: string, duration: number) => {
    const ai = getAiClient(apiKey);
    const prompt = `Hãy tạo Character Bible, Environment Bible, và Video Outline cho kịch bản sau:
• Nội dung: ${content}
• Thời lượng: ${duration} giây
Quy tắc bắt buộc:
• Nhân vật chính phải được mô tả chi tiết (tên, độ tuổi, ngoại hình, trang phục, đặc điểm cố định).
• Toàn bộ đặc điểm nhân vật phải đồng nhất xuyên suốt video.
• Bối cảnh phải bám sát kịch bản, có mô tả chi tiết ánh sáng, thời tiết, cảm xúc không khí.
• Outline phải có mở đầu, cao trào và kết thúc rõ ràng.
Quy tắc Output:
• Chỉ trả về một chuỗi văn bản duy nhất với các thẻ sau:
o [BẮT ĐẦU PROMPT] → bắt đầu
o [PROMPT TIẾP THEO] → phân tách
o [KẾT THÚC PROMPT] → kết thúc
Cấu trúc xuất:
[BẮT ĐẦU PROMPT]
"Character Bible: ..."
[PROMPT TIẾP THEO]
"Environment Bible: ..."
[PROMPT TIẾP THEO]
"Video Outline: ..."
[KẾT THÚC PROMPT]
`;
    const result = await ai.models.generateContent({ model: "gemini-2.5-pro", contents: prompt });
    if (!result.text) throw new Error("AI response was empty for Bibles and Outline.");
    return result.text.trim();
};

export const generateScenesList = async (apiKey: string, biblesAndOutline: string, startShot: number, endShot: number) => {
    const ai = getAiClient(apiKey);
    const prompt = `Dựa trên Character Bible, Environment Bible, và Video Outline đã cho, hãy viết Scenes list từ ${startShot} → ${endShot}.

Bibles và Outline:
---
${biblesAndOutline}
---

Quy tắc bắt buộc:
• Nhân vật chính phải xuất hiện ở tất cả các cảnh.
• Nhân vật phụ (nếu có) phải giữ nguyên đặc điểm từ Character Bible.
• Có ít nhất 1 cảnh đặc tả cận mặt, thể hiện rõ cảm xúc.
• Cảnh phải bám sát timeline trong Video Outline.
• Mỗi scene phải ghi rõ: bối cảnh + hành động + camera + hiệu ứng âm thanh.
Quy tắc Output:
• Chỉ trả về một chuỗi văn bản duy nhất với các thẻ sau:
[BẮT ĐẦU PROMPT]
"scene_id_${startShot}": "..."
[PROMPT TIẾP THEO]
"scene_id_X": "..."
[PROMPT TIẾP THEO]
"scene_id_${endShot}": "..."
[KẾT THÚC PROMPT]
`;
    const result = await ai.models.generateContent({ model: "gemini-2.5-pro", contents: prompt });
    if (!result.text) throw new Error("AI response was empty for Scenes List.");
    return result.text.trim();
};

export const generateJsonPrompts = async (apiKey: string, biblesAndOutline: string, scenesList: string, startN: number, endN: number) => {
    const ai = getAiClient(apiKey);
    const prompt = `Hãy viết JSON Prompt cho các cảnh (${startN} → ${endN}) dựa trên Character Bible, Environment Bible, và Scenes List đã cung cấp.

Bibles và Outline:
---
${biblesAndOutline}
---

Scenes List:
---
${scenesList}
---

Quy tắc bắt buộc:
• Phải giữ nguyên đặc điểm nhân vật từ Character Bible (không được thay đổi giới tính, ngoại hình, quần áo).
• Luôn có 3 phần:
1.  "characters" – giữ nguyên chi tiết nhân vật từ Character Bible.
2.  "environment" – giữ nguyên chi tiết bối cảnh từ Environment Bible.
3.  "shots" – danh sách các cảnh quay.
• Mỗi "shot" phải có:
o "duration" (giây)
o "prompt" (mô tả hành động + bối cảnh + cảm xúc, chi tiết điện ảnh)
o "style" (phong cách hình ảnh, ví dụ: Hyper-realistic Cinematic)
o "camera" (góc máy, chuyển động)
o "transition" (cut, dissolve, fade…)
o "dialogue" (nếu có → giữ nguyên ngôn ngữ gốc, nếu không → null)
o "audio" (bgm + sfx phù hợp)
Quy tắc quan trọng:
• Toàn bộ JSON phải viết bằng tiếng Anh, trừ dialogue giữ nguyên ngôn ngữ gốc.
• Phải giữ thứ tự cảnh từ ${startN} → ${endN}, không nhảy cóc, không lặp lại.
• Chỉ xuất đúng cấu trúc [BẮT ĐẦU PROMPT]...[PROMPT TIẾP THEO]...[KẾT THÚC PROMPT], không thêm chữ thừa.
• Ngôn từ phải cinematic, dễ hình dung, không trừu tượng.
Cấu trúc xuất:
[BẮT ĐẦU PROMPT]
{JSON Prompt Scene ${startN}}
[PROMPT TIẾP THEO]
{JSON Prompt Scene ${endN}}
[KẾT THÚC PROMPT]
`;
    const result = await ai.models.generateContent({ model: "gemini-2.5-pro", contents: prompt, config: { temperature: 0.5 } });
    if (!result.text) throw new Error("AI response was empty for JSON Prompts.");
    return result.text.trim();
};

export const generateFullAffiliateScript = async (apiKey: string, params: any) => {
    const ai = getAiClient(apiKey);
    const { modelImageBase64, productImageBase64, aspectRatio, generationMode, outfitSuggestion, backgroundSuggestion, productInfo, productSuggestion, platform } = params;

    const seed = Math.floor(Math.random() * 100000);
    const dimensions = aspectRatio === '9:16' ? '1080x1920 pixels' : '1920x1080 pixels';
    
    // Step 1: Generate Image
    const backgroundPrompt = backgroundSuggestion ? `- **Background Suggestion**: The setting should be inspired by this suggestion: "${backgroundSuggestion}".` : `- **Setting**: The background must be a dynamic and interesting setting. CRITICAL: For this specific generation (seed ${seed}), create a COMPLETELY UNIQUE background. Do not repeat locations from other generations. AVOID simple studio backdrops.`;
    let imagePrompt;
    if (generationMode === 'fashion') {
        const complementaryOutfitPrompt = outfitSuggestion ? `- **Complementary Outfit**: Style the rest of the outfit to complement the main fashion item, inspired by this suggestion: "${outfitSuggestion}".` : `- **Complementary Outfit**: Style the rest of the outfit to be fashionable and contextually appropriate, complementing the main fashion item. CRITICAL: For this specific generation (seed ${seed}), invent a COMPLETELY UNIQUE complementary outfit.`;
        imagePrompt = `CRITICAL RULE: The final image's dimensions MUST BE EXACTLY ${dimensions} (${aspectRatio}). Create a photorealistic, high-resolution (1080p) ad image. Person: Must feature the person from the first image, keeping their facial features and appearance identical. Fashion Item: The person MUST wear the fashion item (e.g., shirt, pants) from the second image. The item's design, color, and pattern must be 100% preserved. DO NOT MODIFY THE ORIGINAL PRODUCT. ${complementaryOutfitPrompt} ${backgroundPrompt} Style: High-fashion, premium lookbook style. Composition: Full-body or three-quarters shot. Variation (seed ${seed}): Ensure a unique background and complementary outfit. Final Reminder: Output dimensions must be exactly ${dimensions}.`;
    } else {
        const outfitPrompt = outfitSuggestion ? `- **Outfit**: The person must wear an outfit inspired by: "${outfitSuggestion}".` : `- **Outfit**: The person must wear a fashionable and contextually appropriate outfit. CRITICAL: For this generation (seed ${seed}), invent a COMPLETELY UNIQUE outfit.`;
        imagePrompt = `CRITICAL RULE: The final image's dimensions MUST BE EXACTLY ${dimensions} (${aspectRatio}). Create a unique, high-resolution (1080p), photorealistic ad image. Person: Must feature the person from the first image, keeping their facial features and appearance identical. Product: The product from the second image must be featured clearly. Its appearance and branding must be 100% preserved. DO NOT MODIFY THE ORIGINAL PRODUCT. REALISTIC SCALE: The product size MUST be realistic and proportional to the person. Interaction: The person must interact with or present the product naturally. ${outfitPrompt} ${backgroundPrompt} Style: Premium, professional ad style. Composition: Full-body shot. Variation (seed ${seed}): Ensure a unique outfit and background. Final Reminder: Output dimensions must be exactly ${dimensions}.`;
    }

    const imageResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts: [{ text: imagePrompt }, { inlineData: { data: modelImageBase64, mimeType: 'image/jpeg' } }, { inlineData: { data: productImageBase64, mimeType: 'image/jpeg' } }] },
        config: { responseModalities: [Modality.IMAGE] },
    });

    const imagePart = imageResponse.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
    if (!imagePart || !imagePart.inlineData) { throw new Error('Không thể tạo ảnh từ AI.'); }
    const generatedImageBase64 = imagePart.inlineData.data;

    // Step 2: Generate Script
    const scriptGenerationPrompt = `You are a master creative director for social media advertising. Your task is to create a full video script JSON object based on the provided images and product information. The output must be a single JSON object containing 'production_plan' and 'scenes'.

    CONTEXT:
    - Target Platform: ${platform} (${platform === 'tiktok' ? 'Short, punchy, ~15s total' : 'Slightly longer, ~15-30s total'})
    - Core Idea: A promotional video featuring a person with a product.
    - Product Info: ${productInfo || 'Not provided. Analyze the product image.'}
    - User Suggestions: ${productSuggestion || 'None.'}

    You will be provided with three images: 1. Model image, 2. Product image, 3. A generated promotional image of the model with the product.

    YOUR TASK: Generate a complete script in a JSON object with "production_plan" and "scenes".

    1. production_plan:
       - title: A catchy, viral-style title for the video.
       - logline: A one-sentence summary.
       - style_preset_name: Should be "Cinematic".
       - style_description: Describe a modern, high-energy, social-media-ad style.
       - character_profiles: Create ONE profile for the person in the image. Base their description on the model image. Give them a name.
       - prop_profiles: Create ONE profile for the product in the product image.
       - setting_description: Describe the setting from the generated promotional image.

    2. scenes:
       - Create an array of ${platform === 'tiktok' ? '2-3 scenes' : '3-5 scenes'}.
       - Each scene object must follow the SCENE_SCHEMA.
       - video_prompt: Must be VERY DETAILED, in ENGLISH, and follow the markdown format for "Cinematic" style. CRITICALLY, you must reference the character and prop profiles to ensure consistency. Use the generated promotional image as the primary visual reference for the scenes.
       - duration_seconds: Keep scenes short, between 4-7 seconds.
       - aspect_ratio: Must be "${aspectRatio}".
       - sound_design: Include engaging sound effects and suggest a trendy background music track. The voiceover/dialogue should be based on the product info.
       
    The final JSON output must be valid.`;

    const scriptResponse = await ai.models.generateContent({
        model: 'gemini-2.5-pro',
        contents: {
            parts: [
                { text: scriptGenerationPrompt },
                { text: "Model Image:" }, { inlineData: { data: modelImageBase64, mimeType: 'image/jpeg' } },
                { text: "Product Image:" }, { inlineData: { data: productImageBase64, mimeType: 'image/jpeg' } },
                { text: "Generated Promotional Image:" }, { inlineData: { data: generatedImageBase64, mimeType: 'image/jpeg' } }
            ]
        },
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    production_plan: PRODUCTION_PLAN_SCHEMA,
                    scenes: SCENE_ARRAY_SCHEMA
                },
                required: ["production_plan", "scenes"]
            }
        }
    });

    const scriptData = JSON.parse(scriptResponse.text);

    return {
        generatedImageBase64,
        scriptData,
    };
};