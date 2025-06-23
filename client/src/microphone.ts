export interface Microphone {
    requestPermission(): Promise<void>;

    startRecording(onAudioCallback: (audioChunk: Uint8Array) => void): Promise<void>;

    stopRecording(): void;
}

export function createMicrophone(): Microphone {
    let stream: MediaStream | null = null;
    let audioContext: AudioContext | null = null;
    let audioWorkletNode: AudioWorkletNode | null = null;
    let source: MediaStreamAudioSourceNode | null = null;
    let audioBufferQueue = new Int16Array(0);

    return {
        async requestPermission() {
            stream = await navigator.mediaDevices.getUserMedia({audio: true});
        },

        async startRecording(onAudioCallback: (audioChunk: Uint8Array) => void) {
            if (!stream) {
                stream = await navigator.mediaDevices.getUserMedia({audio: true});
            }

            audioContext = new AudioContext({
                latencyHint: 'balanced',
                sampleRate: 16000,
            });

            source = audioContext.createMediaStreamSource(stream);
            await audioContext.audioWorklet.addModule('audio-processor.js');

            audioWorkletNode = new AudioWorkletNode(audioContext, 'audio-processor');
            source.connect(audioWorkletNode);
            audioWorkletNode.connect(audioContext.destination);

            audioWorkletNode.port.onmessage = (event) => {
                const currentBuffer = new Int16Array(event.data.audio_data);
                audioBufferQueue = mergeBuffers(audioBufferQueue, currentBuffer);

                const bufferDuration = (audioBufferQueue.length / audioContext!.sampleRate) * 1000;

                if (bufferDuration >= 100) {
                    const totalSamples = Math.floor(audioContext!.sampleRate * 0.1);
                    const finalBuffer = new Uint8Array(audioBufferQueue.subarray(0, totalSamples).buffer);
                    audioBufferQueue = audioBufferQueue.subarray(totalSamples);

                    if (onAudioCallback) {
                        onAudioCallback(finalBuffer);
                    }
                }
            };
        },

        stopRecording() {
            stream?.getTracks().forEach((track) => track.stop());
            audioContext?.close().catch(err => console.error(err));
            audioBufferQueue = new Int16Array(0);
            stream = null;
            audioContext = null;
            audioWorkletNode = null;
            source = null;
        },
    };
}

function mergeBuffers(lhs: Int16Array, rhs: Int16Array): Int16Array {
    const merged = new Int16Array(lhs.length + rhs.length);
    merged.set(lhs, 0);
    merged.set(rhs, lhs.length);
    return merged;
}