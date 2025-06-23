export interface TranscriptionTurn {
    transcript: string;
    turn_order: number;
}

export interface AssemblyClientOptions {
    apiKey?: string;
    onConnected?: () => void;
    onDisconnected?: () => void;
    onError?: (error: string) => void;
    onTranscription?: (transcript: string) => void;
}

export default class AssemblyClient {
    private webSocket: WebSocket | null = null;
    private turns: Record<number, string> = {};
    private options: AssemblyClientOptions;

    constructor(options: AssemblyClientOptions = {}) {
        this.options = options;
    }

    public async connect(): Promise<void> {
        try {

            const apiKey = this.options.apiKey || import.meta.env.VITE_ASSEMBLYAI_API_KEY;

            if (!apiKey) {
                throw new Error('API key is required. Please provide it via options or set VITE_ASSEMBLYAI_API_KEY environment variable');
            }

            const endpoint = `wss://streaming.assemblyai.com/v3/ws?sample_rate=16000&formatted_finals=true&token=${apiKey}`;
            this.webSocket = new WebSocket(endpoint);

            this.webSocket.onopen = () => {
                console.log('Connected to AssemblyAI');
                this.options.onConnected?.();
            };

            this.webSocket.onmessage = (event) => {
                const msg = JSON.parse(event.data);
                if (msg.type === 'Turn') {
                    const {transcript, turn_order} = msg as TranscriptionTurn;
                    this.turns[turn_order] = transcript;

                    const orderedTurns = Object.keys(this.turns)
                        .sort((a, b) => Number(a) - Number(b))
                        .map((k) => this.turns[Number(k)])
                        .join(' ');

                    this.options.onTranscription?.(orderedTurns);
                }
            };

            this.webSocket.onerror = (err) => {
                console.error('WebSocket error:', err);
                this.options.onError?.('WebSocket error occurred');
            };

            this.webSocket.onclose = () => {
                console.log('WebSocket closed');
                this.options.onDisconnected?.();
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.error('Connection error:', errorMessage);
            this.options.onError?.(errorMessage);
        }
    }

    public sendAudio(audioChunk: Uint8Array): void {
        if (this.webSocket && this.webSocket.readyState === WebSocket.OPEN) {
            this.webSocket.send(audioChunk);
        }
    }

    public stop(): void {
        if (this.webSocket) {
            this.webSocket.send(JSON.stringify({type: 'Terminate'}));
            this.webSocket.close();
            this.webSocket = null;
        }
        this.turns = {};
    }
}