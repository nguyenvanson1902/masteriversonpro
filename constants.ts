// Constants for Prompt Generator Tool
export const STYLES = [ "Hoạt hình 3D Pixar", "Anime Nhật Bản", "Studio Ghibli", "Điện ảnh", "Hoạt hình đất sét", "Hơi nước Vaporwave", "Phim tài liệu", "Phim cổ điển", "Tranh màu nước", "Tương lai Cyberpunk", "Hoạt hình 2D cổ điển", "Nghệ thuật Pixel", "Tối giản", "Kinh dị Gothic", "Lãng mạn", "Fantasy hùng vĩ", "Khoa học viễn tưởng", "Siêu thực", "Cổ tích", "Tranh sơn dầu" ];
export const PROMPT_TOOL_ASPECT_RATIOS = ['16:9', '9:16'];


// Constants for Storyteller Tool
export const STORYTELLER_TOPICS = [
    {
        id: 'horror_story',
        name: 'Truyện ma kinh dị',
        description: 'Kể chuyện ma rùng rợn, giật gân, tạo không khí bí ẩn và đáng sợ.',
        prompt: 'Bạn là một người kể chuyện ma chuyên nghiệp. Hãy viết một kịch bản lồng tiếng kinh dị dựa trên ý tưởng sau. Sử dụng ngôn từ gợi hình, tạo sự hồi hộp, và kết thúc bằng một chi tiết bất ngờ hoặc ám ảnh. Độ dài khoảng {characterCount} ký tự.'
    },
    {
        id: 'fairy_tale',
        name: 'Truyện cổ tích',
        description: 'Kể những câu chuyện cổ tích nhẹ nhàng, nhân văn, phù hợp với mọi lứa tuổi.',
        prompt: 'Bạn là một người kể truyện cổ tích ấm áp. Dựa vào ý tưởng sau, hãy sáng tác một câu chuyện cổ tích có hậu, chứa đựng bài học ý nghĩa về lòng tốt và sự dũng cảm. Độ dài khoảng {characterCount} ký tự.'
    },
    {
        id: 'documentary',
        name: 'Thuyết minh phim tài liệu',
        description: 'Giọng đọc trang trọng, rõ ràng cho các video kiến thức, khám phá, khoa học.',
        prompt: 'Bạn là một chuyên gia thuyết minh phim tài liệu. Hãy viết một kịch bản thuyết minh chuyên nghiệp, cung cấp thông tin chính xác và hấp dẫn về chủ đề sau. Sử dụng thuật ngữ phù hợp và giọng văn trang trọng. Độ dài khoảng {characterCount} ký tự.'
    },
    {
        id: 'news_report',
        name: 'Bản tin thời sự',
        description: 'Đọc các bản tin, sự kiện với giọng điệu chuyên nghiệp, khách quan và đáng tin cậy.',
        prompt: 'Bạn là một biên tập viên thời sự. Hãy soạn một kịch bản cho bản tin ngắn về sự kiện được cung cấp, đảm bảo tính khách quan, thông tin đầy đủ và ngôn ngữ báo chí. Độ dài khoảng {characterCount} ký tự.'
    },
    {
        id: 'product_review',
        name: 'Review/Quảng cáo sản phẩm',
        description: 'Tạo kịch bản giới thiệu sản phẩm một cách hấp dẫn, thuyết phục và chuyên nghiệp.',
        prompt: 'Bạn là một chuyên gia marketing. Hãy viết một kịch bản review/quảng cáo sản phẩm hấp dẫn cho ý tưởng sau. Tập trung vào lợi ích, tính năng nổi bật và kêu gọi hành động mạnh mẽ. Độ dài khoảng {characterCount} ký tự.'
    },
    {
        id: 'history_story',
        name: 'Kể chuyện lịch sử',
        description: 'Dẫn dắt người nghe qua những câu chuyện lịch sử hào hùng, bi tráng hoặc thú vị.',
        prompt: 'Bạn là một nhà sử học đầy nhiệt huyết. Hãy viết một kịch bản kể chuyện lịch sử hấp dẫn về chủ đề sau. Sử dụng lối kể chuyện lôi cuốn, kết hợp thông tin chính xác với các chi tiết sống động để tái hiện lại quá khứ. Độ dài khoảng {characterCount} ký tự.'
    },
    {
        id: 'motivational_speech',
        name: 'Diễn văn truyền cảm hứng',
        description: 'Soạn thảo những bài diễn văn mạnh mẽ, truyền động lực và khơi dậy cảm hứng.',
        prompt: 'Bạn là một diễn giả truyền cảm hứng. Hãy viết một bài diễn văn mạnh mẽ và đầy năng lượng dựa trên ý tưởng sau. Sử dụng ngôn từ tích cực, những câu chuyện lay động và thông điệp rõ ràng để thúc đẩy người nghe hành động. Độ dài khoảng {characterCount} ký tự.'
    },
    {
        id: 'podcast_talk',
        name: 'Podcast/Tâm sự',
        description: 'Soạn kịch bản cho một buổi trò chuyện tự nhiên, gần gũi như một chương trình podcast.',
        prompt: 'Bạn là một host podcast thân thiện. Hãy viết một kịch bản cho một đoạn podcast ngắn về chủ đề sau. Sử dụng giọng văn tự nhiên, trò chuyện, đặt câu hỏi gợi mở và chia sẻ quan điểm cá nhân một cách gần gũi. Độ dài khoảng {characterCount} ký tự.'
    },
    {
        id: 'educational_tutorial',
        name: 'Video Hướng dẫn/Giáo dục',
        description: 'Tạo kịch bản hướng dẫn từng bước rõ ràng, dễ hiểu cho các video giáo dục, "how-to".',
        prompt: 'Bạn là một người hướng dẫn tận tâm. Hãy viết một kịch bản video giáo dục/hướng dẫn chi tiết về chủ đề sau. Chia thành các bước rõ ràng, giải thích đơn giản và súc tích để người xem có thể dễ dàng làm theo. Độ dài khoảng {characterCount} ký tự.'
    }
];

export const TTS_VOICES = [
    { label: 'Nam Miền Bắc (Trầm ấm)', value: 'Zephyr', style: 'với giọng trầm ấm, rõ ràng' },
    { label: 'Nữ Miền Bắc (Nhẹ nhàng)', value: 'Kore', style: 'với giọng nhẹ nhàng, truyền cảm' },
    { label: 'Nam Miền Nam (Tự nhiên)', value: 'Puck', style: 'với giọng tự nhiên, thân thiện' },
    { label: 'Nữ Miền Nam (Thân thiện)', value: 'Charon', style: 'với giọng thân thiện, gần gũi' },
    { label: 'Giọng kể chuyện (Nam)', value: 'Fenrir', style: 'với giọng kể chuyện hấp dẫn, lôi cuốn' },
    { label: 'Sách Audio Nữ đọc (Miền Bắc)', value: 'Kore', style: 'với giọng đọc truyền cảm, chuyên nghiệp, như đang đọc sách nói' },
    { label: 'Nam review sản phẩm (Miền Nam)', value: 'Puck', style: 'với giọng nói nhiệt tình, đáng tin cậy, như đang review sản phẩm' },
    { label: 'Nữ tâm sự đêm khuya (Miền Nam)', value: 'Charon', style: 'với giọng thủ thỉ, nhẹ nhàng, tạo cảm giác gần gũi như đang tâm sự đêm khuya' },
    { label: 'Nam bình luận viên thể thao', value: 'Zephyr', style: 'với giọng nói đầy năng lượng, nhanh và dứt khoát như một bình luận viên thể thao' },
    { label: 'Giọng cô giáo giảng bài', value: 'Kore', style: 'với giọng rõ ràng, kiên nhẫn và thuyết phục như một cô giáo đang giảng bài' },
    { label: 'Nam kể truyện kinh dị', value: 'Fenrir', style: 'với giọng kể chậm rãi, nhấn nhá, tạo không khí rùng rợn để kể truyện kinh dị' },
];

// Constants for Director Tool
export const INITIAL_STYLES = [
  { name: "Cinematic (Default)", description: "High-quality, realistic cinematic style with dramatic lighting." },
  { name: "Anime", description: "Vibrant, colorful Japanese animation style." },
  { name: "3D Animation", description: "Pixar-like 3D animated style, friendly and expressive." },
  { name: "Documentary", description: "Realistic, informative, and steady-shot documentary style." },
  { name: "Vaporwave", description: "Retro-futuristic aesthetic with neon colors and 80s/90s vibes." },
  { name: "Gothic Horror", description: "Dark, moody, and atmospheric with high contrast and shadows." },
  { name: "Claymation", description: "Stop-motion animation style using clay figures." },
];

export const PACING_OPTIONS = [
    { value: 'default', label: 'Mặc định' },
    { value: 'fast_paced', label: 'Nhịp độ nhanh (Hành động)' },
    { value: 'slow_paced', label: 'Nhịp độ chậm (Cảm xúc)' },
    { value: 'suspenseful', label: 'Hồi hộp (Bí ẩn)' },
    { value: 'energetic', label: 'Năng động (Vui vẻ)' },
];

export const DIRECTOR_ASPECT_RATIOS = [
    { name: '16:9', label: 'Ngang (16:9)' },
    { name: '9:16', label: 'Dọc (9:16)' },
    { name: '1:1', label: 'Vuông (1:1)' },
];

export const DIALOGUE_LANGUAGES = [
    { value: 'vietnamese', label: 'Tiếng Việt' },
    { value: 'english', label: 'Tiếng Anh' },
    { value: 'none', label: 'Không có (Câm)' },
];

export const NEGATIVE_PROMPT = 'blurry, low quality, noisy, watermark, text, signature, speech bubbles, ugly, tiling, poorly drawn hands, poorly drawn feet, poorly drawn face, out of frame, extra limbs, disfigured, deformed, body out of frame, bad anatomy, blurred, grainy, signature, cut off, draft';