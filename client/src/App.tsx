import { useState, useRef } from 'react';
import './App.css';
import AssemblyClient from './AssemblyClient';
import { createMicrophone, type Microphone } from './microphone';

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

function MyApp() {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('Click start to begin recording!');
  const [error, setError] = useState<string | null>(null);
  const [toolCalls, setToolCalls] = useState<ToolCall[]>([]);
  const [isProcessingChat, setIsProcessingChat] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);

  const assemblyClientRef = useRef<AssemblyClient | null>(null);
  const microphoneRef = useRef<Microphone | null>(null);

  const startRecording = async () => {

    setChatMessages([])

    try {
      setError(null);

      // Create microphone
      microphoneRef.current = createMicrophone();
      await microphoneRef.current.requestPermission();

      // Create AssemblyAI client
      assemblyClientRef.current = new AssemblyClient({
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

      const response = await fetch('http://localhost:3001/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages,
          serverConfig: {
            url: "http://localhost:3040/mcp", // Default MCP server URL
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
      const reader = await fetch('http://localhost:3001/chat/tool-call-approvals', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: chatMessages,
          serverConfig: {
            url: "http://localhost:3040/mcp",
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
    <div className="App">
      <h1 style={{ color: 'white' }}>🎤 Real-Time Transcription & MCP Flow</h1>

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
      </div>

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
        textAlign: 'left'
      }}>
        <h3>Transcript:</h3>
        <p style={{ fontSize: '16px', lineHeight: '1.5' }}>
          {transcript}
        </p>
      </div>

      {/* Debug info */}
      <div style={{ color: 'white', margin: '10px 0', fontSize: '12px' }}>
        Debug: Tool calls count: {toolCalls.length}
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