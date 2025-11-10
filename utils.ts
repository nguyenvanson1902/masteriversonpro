// --- AUDIO UTILS ---

/**
 * Decodes a base64 string into a Uint8Array.
 * @param base64 The base64 string to decode.
 * @returns A Uint8Array containing the decoded binary data.
 */
export function decode(base64) {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
}

/**
 * Decodes raw PCM audio data into an AudioBuffer for playback.
 * @param data The raw PCM data as a Uint8Array.
 * @param ctx The AudioContext to use for decoding.
 * @param sampleRate The sample rate of the audio (e.g., 24000).
 * @param numChannels The number of audio channels (e.g., 1 for mono).
 * @returns A promise that resolves to an AudioBuffer.
 */
export async function decodeAudioData(
    data,
    ctx,
    sampleRate,
    numChannels,
) {
    const dataInt16 = new Int16Array(data.buffer);
    const frameCount = dataInt16.length / numChannels;
    const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

    for (let channel = 0; channel < numChannels; channel++) {
        const channelData = buffer.getChannelData(channel);
        for (let i = 0; i < frameCount; i++) {
            channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
        }
    }
    return buffer;
}

/**
 * Creates a WAV file Blob from raw PCM audio data.
 * @param pcmData The raw PCM data as a Uint8Array.
 * @returns A Blob representing the WAV file.
 */
export function createWavBlob(pcmData) {
    const numChannels = 1;
    const sampleRate = 24000;
    const bytesPerSample = 2; // 16-bit
    const blockAlign = numChannels * bytesPerSample;
    const byteRate = sampleRate * blockAlign;
    const dataSize = pcmData.length;
    const buffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(buffer);

    // RIFF header
    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    writeString(view, 8, 'WAVE');
    // "fmt " sub-chunk
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); // PCM
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bytesPerSample * 8, true);
    // "data" sub-chunk
    writeString(view, 36, 'data');
    view.setUint32(40, dataSize, true);
    // Write PCM data
    new Uint8Array(buffer, 44).set(pcmData);

    return new Blob([buffer], { type: 'audio/wav' });
}

function writeString(view, offset, string) {
    for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
    }
}


// --- ERROR HANDLING UTILS ---

export const API_LIMIT_ERROR_MESSAGE = "Tất cả các API key hiện tại đều đã hết hạn mức hoặc không hợp lệ. Vui lòng kiểm tra lại hoặc thêm key mới.";

export function isRateLimitError(err) {
    const message = err?.toString().toLowerCase() || '';
    return message.includes('429') || message.includes('quota') || message.includes('rate limit');
}

export function isInvalidApiKeyError(err) {
    const message = err?.toString().toLowerCase() || '';
    return message.includes('api key not valid') || message.includes('permission denied');
}

export function getApiErrorMessage(err) {
    if (err instanceof Error) {
        return err.message;
    }
    return 'Đã xảy ra một lỗi không xác định. Vui lòng kiểm tra console để biết thêm chi tiết.';
}
