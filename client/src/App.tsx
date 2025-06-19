import { useState, useRef, useEffect } from 'react';
import AssemblyClient from './AssemblyClient';
import { createMicrophone, type Microphone } from './microphone';
import { Settings } from './Settings';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const SETTINGS_STORAGE_KEY = 'mcp-flow-settings';

interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

interface ChatMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: any;
}

interface SettingsState {
  serverUrl: string;
  apiKey: string;
}

const defaultSettings: SettingsState = {
  serverUrl: '',
  apiKey: ''
};

function MyApp() {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('Click start to begin recording!');
  const [error, setError] = useState<string | null>(null);
  const [toolCalls, setToolCalls] = useState<ToolCall[]>([]);
  const [isProcessingChat, setIsProcessingChat] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState<SettingsState>(defaultSettings);

  const assemblyClientRef = useRef<AssemblyClient | null>(null);
  const microphoneRef = useRef<Microphone | null>(null);

  useEffect(() => {
    try {
      const savedSettings = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (savedSettings) {
        const parsedSettings = JSON.parse(savedSettings);
        setSettings({ ...defaultSettings, ...parsedSettings });
      }
    } catch (error) {
      console.error('Failed to load settings from localStorage:', error);
      // If there's an error, use default settings
      setSettings(defaultSettings);
    }
  }, []);

  const handleSettingsChange = (newSettings: SettingsState) => {
    console.log("Settings saved:", newSettings);
    setSettings(newSettings);
    
    // Save to localStorage
    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(newSettings));
      console.log("Settings saved to localStorage");
    } catch (error) {
      console.error('Failed to save settings to localStorage:', error);
      setError('Failed to save settings to local storage');
    }
    
    setError(null);
  };

  const startRecording = async () => {

    setChatMessages([])

    try {
      setError(null);

      // Create microphone
      microphoneRef.current = createMicrophone();
      await microphoneRef.current.requestPermission();

      // Create AssemblyAI client with API key from settings
      assemblyClientRef.current = new AssemblyClient({
        apiKey: settings.apiKey,
        onTranscription: (transcript) => {
          setTranscript(transcript);
        },
        onError: (error) => {
          setError(error);
          setIsRecording(false);
        },
        onConnected: () => {
          console.log("Connected to AssemblyAI!");
          // Start recording audio once connected
          microphoneRef.current?.startRecording((audioChunk) => {
            assemblyClientRef.current?.sendAudio(audioChunk);
          });
        },
        onDisconnected: () => {
          console.log("Disconnected from AssemblyAI");
        }
      });

      await assemblyClientRef.current.connect();
      setIsRecording(true);
      setTranscript("Connected! Speak now...");

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      setError(errorMessage);
      console.error('Failed to start recording:', errorMessage);
    }
  };

  const stopRecording = () => {
    if (assemblyClientRef.current) {
      assemblyClientRef.current.stop();
      assemblyClientRef.current = null;
    }

    if (microphoneRef.current) {
      microphoneRef.current.stopRecording();
      microphoneRef.current = null;
    }

    setIsRecording(false);
  };

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const sendToChat = async () => {
    if (!transcript || transcript === 'Click start to begin recording!' || transcript === "Connected! Speak now...") {
      setError("No transcript available to send");
      return;
    }

    setIsProcessingChat(true);
    setError(null);
    setToolCalls([]);

    try {
      const messages: ChatMessage[] = [
        ...chatMessages,
        { role: 'user', content: transcript }
      ];

      setChatMessages(messages);

      const response = await fetch(`${BASE_URL}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages,
          serverConfig: {
            url: settings.serverUrl, // Use serverUrl from settings
            headers: {}
          }
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      const chunks: string[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const string = new TextDecoder().decode(value);
        chunks.push(string);

        console.log("Received chunk:", string);
      }

      // Parse the final response to extract tool calls
      try {
        const finalResponse = JSON.parse(chunks[chunks.length - 1]);
        console.log("Final response:", finalResponse);

        if (finalResponse.messages) {
          // Look for tool calls in the assistant messages
          finalResponse.messages.forEach((message: any) => {

            setChatMessages(prev => [...prev, message]);

            if (message.role === 'assistant' && Array.isArray(message.content)) {
              const toolCallItems = message.content.filter((item: any) => item.type === 'tool-call');
              if (toolCallItems.length > 0) {
                console.log('Tool calls detected:', toolCallItems);
                const newToolCalls = toolCallItems.map((item: any) => ({
                  id: item.toolCallId,
                  type: 'function' as const,
                  function: {
                    name: item.toolName,
                    arguments: JSON.stringify(item.args)
                  }
                }));

                setToolCalls(newToolCalls);
                console.log('Updated tool calls:', newToolCalls);
              }
            }
          });
        }
      } catch (error) {
        console.error("Failed to parse final response:", error);
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      setError(`Failed to send to chat: ${errorMessage}`);
      console.error('Failed to send to chat:', errorMessage);
    } finally {
      setIsProcessingChat(false);
    }
  };

  const approveToolCalls = async (approvedIds: string[]) => {
    setIsProcessingChat(true);
    setError(null);

    try {
      const reader = await fetch(`${BASE_URL}/api/chat/tool-call-approvals`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: chatMessages,
          serverConfig: {
            url: settings.serverUrl,
            headers: {}
          },
          approvedToolCallIds: approvedIds
        }),
      })
        .then((res) => {
          if (!res.ok) {
            throw new Error("Failed to fetch response");
          }
          return res.body?.getReader();
        })
        .catch((error) => {
          console.error("Error fetching response:", error);
          return null;
        });

      if (!reader) {
        console.error("Failed to get reader from response");
        return;
      }

      const chunks: string[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const string = new TextDecoder().decode(value);
        chunks.push(string);

        console.log("Received chunk:", string);
      }

      try {
        const finalResponse = JSON.parse(chunks[chunks.length - 1]);
        console.log("Tool approval final response:", finalResponse);

        // Update chat messages with the response
        if (finalResponse.messages) {
          setChatMessages(prev => [...prev, ...finalResponse.messages]);
        }
      } catch (error) {
        console.error("Failed to parse final response:", error);
        return;
      }

      // Clear tool calls after approval
      setToolCalls([]);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      setError(`Failed to execute tool calls: ${errorMessage}`);
      console.error('Failed to execute tool calls:', errorMessage);
    } finally {
      setIsProcessingChat(false);
    }
  };

  return (
    <div className="App" style={{ width: "100vw", height: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
      <h1 style={{ color: 'white' }}>🎤 MCP Flow</h1>

      <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', margin: '20px 0' }}>
        <button
          onClick={toggleRecording}
          style={{
            padding: '20px 40px',
            fontSize: '18px',
            backgroundColor: isRecording ? '#f44336' : '#4CAF50',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer'
          }}
        >
          {isRecording ? 'Stop Recording' : 'Start Recording'}
        </button>

        <button
          onClick={sendToChat}
          disabled={isProcessingChat || !transcript || transcript === 'Click start to begin recording!' || transcript === "Connected! Speak now..."}
          style={{
            padding: '20px 40px',
            fontSize: '18px',
            backgroundColor: isProcessingChat ? '#757575' : '#2196F3',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: isProcessingChat ? 'not-allowed' : 'pointer',
            opacity: isProcessingChat ? 0.6 : 1
          }}
        >
          {isProcessingChat ? 'Processing...' : 'Send to Chat'}
        </button>

        <button
          onClick={() => setShowSettings(!showSettings)}
          style={{
            padding: '20px 40px',
            fontSize: '18px',
            backgroundColor: '#FF9800',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer'
          }}
        >
          ⚙️ Settings
        </button>
      </div>

      {showSettings && (
        <>
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            zIndex: 999
          }} onClick={() => setShowSettings(false)} />
          <div style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '50%',
            maxWidth: '600px',
            zIndex: 1000,
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1), 0 1px 3px rgba(0, 0, 0, 0.08)',
            backgroundColor: '#1a1a1a',
            padding: '20px',
            borderRadius: '12px'
          }}>
            <button
              onClick={() => setShowSettings(false)}
              style={{
                position: 'absolute',
                top: '10px',
                right: '10px',
                background: 'none',
                border: 'none',
                color: 'white',
                fontSize: '20px',
                cursor: 'pointer'
              }}
            >
              ✕
            </button>
            <Settings onChange={handleSettingsChange} settings={settings} />
          </div>
        </>
      )}

      {error && (
        <div style={{
          padding: '10px',
          backgroundColor: '#ffebee',
          color: '#c62828',
          border: '1px solid #f8bbd9',
          borderRadius: '4px',
          margin: '10px 0'
        }}>
          Error: {error}
        </div>
      )}

      <div style={{
        margin: '20px 0',
        padding: '20px',
        backgroundColor: '#000000',
        borderRadius: '8px',
        minHeight: '100px',
        textAlign: 'left',
        width: "50%"
      }}>
        <h3>Transcript:</h3>
        <p style={{ fontSize: '16px', lineHeight: '1.5' }}>
          {transcript}
        </p>
      </div>

      {toolCalls.length > 0 && (
        <div style={{
          margin: '20px 0',
          padding: '20px',
          backgroundColor: '#1a1a1a',
          borderRadius: '8px',
          border: '2px solid #4CAF50'
        }}>
          <h3 style={{ color: 'white', marginBottom: '15px' }}>🔧 Tool Calls Detected:</h3>
          {toolCalls.map((toolCall) => (
            <div key={toolCall.id} style={{
              backgroundColor: '#2a2a2a',
              padding: '15px',
              borderRadius: '6px',
              marginBottom: '10px',
              border: '1px solid #444'
            }}>
              <div style={{ color: '#4CAF50', fontWeight: 'bold', marginBottom: '8px' }}>
                Function: {toolCall.function.name}
              </div>
              <div style={{ color: '#ccc', fontSize: '14px', fontFamily: 'monospace' }}>
                Arguments: {toolCall.function.arguments || '{}'}
              </div>
            </div>
          ))}

          <div style={{ marginTop: '20px', display: 'flex', gap: '10px' }}>
            <button
              onClick={() => approveToolCalls(toolCalls.map(tc => tc.id))}
              disabled={isProcessingChat}
              style={{
                padding: '10px 20px',
                backgroundColor: '#4CAF50',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: isProcessingChat ? 'not-allowed' : 'pointer',
                opacity: isProcessingChat ? 0.6 : 1
              }}
            >
              ✅ Approve All
            </button>

            <button
              onClick={() => setToolCalls([])}
              disabled={isProcessingChat}
              style={{
                padding: '10px 20px',
                backgroundColor: '#f44336',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: isProcessingChat ? 'not-allowed' : 'pointer',
                opacity: isProcessingChat ? 0.6 : 1
              }}
            >
              ❌ Reject All
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default MyApp;