// Constants for Prompt Generator Tool
export const STYLES = [ "Hoạt hình 3D Pixar", "Anime Nhật Bản", "Studio Ghibli", "Điện ảnh", "Hoạt hình đất sét", "Hơi nước Vaporwave", "Phim tài liệu", "Phim cổ điển", "Tranh màu nước", "Tương lai Cyberpunk", "Hoạt hình 2D cổ điển", "Nghệ thuật Pixel", "Tối giản", "Kinh dị Gothic", "Lãng mạn", "Fantasy hùng vĩ", "Khoa học viễn tưởng", "Siêu thực", "Cổ tích", "Tranh sơn dầu" ];
export const PROMPT_TOOL_ASPECT_RATIOS = ['16:9', '9:16'];


// Constants for Storyteller Tool
export const STORYTELLER_TOPICS = [
    {
        id: 'horror_story',
        name: 'Truyện ma kinh dị',
        description: 'Kể chuyện ma rùng rợn, giật gân, tạo không khí bí ẩn và đáng sợ.',
        prompt: 'Bạn là một người kể chuyện ma chuyên nghiệp. Hãy viết một câu chuyện kinh dị dựa trên ý tưởng sau, phù hợp để làm lồng tiếng cho video. Kể chuyện dưới dạng một bài văn xuôi liền mạch, sử dụng ngôn từ gợi hình, tạo sự hồi hộp, và kết thúc bằng một chi tiết bất ngờ hoặc ám ảnh. Tuyệt đối không bao gồm các chỉ dẫn kịch bản như tên nhân vật (ví dụ: "NGƯỜI DẪN CHUYỆN:"), hiệu ứng âm thanh (ví dụ: "(SFX...)"), hoặc các ghi chú trong ngoặc đơn. Độ dài khoảng {characterCount} ký tự.'
    },
    {
        id: 'fairy_tale',
        name: 'Truyện cổ tích',
        description: 'Kể những câu chuyện cổ tích nhẹ nhàng, nhân văn, phù hợp với mọi lứa tuổi.',
        prompt: 'Bạn là một người kể truyện cổ tích ấm áp. Dựa vào ý tưởng sau, hãy sáng tác một câu chuyện cổ tích có hậu, chứa đựng bài học ý nghĩa về lòng tốt và sự dũng cảm, dưới dạng một bài văn xuôi liền mạch. Tuyệt đối không bao gồm các chỉ dẫn kịch bản như tên nhân vật, hiệu ứng âm thanh, hoặc các ghi chú trong ngoặc đơn. Độ dài khoảng {characterCount} ký tự.'
    },
    {
        id: 'documentary',
        name: 'Thuyết minh phim tài liệu',
        description: 'Giọng đọc trang trọng, rõ ràng cho các video kiến thức, khám phá, khoa học.',
        prompt: 'Bạn là một chuyên gia thuyết minh phim tài liệu. Hãy viết một bài thuyết minh chuyên nghiệp dưới dạng văn xuôi liền mạch, cung cấp thông tin chính xác và hấp dẫn về chủ đề sau. Sử dụng thuật ngữ phù hợp và giọng văn trang trọng. Tuyệt đối không bao gồm các chỉ dẫn kịch bản. Độ dài khoảng {characterCount} ký tự.'
    },
    {
        id: 'news_report',
        name: 'Bản tin thời sự',
        description: 'Đọc các bản tin, sự kiện với giọng điệu chuyên nghiệp, khách quan và đáng tin cậy.',
        prompt: 'Bạn là một biên tập viên thời sự. Hãy soạn nội dung cho một bản tin ngắn về sự kiện được cung cấp, trình bày như một bài văn xuôi liền mạch. Đảm bảo tính khách quan, thông tin đầy đủ và ngôn ngữ báo chí. Tuyệt đối không bao gồm các chỉ dẫn kịch bản. Độ dài khoảng {characterCount} ký tự.'
    },
    {
        id: 'product_review',
        name: 'Review/Quảng cáo sản phẩm',
        description: 'Tạo kịch bản giới thiệu sản phẩm một cách hấp dẫn, thuyết phục và chuyên nghiệp.',
        prompt: 'Bạn là một chuyên gia marketing. Hãy viết một bài review/quảng cáo sản phẩm hấp dẫn cho ý tưởng sau, trình bày dưới dạng văn xuôi liền mạch. Tập trung vào lợi ích, tính năng nổi bật và kêu gọi hành động mạnh mẽ. Tuyệt đối không bao gồm các chỉ dẫn kịch bản. Độ dài khoảng {characterCount} ký tự.'
    },
    {
        id: 'history_story',
        name: 'Kể chuyện lịch sử',
        description: 'Dẫn dắt người nghe qua những câu chuyện lịch sử hào hùng, bi tráng hoặc thú vị.',
        prompt: 'Bạn là một nhà sử học đầy nhiệt huyết. Hãy viết một câu chuyện lịch sử hấp dẫn về chủ đề sau, trình bày dưới dạng văn xuôi liền mạch. Sử dụng lối kể chuyện lôi cuốn, kết hợp thông tin chính xác với các chi tiết sống động để tái hiện lại quá khứ. Tuyệt đối không bao gồm các chỉ dẫn kịch bản. Độ dài khoảng {characterCount} ký tự.'
    },
    {
        id: 'motivational_speech',
        name: 'Diễn văn truyền cảm hứng',
        description: 'Soạn thảo những bài diễn văn mạnh mẽ, truyền động lực và khơi dậy cảm hứng.',
        prompt: 'Bạn là một diễn giả truyền cảm hứng. Hãy viết một bài diễn văn mạnh mẽ và đầy năng lượng dựa trên ý tưởng sau, trình bày dưới dạng văn xuôi liền mạch. Sử dụng ngôn từ tích cực, những câu chuyện lay động và thông điệp rõ ràng để thúc đẩy người nghe hành động. Tuyệt đối không bao gồm các chỉ dẫn kịch bản. Độ dài khoảng {characterCount} ký tự.'
    },
    {
        id: 'podcast_talk',
        name: 'Podcast/Tâm sự',
        description: 'Soạn kịch bản cho một buổi trò chuyện tự nhiên, gần gũi như một chương trình podcast.',
        prompt: 'Bạn là một host podcast thân thiện. Hãy viết nội dung cho một đoạn podcast ngắn về chủ đề sau, trình bày dưới dạng văn xuôi liền mạch như một người đang trò chuyện. Sử dụng giọng văn tự nhiên, đặt câu hỏi gợi mở và chia sẻ quan điểm cá nhân một cách gần gũi. Tuyệt đối không bao gồm các chỉ dẫn kịch bản. Độ dài khoảng {characterCount} ký tự.'
    },
    {
        id: 'educational_tutorial',
        name: 'Video Hướng dẫn/Giáo dục',
        description: 'Tạo kịch bản hướng dẫn từng bước rõ ràng, dễ hiểu cho các video giáo dục, "how-to".',
        prompt: 'Bạn là một người hướng dẫn tận tâm. Hãy viết một bài hướng dẫn chi tiết cho video giáo dục về chủ đề sau, trình bày dưới dạng văn xuôi liền mạch. Chia thành các bước rõ ràng, giải thích đơn giản và súc tích để người xem có thể dễ dàng làm theo. Tuyệt đối không bao gồm các chỉ dẫn kịch bản. Độ dài khoảng {characterCount} ký tự.'
    }
];

export const TTS_VOICES = [
    // Original voices, adapted
    { label: 'Nam Miền Bắc (Mặc định)', value: 'Zephyr', style: 'Giọng nam miền Bắc trầm ấm, rõ ràng. Phù hợp cho tin tức, thuyết minh.', promptPrefix: '' },
    { label: 'Nữ Miền Bắc (Mặc định)', value: 'Kore', style: 'Giọng nữ miền Bắc nhẹ nhàng, truyền cảm. Phù hợp cho kể chuyện, tâm sự.', promptPrefix: '' },
    { label: 'Nam Miền Nam (Mặc định)', value: 'Puck', style: 'Giọng nam miền Nam tự nhiên, thân thiện. Phù hợp cho review, podcast.', promptPrefix: '' },
    { label: 'Nữ Miền Nam (Mặc định)', value: 'Charon', style: 'Giọng nữ miền Nam thân thiện, gần gũi. Phù hợp cho quảng cáo, vlog.', promptPrefix: '' },
    { label: 'Nam Kể Chuyện (Mặc định)', value: 'Fenrir', style: 'Giọng nam kể chuyện chuyên nghiệp, hấp dẫn và lôi cuốn.', promptPrefix: '' },

    // Styled voices (from old list)
    { label: 'Sách Audio Nữ đọc (Miền Bắc)', value: 'Kore', style: 'Giọng đọc truyền cảm, chuyên nghiệp, như đang đọc sách nói.', promptPrefix: 'Read in a professional, emotive audiobook narrator voice:' },
    { label: 'Nam review sản phẩm (Miền Nam)', value: 'Puck', style: 'Giọng nói nhiệt tình, đáng tin cậy, như đang review sản phẩm.', promptPrefix: 'Speak enthusiastically and trustworthily, like a product reviewer:' },
    { label: 'Nữ tâm sự đêm khuya (Miền Nam)', value: 'Charon', style: 'Giọng thủ thỉ, nhẹ nhàng, tạo cảm giác gần gũi như đang tâm sự.', promptPrefix: 'Whisper softly and gently, like a late-night confidante:' },
    { label: 'Nam bình luận viên thể thao', value: 'Zephyr', style: 'Giọng nói đầy năng lượng, nhanh và dứt khoát như bình luận viên.', promptPrefix: 'Speak with high energy, fast and decisively, like a sports commentator:' },
    { label: 'Giọng cô giáo giảng bài', value: 'Kore', style: 'Giọng rõ ràng, kiên nhẫn và thuyết phục như một cô giáo.', promptPrefix: 'Speak clearly, patiently, and persuasively, like a teacher giving a lecture:' },
    
    // New voices
    { label: 'Nam kể truyện ma', value: 'Fenrir', style: 'Giọng kể chậm rãi, nhấn nhá, tạo không khí rùng rợn, bí ẩn.', promptPrefix: 'Narrate slowly, with emphasis, creating a spooky atmosphere for a horror story:' },
    { label: 'Nữ vui tươi, năng động', value: 'Charon', style: 'Giọng vui tươi, trong trẻo và đầy năng lượng, phù hợp cho video giải trí.', promptPrefix: 'Say cheerfully and energetically:' },
    { label: 'Nam vui vẻ, hài hước', value: 'Puck', style: 'Giọng vui vẻ, hài hước và dí dỏm, phù hợp cho nội dung hài.', promptPrefix: 'Say in a happy, humorous, and witty tone:' },
    { label: 'Nữ ASMR (Thì thầm)', value: 'Charon', style: 'Giọng thì thầm cực nhỏ, nhẹ nhàng, tạo hiệu ứng thư giãn ASMR.', promptPrefix: 'Whisper softly and gently for an ASMR effect:' },
    { label: 'Nam dẫn thiền', value: 'Fenrir', style: 'Giọng nói chậm, thư giãn và bình yên để dẫn thiền hoặc yoga.', promptPrefix: 'Speak slowly and calmly, in a relaxing and peaceful tone for meditation:' },
    { label: 'Nữ thông báo công cộng', value: 'Kore', style: 'Giọng chuẩn, rõ ràng, không cảm xúc như đang đọc thông báo.', promptPrefix: 'Announce clearly and neutrally, like a public announcement system:' },
    { label: 'Giọng Robot (Nam)', value: 'Zephyr', style: 'Giọng đều đều, máy móc, không có ngữ điệu như robot.', promptPrefix: 'Speak in a monotonous, robotic voice:' },
    
    // New voices requested by user
    { label: 'Giọng trẻ em nam', value: 'Puck', style: 'Giọng nói trong trẻo, cao, mô phỏng giọng của một bé trai.', promptPrefix: 'Speak in a high-pitched, cheerful voice like a young boy:' },
    { label: 'Giọng trẻ em nữ', value: 'Charon', style: 'Giọng nói cao, vui tươi, mô phỏng giọng của một bé gái.', promptPrefix: 'Speak in a high-pitched, happy voice like a young girl:' },
    { label: 'Giọng người già kể chuyện', value: 'Fenrir', style: 'Giọng nói trầm, chậm rãi và ấm áp, như một người ông đang kể chuyện.', promptPrefix: 'Speak in a deep, slow, and warm voice like an old man telling a story:' },
    { label: 'Giọng nam mạnh mẽ, hùng hồn', value: 'Zephyr', style: 'Giọng nam dứt khoát, mạnh mẽ và đầy nội lực, phù hợp cho video truyền cảm hứng, lịch sử.', promptPrefix: 'Speak in a powerful, strong, and resonant male voice:' },
    { label: 'Giọng nữ dịu dàng, thỏ thẻ', value: 'Kore', style: 'Giọng nữ nhẹ nhàng, tình cảm và thủ thỉ, phù hợp cho video tâm sự, thư giãn.', promptPrefix: 'Speak in a soft, gentle, and emotional female voice:' },
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