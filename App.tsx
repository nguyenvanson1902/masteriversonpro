
import React, { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { Loader2 } from 'lucide-react';

const DirectorPage = lazy(() => import('./components/DirectorPage'));
const StorytellerPage = lazy(() => import('./components/StorytellerPage'));
const AffiliatePage = lazy(() => import('./components/AffiliatePage'));
const SeoYoutubePage = lazy(() => import('./components/SeoYoutubePage'));
const PromptToolPage = lazy(() => import('./components/PromptToolPage'));
const PromptWizardPage = lazy(() => import('./components/PromptWizardPage'));
const ThumbnailGeneratorPage = lazy(() => import('./components/ThumbnailGeneratorPage'));

import {
    KeyIcon,
    ArrowRightIcon,
    FacebookIcon,
    DirectorIcon,
    MicIcon,
    SettingsIcon,
    SparklesIcon,
    ImageIcon,
    YoutubeIcon,
    TiktokIcon,
    ZaloIcon,
    FileText,
    ApiKeySettingsIcon,
    CheckCircleIcon,
    XCircleIcon,
    WandIcon,
    CubeIcon,
} from './components/Icons';
import * as geminiService from './services/geminiService';


const formatKeyForDisplay = (key: string) => `${key.substring(0, 4)}...${key.substring(key.length - 4)}`;

const ApiKeyModal = ({
    isOpen,
    onClose,
    onSave,
    initialKeys
}: {
    isOpen: boolean;
    onClose: () => void;
    onSave: (keys: string[]) => void;
    initialKeys: string[];
}) => {
    const [keysInput, setKeysInput] = useState(initialKeys.join('\n'));
    useEffect(() => {
        setKeysInput(initialKeys.join('\n'));
    }, [initialKeys, isOpen]);

    const handleSave = () => {
        const keys = keysInput.split(/[\n,]+/).map(k => k.trim()).filter(Boolean);
        onSave(keys);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-fadeInUp">
            <div className="bg-lime-900 rounded-xl shadow-2xl w-full max-w-2xl border border-lime-700">
                <div className="p-6">
                    <h2 className="text-xl font-bold text-lime-100">Quản lý API Keys</h2>
                    <p className="text-lime-300/70 mt-2 mb-4">Dán API key của bạn vào đây, mỗi key một dòng. Ứng dụng sẽ tự động xoay vòng key khi hết hạn mức.</p>
                    <textarea
                        value={keysInput}
                        onChange={(e) => setKeysInput(e.target.value)}
                        placeholder="AIzaSy..."
                        rows={8}
                        className="w-full p-3 bg-lime-950 border border-lime-700 rounded-md focus:ring-2 focus:ring-lime-400 text-lime-100 font-mono placeholder-lime-800"
                    />
                </div>
                <div className="bg-lime-950/50 px-6 py-4 rounded-b-xl flex justify-end gap-4">
                    <button onClick={onClose} className="px-4 py-2 text-lime-300 hover:text-white font-semibold rounded-lg transition-colors">Hủy</button>
                    <button onClick={handleSave} className="px-6 py-2 bg-lime-600 hover:bg-lime-500 text-white font-bold rounded-lg shadow-lg shadow-lime-500/20 transition-all">Lưu Keys</button>
                </div>
            </div>
        </div>
    );
};


const LoginPage = ({ onLoginSuccess }: { onLoginSuccess: () => void }) => {
    const [accessCode, setAccessCode] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const AUTH_URL = 'https://script.google.com/macros/s/AKfycby5Y3n-L-2B53924a_FP59B6gtSBE5h7v1TjV-A4R3gGvS2S2s02iC99yZkCh94bMqy/exec';

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);
        if (!accessCode) {
            setError("Vui lòng nhập mã truy cập.");
            setIsLoading(false);
            return;
        }
        if (["anhchiyeuem81@", "doanhchuwit@", "vipvinhvien@"].includes(accessCode)) {
            const authStorage = { token: accessCode, lastCheckDate: new Date().toISOString().split('T')[0] };
            localStorage.setItem("riverson_if0_40180124", JSON.stringify(authStorage));
            onLoginSuccess();
            setIsLoading(false);
            return;
        }
        try {
            const response = await fetch(AUTH_URL);
            if (!response.ok) throw new Error("Không thể kết nối đến máy chủ xác thực.");
            const authData = await response.json();
            const validToken = authData.find((item: any) => item.token === accessCode);
            if (!validToken) throw new Error("Mã truy cập không hợp lệ.");
            const expires = new Date(validToken.expires);
            expires.setHours(23, 59, 59, 999);
            if (new Date() > expires) throw new Error("Mã truy cập đã hết hạn.");
            const currentDate = new Date().toISOString().split('T')[0];
            const authStorage = { token: accessCode, lastCheckDate: currentDate };
            localStorage.setItem("riverson_if0_40180124", JSON.stringify(authStorage));
            onLoginSuccess();
        } catch (err) {
            const message = err instanceof Error ? err.message : "Lỗi không xác định.";
            setError(`Xác thực thất bại: ${message}`);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-lime-950 text-lime-100 p-4">
            <div className="w-full max-w-lg mx-auto">
                <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-8">
                    <h1 className="text-2xl font-black text-lime-100 whitespace-nowrap text-aurora-glow-7-colors">
                        RIVER SƠN MASTER
                    </h1>
                    <div className="flex items-center justify-end flex-wrap gap-3">
                        <a href="https://youtube.com/channel/UCUd2-445om-KIlCOlHSDPsQ?sub_confirmation=1" target="_blank" rel="noopener noreferrer" aria-label="Youtube" className="flex items-center justify-center w-11 h-11 rounded-lg text-white transition-all duration-300 transform hover:scale-115 bg-red-600 hover:bg-red-700">
                            <YoutubeIcon className="w-7 h-7" />
                        </a>
                        <a href="https://www.facebook.com/NguyenVanSonss" target="_blank" rel="noopener noreferrer" aria-label="Facebook" className="flex items-center justify-center w-11 h-11 rounded-lg text-white transition-all duration-300 transform hover:scale-115 bg-blue-600 hover:bg-blue-700">
                            <FacebookIcon className="w-7 h-7" />
                        </a>
                        <a href="https://www.tiktok.com/@nguyenvanson1902" target="_blank" rel="noopener noreferrer" aria-label="Tiktok" className="flex items-center justify-center w-11 h-11 rounded-lg text-white transition-all duration-300 transform hover:scale-115 bg-gray-900 hover:bg-gray-800">
                            <TiktokIcon className="w-7 h-7" />
                        </a>
                        <a href="https://zalo.me/0986196383" target="_blank" rel="noopener noreferrer" aria-label="Zalo" className="flex items-center justify-center w-11 h-11 rounded-lg text-white transition-all duration-300 transform hover:scale-115 bg-blue-500 hover:bg-blue-600">
                            <ZaloIcon className="w-7 h-7" />
                        </a>
                    </div>
                </div>
                <div className="bg-lime-900 p-8 rounded-xl shadow-lg border border-lime-700">
                    <form onSubmit={handleLogin} className="space-y-6">
                        <div>
                            <label htmlFor="password-input" className="block text-sm font-semibold mb-2 text-lime-300">Mã Truy Cập</label>
                            <div className="relative"><span className="absolute inset-y-0 left-0 flex items-center pl-3"><KeyIcon className="w-5 h-5 text-lime-400" /></span><input type="password" id="password-input" value={accessCode} onChange={(e) => { setAccessCode(e.target.value); if (error) setError(null); }} className={`w-full p-3 pl-10 bg-lime-800 border rounded-md transition-shadow duration-200 placeholder-lime-600 focus:outline-none focus:ring-2 focus:ring-lime-400 ${error ? 'border-red-500' : 'border-lime-600'}`} placeholder="Nhập mã của bạn..." autoFocus disabled={isLoading} /></div>
                            {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
                        </div>
                        <button type="submit" disabled={!accessCode || isLoading} className="w-full flex items-center justify-center px-6 py-3 bg-lime-600 hover:bg-lime-500 disabled:bg-lime-800 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-all duration-200 animate-aurora-button shadow-lg shadow-lime-500/30">{isLoading ? <> <Loader2 className="animate-spin -ml-1 mr-3 h-5 w-5" />Đang kiểm tra...</> : <>Truy cập <ArrowRightIcon className="w-5 h-5 ml-2" /></> }</button>
                    </form>
                    <a href="https://www.facebook.com/NguyenVanSonss" target="_blank" rel="noopener noreferrer" className="w-full mt-4 flex items-center justify-center px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-colors duration-200"><FacebookIcon className="w-5 h-5 mr-2" />Lấy Mã Truy Cập Miễn Phí</a>
                </div>
                <footer className="text-center mt-16 text-lime-500/70 text-sm flex flex-col items-center">
                    <a href="https://www.facebook.com/NguyenVanSonss" target="_blank" rel="noopener noreferrer" className="hover:underline hover:text-lime-300 transition-colors">PHÁT TRIỂN BỞI RIVER SƠN MASTER</a>
                    <p className="mt-4">Thêm từ khóa phủ định vào cuối mỗi prompt</p>
                    <p>Donate để chúng tôi có động lực phát triển App đẳng cấp hơn nữa, xin cảm ơn!</p>
                    <img alt="QR Code for Bank Transfer" className="w-64 h-64 rounded-lg shadow-lg border-2 border-lime-700 mt-4" src="https://img.vietqr.io/image/TCB-19037518595018-compact2.png?amount=100000&addInfo=TOOL%20AFFILIATE%20VINH%20VIEN&accountName=NGUYEN%20VAN%20SON" />
                </footer>
            </div>
        </div>
    );
};

interface AppCardProps {
    title: string;
    description: string;
    icon: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    index: number;
}
const AppCard: React.FC<AppCardProps> = ({ title, description, icon, onClick, disabled = false, index }) => {
    const baseClasses = "relative group w-full p-6 bg-lime-900 rounded-xl border border-lime-800 flex flex-col items-center text-center transition-all duration-300 animate-fadeInUp";
    const enabledClasses = "hover:border-lime-400 hover:shadow-[0_0_35px_-10px_rgba(132,204,22,0.5)] hover:-translate-y-2 cursor-pointer hover:bg-lime-800";
    const disabledClasses = "opacity-50 cursor-not-allowed";
    const Component = disabled ? 'div' : 'button';

    return (
        <Component onClick={onClick} className={`${baseClasses} ${disabled ? disabledClasses : enabledClasses}`} style={{ animationDelay: `${index * 150}ms` }} disabled={disabled}>
            {disabled && (<div className="absolute top-2 right-2 bg-yellow-500 text-gray-900 text-xs font-bold px-2 py-1 rounded-full">Sắp ra mắt</div>)}
            <div className="mb-4 text-lime-400 group-hover:text-lime-300 transition-colors transform group-hover:scale-110 duration-300">{icon}</div>
            <h3 className="text-xl font-bold text-lime-100 mb-2 group-hover:text-white">{title}</h3>
            <p className="text-sm text-lime-300/70 flex-grow group-hover:text-lime-200">{description}</p>
            {!disabled && (<div className="mt-4 flex items-center text-lime-400 group-hover:text-white transition-colors font-semibold">Vào ứng dụng<ArrowRightIcon className="w-5 h-5 ml-2 transform transition-transform group-hover:translate-x-1" /></div>)}
        </Component>
    );
};

const AppSelectorPage = ({ onSelectDirectorApp, onSelectStorytellerApp, onSelectAffiliateApp, onSelectSeoYoutubeApp, onSelectPromptToolApp, onSelectThumbnailApp, onSelectPromptWizardApp, onOpenApiKeyModal }: {
    onSelectDirectorApp: () => void;
    onSelectStorytellerApp: () => void;
    onSelectAffiliateApp: () => void;
    onSelectSeoYoutubeApp: () => void;
    onSelectPromptToolApp: () => void;
    onSelectThumbnailApp: () => void;
    onSelectPromptWizardApp: () => void;
    onOpenApiKeyModal: () => void;
}) => {
    const apps = [
        { title: "RIVER SƠN MASTER DIRECTOR", description: "Biến ý tưởng thành kịch bản video chi tiết, sẵn sàng cho các công cụ AI tạo video.", icon: <DirectorIcon className="w-20 h-20" />, onClick: onSelectDirectorApp, disabled: false, },
        { title: "RIVER SƠN MASTER STORYTELLING", description: "Tạo kịch bản lồng tiếng chuyên nghiệp cho video YouTube với giọng đọc AI chất lượng cao.", icon: <MicIcon className="w-20 h-20" />, onClick: onSelectStorytellerApp, disabled: false, },
        { title: "Tạo Prompt Video (Nhất Quán)", description: "Tạo kịch bản video chi tiết theo từng bước, đảm bảo tính nhất quán của nhân vật và bối cảnh.", icon: <FileText className="w-20 h-20" />, onClick: onSelectPromptToolApp, disabled: false },
        { title: "Video Affiliate Ngắn", description: "Tạo ảnh và kịch bản quảng cáo sản phẩm với người mẫu AI cho TikTok, Facebook.", icon: <SparklesIcon className="w-20 h-20" />, onClick: onSelectAffiliateApp, disabled: false },
        { title: "AI SEO YouTube", description: "Tối ưu hóa video của bạn cho YouTube với tiêu đề, mô tả và từ khóa do AI tạo.", icon: <SparklesIcon className="w-20 h-20" />, onClick: onSelectSeoYoutubeApp, disabled: false, },
        { title: "Tạo Thumbnail AI", description: "Thiết kế thumbnail YouTube, Facebook hấp dẫn bằng AI, có thể sửa hoặc tạo mới.", icon: <ImageIcon className="w-20 h-20" />, onClick: onSelectThumbnailApp, disabled: false },
        { title: "Trợ lý tạo Prompt Video", description: "Xây dựng prompt video chi tiết một cách nhanh chóng với các trường gợi ý.", icon: <WandIcon className="w-20 h-20" />, onClick: onSelectPromptWizardApp, disabled: false },
        // 4 New Coming Soon Apps
        { title: "Sắp Ra Mắt", description: "Tính năng AI mới đang được phát triển. Vui lòng quay lại sau.", icon: <CubeIcon className="w-20 h-20" />, onClick: () => {}, disabled: true },
        { title: "Sắp Ra Mắt", description: "Tính năng AI mới đang được phát triển. Vui lòng quay lại sau.", icon: <CubeIcon className="w-20 h-20" />, onClick: () => {}, disabled: true },
        { title: "Sắp Ra Mắt", description: "Tính năng AI mới đang được phát triển. Vui lòng quay lại sau.", icon: <CubeIcon className="w-20 h-20" />, onClick: () => {}, disabled: true },
        { title: "Sắp Ra Mắt", description: "Tính năng AI mới đang được phát triển. Vui lòng quay lại sau.", icon: <CubeIcon className="w-20 h-20" />, onClick: () => {}, disabled: true },
    ];
    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-lime-950 text-lime-100 p-4 sm:p-6 lg:p-8">
            <div className="text-center mb-12">
                <h1 className="text-3xl sm:text-4xl font-black py-2 text-aurora-glow-7-colors">CHÀO MỪNG ĐẾN VỚI RIVER SƠN MASTER</h1>
                <div className="flex items-center justify-center flex-wrap gap-3 mt-4">
                    <a href="https://youtube.com/channel/UCUd2-445om-KIlCOlHSDPsQ?sub_confirmation=1" target="_blank" rel="noopener noreferrer" aria-label="Youtube" className="flex items-center justify-center w-11 h-11 rounded-lg text-white transition-all duration-300 transform hover:scale-115 bg-red-600 hover:bg-red-700">
                        <svg viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7"><path d="M21.582,6.186c-0.23-0.86-0.908-1.538-1.768-1.768C18.254,4,12,4,12,4S5.746,4,4.186,4.418 c-0.86,0.23-1.538,0.908-1.768,1.768C2,7.746,2,12,2,12s0,4.254,0.418,5.814c0.23,0.86,0.908,1.538,1.768,1.768 C5.746,20,12,20,12,20s6.254,0,7.814-0.418c0.861-0.23,1.538-0.908,1.768-1.768C22,16.254,22,12,22,12S22,7.746,21.582,6.186z M10,15.464V8.536L16,12L10,15.464z"></path></svg>
                    </a>
                    <a href="https://www.facebook.com/NguyenVanSonss" target="_blank" rel="noopener noreferrer" aria-label="Facebook" className="flex items-center justify-center w-11 h-11 rounded-lg text-white transition-all duration-300 transform hover:scale-115 bg-blue-600 hover:bg-blue-700">
                        <svg viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7"><path d="M14 13.5h2.5l1-4H14v-2c0-1.03 0-2 2-2h1.5V2.14c-.326-.043-1.557-.14-2.857-.14C11.928 2 10 3.657 10 6.7v2.8H7v4h3V22h4v-8.5z"></path></svg>
                    </a>
                    <a href="https://www.tiktok.com/@nguyenvanson1902" target="_blank" rel="noopener noreferrer" aria-label="Tiktok" className="flex items-center justify-center w-11 h-11 rounded-lg text-white transition-all duration-300 transform hover:scale-115 bg-gray-900 hover:bg-gray-800">
                        <svg viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-2.43.05-4.86-.95-6.69-2.81-1.77-1.77-2.69-4.14-2.6-6.6.02-1.28.31-2.57.88-3.73.9-1.86 2.54-3.24 4.5-4.13.57-.25 1.19-.41 1.81-.48v3.86c-.33.04-.66.11-.97.22-1.03.34-1.93 1-2.61 1.82-.69.83-1.11 1.83-1.16 2.86-.05 1.08.28 2.18.9 3.08.62.91 1.52 1.58 2.58 1.95.88.31 1.82.35 2.75.14.93-.21 1.77-.73 2.4-1.45.63-.72 1-1.61 1.11-2.59v-9.35c-1.39.42-2.85.6-4.25.54V.02z"></path></svg>
                    </a>
                    <a href="https://zalo.me/0986196383" target="_blank" rel="noopener noreferrer" aria-label="Zalo" className="flex items-center justify-center w-11 h-11 rounded-lg text-white transition-all duration-300 transform hover:scale-115 bg-blue-500 hover:bg-blue-600">
                        <svg viewBox="0 0 512 512" fill="currentColor" className="w-7 h-7"><path d="M256,0C114.615,0,0,105.29,0,236.235c0,61.905,27.36,118.42,72.715,158.82L29.92,488.085l129.58-31.54 c30.555,9.21,63.15,14.155,96.5,14.155C397.385,470.7,512,365.41,512,234.465C512,105.29,397.385,0,256,0z M176.435,329.515 c-24.02,0-43.5-19.48-43.5-43.5s19.48-43.5,43.5-43.5s43.5,19.48,43.5,43.5S200.455,329.515,176.435,329.515z M335.565,329.515 c-24.02,0-43.5-19.48-43.5-43.5s19.48-43.5,43.5-43.5s43.5,19.48,43.5,43.5S359.585,329.515,335.565,329.515z"></path></svg>
                    </a>
                    <button onClick={onOpenApiKeyModal} className="flex items-center bg-white/60 backdrop-blur-sm border border-lime-500 text-lime-800 font-bold px-4 py-2 rounded-lg shadow-lg shadow-lime-500/10 hover:bg-lime-500/20 hover:text-lime-900 hover:shadow-lime-500/20 transition-all duration-300 transform hover:-translate-y-1 whitespace-nowrap">
                        <ApiKeySettingsIcon className="w-5 h-5 mr-2" /> Cài đặt API Key
                    </button>
                </div>
                <p className="mt-4 text-lg text-lime-200 max-w-2xl mx-auto">Chọn một ứng dụng để bắt đầu hành trình sáng tạo của bạn.</p>
            </div>
            <div className="w-full max-w-5xl mx-auto">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
                    {apps.map((app, index) => (
                        <AppCard key={index} {...app} index={index} />
                    ))}
                </div>
            </div>
            <footer className="text-center mt-16 text-lime-500/70 text-sm flex flex-col items-center">
                <a href="https://www.facebook.com/NguyenVanSonss" target="_blank" rel="noopener noreferrer" className="hover:underline hover:text-lime-300 transition-colors">PHÁT TRIỂN BỞI RIVER SƠN MASTER</a>
                <p className="mt-4">Thêm từ khóa phủ định vào cuối mỗi prompt</p>
                <p>Donate để chúng tôi có động lực phát triển App đẳng cấp hơn nữa, xin cảm ơn!</p>
                <img alt="QR Code for Bank Transfer" className="w-64 h-64 rounded-lg shadow-lg border-2 border-lime-700 mt-4" src="https://img.vietqr.io/image/TCB-19037518595018-compact2.png?amount=100000&addInfo=TOOL%20AFFILIATE%20VINH%20VIEN&accountName=NGUYEN%20VAN%20SON" />
            </footer>
        </div>
    );
};


const LoadingFallback = () => (
    <div className="flex items-center justify-center min-h-screen bg-lime-950 text-lime-100 p-4">
        <div className="flex flex-col items-center gap-4">
            <Loader2 className="animate-spin h-8 w-8 text-lime-400" />
            <span className="text-lg font-semibold text-lime-200">Đang tải ứng dụng...</span>
        </div>
    </div>
);


const App = () => {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState('login'); // 'login', 'selector', 'director', 'storyteller', 'affiliate', 'seoYoutube', 'promptTool', 'promptWizard', 'thumbnail'

    // API Key Management State
    const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);
    const [apiKeys, setApiKeys] = useState<string[]>([]);
    const [apiKeyStatuses, setApiKeyStatuses] = useState<{ [key: string]: 'ready' | 'exhausted' | 'invalid' | 'error' | 'checking' }>({});

    useEffect(() => {
        const checkAuth = async () => {
            const authDataString = localStorage.getItem("riverson_if0_40180124");
            if (!authDataString) {
                setIsAuthenticated(false);
                setIsLoading(false);
                return;
            }
            try {
                const authData = JSON.parse(authDataString);
                if (["anhchiyeuem81@", "doanhchuwit@", "vipvinhvien@"].includes(authData.token)) {
                    setIsAuthenticated(true);
                    setCurrentPage('selector');
                    setIsLoading(false);
                    return;
                }
                const currentDate = new Date().toISOString().split('T')[0];
                if (authData.lastCheckDate === currentDate) {
                    setIsAuthenticated(true);
                    setCurrentPage('selector');
                } else {
                    const AUTH_URL = 'https://script.google.com/macros/s/AKfycby5Y3n-L-2B53924a_FP59B6gtSBE5h7v1TjV-A4R3gGvS2S2s02iC99yZkCh94bMqy/exec';
                    const response = await fetch(AUTH_URL);
                    if (!response.ok) throw new Error("Không thể kết nối đến máy chủ xác thực.");
                    const remoteAuthData = await response.json();
                    const validToken = remoteAuthData.find((item: any) => item.token === authData.token);
                    if (!validToken) throw new Error("Mã truy cập không còn hợp lệ.");
                    const expires = new Date(validToken.expires);
                    expires.setHours(23, 59, 59, 999);
                    if (new Date() > expires) throw new Error("Mã truy cập đã hết hạn.");
                    const updatedAuthStorage = { ...authData, lastCheckDate: currentDate };
                    localStorage.setItem("riverson_if0_40180124", JSON.stringify(updatedAuthStorage));
                    setIsAuthenticated(true);
                    setCurrentPage('selector');
                }
            } catch (error) {
                console.error("Daily auth check failed:", error);
                localStorage.removeItem("riverson_if0_40180124");
                setIsAuthenticated(false);
            } finally {
                setIsLoading(false);
            }
        };
        checkAuth();

        const storedKeys = localStorage.getItem("gemini-api-keys");
        if (storedKeys) {
            const parsedKeys = JSON.parse(storedKeys);
            if (Array.isArray(parsedKeys) && parsedKeys.length > 0) {
              setApiKeys(parsedKeys);
              const initialStatuses: { [key: string]: 'ready' | 'exhausted' | 'invalid' | 'error' | 'checking' } = {};
              parsedKeys.forEach((key) => {
                initialStatuses[key] = 'ready'; // Assume ready on load, validation happens in tools
              });
              setApiKeyStatuses(initialStatuses);
            }
        }
    }, []);

    const handleSaveApiKeys = useCallback(async (keys: string[]) => {
        localStorage.setItem("gemini-api-keys", JSON.stringify(keys));
        setApiKeys(keys);
        setIsApiKeyModalOpen(false);
        
        const checkingStatuses: { [key: string]: 'ready' | 'exhausted' | 'invalid' | 'error' | 'checking' } = {};
        keys.forEach(key => {
            checkingStatuses[key] = 'checking';
        });
        setApiKeyStatuses(checkingStatuses);

        const newStatuses: { [key: string]: 'ready' | 'exhausted' | 'invalid' | 'error' | 'checking' } = {};
        for (const key of keys) {
            newStatuses[key] = await geminiService.validateApiKey(key);
        }
        setApiKeyStatuses(newStatuses);
    }, []);

    const handleLoginSuccess = () => {
        setIsAuthenticated(true);
        setCurrentPage('selector');
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-lime-950 text-lime-100 p-4">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="animate-spin h-8 w-8 text-lime-400" />
                    <span className="text-lg font-semibold text-lime-200">Đang kiểm tra phiên đăng nhập...</span>
                </div>
            </div>
        );
    }

    const renderPage = () => {
        if (!isAuthenticated) {
            return <LoginPage onLoginSuccess={handleLoginSuccess} />;
        }
        switch (currentPage) {
            case 'selector':
                return <AppSelectorPage
                    onSelectDirectorApp={() => setCurrentPage('director')}
                    onSelectStorytellerApp={() => setCurrentPage('storyteller')}
                    onSelectAffiliateApp={() => setCurrentPage('affiliate')}
                    onSelectSeoYoutubeApp={() => setCurrentPage('seoYoutube')}
                    onSelectPromptToolApp={() => setCurrentPage('promptTool')}
                    onSelectPromptWizardApp={() => setCurrentPage('promptWizard')}
                    onSelectThumbnailApp={() => setCurrentPage('thumbnail')}
                    onOpenApiKeyModal={() => setIsApiKeyModalOpen(true)}
                />;
            case 'director':
                return <DirectorPage onBack={() => setCurrentPage('selector')} />;
            case 'storyteller':
                return <StorytellerPage onBack={() => setCurrentPage('selector')} />;
            case 'affiliate':
                return <AffiliatePage onBack={() => setCurrentPage('selector')} />;
            case 'seoYoutube':
                return <SeoYoutubePage onBack={() => setCurrentPage('selector')} />;
            case 'promptTool':
                return <PromptToolPage onBack={() => setCurrentPage('selector')} />;
            case 'promptWizard':
                return <PromptWizardPage onBack={() => setCurrentPage('selector')} />;
            case 'thumbnail':
                return <ThumbnailGeneratorPage onBack={() => setCurrentPage('selector')} />;
            default:
                return <LoginPage onLoginSuccess={handleLoginSuccess} />;
        }
    }

    return (
        <>
            <ApiKeyModal 
                isOpen={isApiKeyModalOpen} 
                onClose={() => setIsApiKeyModalOpen(false)} 
                onSave={handleSaveApiKeys} 
                initialKeys={apiKeys} 
            />
            <Suspense fallback={<LoadingFallback />}>
                {renderPage()}
            </Suspense>
        </>
    );
};

export default App;
