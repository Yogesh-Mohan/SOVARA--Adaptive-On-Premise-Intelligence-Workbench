import { useState, useRef, useEffect } from 'react';
import { Paperclip, Image as ImageIcon, Wrench, Code, Send, FileCheck, X } from 'lucide-react';
import { open } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';
import { useSystemHardware } from '../hooks/useSystemHardware';
import { analyzeHardware } from '../services/hardwareAnalysis/hardwareAnalyzer';
import { analyzeTask } from '../services/taskAnalysis/taskAnalyzer';
import type { TaskAnalysisResult } from '../services/taskAnalysis/taskTypes';
import { selectBestModel } from '../services/iramr/iramr';
import type { IRAMRResult } from '../services/iramr/iramrTypes';
import { runtimeManager } from '../services/runtimeManager/runtimeManager';
import RuntimeStatusPanel from './RuntimeStatusPanel';

interface Attachment {
  fileName: string;
  fileSize: string;
  fileType: string;
  filePath: string;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  attachment?: Attachment;
  taskAnalysis?: TaskAnalysisResult;
  iramrResult?: IRAMRResult;
  timestamp: number;
}

export default function ChatArea() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const { hardware } = useSystemHardware(2000);
  
  const endOfMessagesRef = useRef<HTMLDivElement>(null);
  
  // Auto-scroll to bottom
  useEffect(() => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const getFileTypeLabel = (extension: string | undefined): string => {
    if (!extension) return 'Document';
    const ext = extension.toLowerCase();
    if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext)) return 'Image';
    if (['pdf'].includes(ext)) return 'PDF Document';
    if (['csv', 'xlsx'].includes(ext)) return 'Spreadsheet';
    if (['json', 'ts', 'js', 'rs', 'py'].includes(ext)) return 'Source Code';
    return 'Document';
  };

  const handleSelectFile = async () => {
    if (!window.__TAURI_INTERNALS__) {
      console.warn('File dialog requires Tauri desktop shell');
      return;
    }
    try {
      const selected = await open({
        multiple: false,
        filters: [{
          name: 'Supported AI Workloads',
          extensions: ['pdf', 'docx', 'txt', 'csv', 'xlsx', 'png', 'jpg', 'jpeg', 'json', 'ts', 'js', 'rs', 'py']
        }]
      });

      if (selected && typeof selected === 'string') {
        const fileName = selected.split(/[/\\]/).pop() || 'Unknown File';
        const extension = fileName.split('.').pop();
        
        setAttachment({
          fileName,
          fileSize: 'Local File',
          fileType: getFileTypeLabel(extension),
          filePath: selected
        });
      }
    } catch (err) {
      console.error("Failed to open file dialog", err);
    }
  };

  const handleSubmit = async () => {
    const text = inputValue.trim();
    if (!text && !attachment) return;

    const taskAnalysis = analyzeTask(text, attachment);
    const hardwareAnalysis = analyzeHardware(hardware);
    const iramrResult = selectBestModel(taskAnalysis, hardwareAnalysis);

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      attachment: attachment ? { ...attachment } : undefined,
      taskAnalysis,
      iramrResult,
      timestamp: Date.now()
    };

    const assistantMsgId = (Date.now() + 1).toString();
    const assistantMessage: Message = {
      id: assistantMsgId,
      role: 'assistant',
      content: '',
      timestamp: Date.now() + 1
    };

    setMessages(prev => [...prev, userMessage, assistantMessage]);
    setInputValue('');
    setAttachment(null);
    setIsGenerating(true);

    try {
      // Step 1: Prepare and load the selected model
      let modelId = iramrResult.selectedModelId.toLowerCase().includes('tinyllama') 
        ? "tinyllama" 
        : "qwen2.5-1.5b";

      let config = await runtimeManager.prepareModelRuntime(modelId);
      
      // Fallback: If the selected model is corrupted/missing, try the other one
      if (!config) {
          const fallbackModelId = modelId === "tinyllama" ? "qwen2.5-1.5b" : "tinyllama";
          console.warn(`Primary model ${modelId} failed. Falling back to ${fallbackModelId}...`);
          modelId = fallbackModelId;
          config = await runtimeManager.prepareModelRuntime(modelId);
      }

      if (!config) {
          throw new Error(`Failed to configure runtime. Both models appear to be missing or corrupted.`);
      }

      await invoke('start_server', { 
          modelId: config.modelId,
          filename: config.selectedVariant,
          ngl: config.gpuOffloadLayers
      }).catch(e => {
        throw new Error(`Model server start failed: ${e}.`);
      });

      // Poll /health until llama-server is ready (model loading takes 5-15 seconds)
      const serverReady = await (async () => {
        const maxWaitMs = 30000;
        const pollIntervalMs = 500;
        const deadline = Date.now() + maxWaitMs;
        while (Date.now() < deadline) {
          try {
            const h = await fetch("http://127.0.0.1:8085/health");
            if (h.ok) {
              const body = await h.json().catch(() => ({}));
              if (!body.status || body.status === "ok" || body.status === "no slot available") {
                return true;
              }
            }
          } catch {
            // server not yet listening — keep waiting
          }
          await new Promise(r => setTimeout(r, pollIntervalMs));
        }
        return false;
      })();

      if (!serverReady) {
        throw new Error("LLaMA Server did not become ready within 30 seconds.");
      }

      runtimeManager.updateStatus('Generating');
      
      const startTime = performance.now();
      let tokenCount = 0;

      // Build the prompt — include file content when an attachment was provided
      let documentContent: string | null = null;
      const currentAttachment = userMessage.attachment;
      if (currentAttachment) {
        try {
          documentContent = await invoke<string>('read_file_content', { filePath: currentAttachment.filePath });
        } catch (fileErr: any) {
          // Surface unsupported format errors clearly in the chat
          if (typeof fileErr === 'string' && (
            fileErr.startsWith('PDF_NOT_SUPPORTED_YET') ||
            fileErr.startsWith('DOCX_NOT_SUPPORTED_YET') ||
            fileErr.startsWith('XLSX_NOT_SUPPORTED_YET') ||
            fileErr.startsWith('IMAGE_FILE')
          )) {
            throw new Error(fileErr.split(':').slice(1).join(':').trim());
          }
          console.warn('Could not read attachment:', fileErr);
        }
      }

      // Step 2: Build prompt with optional document context
      const userContent = documentContent
        ? `The following document is attached:\n\n---\n${documentContent}\n---\n\n${text || 'Please summarize the document above.'}`
        : text;

      const promptText = `<|im_start|>user\n${userContent}<|im_end|>\n<|im_start|>assistant\n`;
      
      const response = await fetch("http://127.0.0.1:8085/completion", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          prompt: promptText,
          n_predict: 512,
          stream: true
        })
      });

      if (!response.ok) {
        throw new Error(`LLaMA Server Error: ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder("utf-8");

      if (!reader) throw new Error("No response body");

      let done = false;
      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        if (value) {
          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const dataStr = line.slice(6);
              if (dataStr.trim() === '[DONE]') continue;
              
              try {
                const data = JSON.parse(dataStr);
                tokenCount++;
                setMessages(prev => prev.map(msg => {
                  if (msg.id === assistantMsgId) {
                    return { ...msg, content: msg.content + (data.content || '') };
                  }
                  return msg;
                }));
                
                // Update realtime speed
                const elapsedSec = (performance.now() - startTime) / 1000;
                if (elapsedSec > 1) {
                    runtimeManager.updateStatus('Generating', tokenCount / elapsedSec);
                }
              } catch (e) {
                console.error("Failed to parse SSE data", dataStr);
              }
            }
          }
        }
      }

      const totalElapsedSec = (performance.now() - startTime) / 1000;
      runtimeManager.updateStatus('Ready', tokenCount / totalElapsedSec);
      setIsGenerating(false);

    } catch (e: any) {
      runtimeManager.updateStatus('Error');
      setMessages(prev => prev.map(msg => {
        if (msg.id === assistantMsgId) {
          return { ...msg, content: `Error: ${e.message || e.toString()}` };
        }
        return msg;
      }));
      setIsGenerating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <main className="flex-1 flex flex-col bg-bg-main relative h-full overflow-hidden">
      
      {/* Chat Messages Area */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="max-w-3xl mx-auto w-full px-4 pt-12 pb-32">
          
          <div className="space-y-8">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center pt-20 text-text-muted">
                <div className="w-16 h-16 mb-4 rounded-2xl bg-bg-panel border border-border-subtle flex items-center justify-center text-primary/50">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>
                </div>
                <h3 className="text-lg font-bold text-text-main mb-2">How can Sovereign AI help you?</h3>
                <p className="text-sm max-w-sm text-center">Your chats and attachments stay 100% locally on your machine. Start by typing a message or attaching a file.</p>
              </div>
            ) : (
              messages.map((msg) => (
                <div key={msg.id} className="flex gap-4 items-start animate-in fade-in slide-in-from-bottom-2">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-1 ${
                    msg.role === 'user' 
                      ? 'bg-bg-panel border border-border-subtle text-text-muted'
                      : 'bg-primary text-white shadow-[0_0_15px_rgba(59,130,246,0.3)]'
                  }`}>
                    {msg.role === 'user' ? 'EA' : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-text-main mb-1">
                      {msg.role === 'user' ? 'You' : 'Sovereign AI'}
                    </div>
                    {msg.content && (
                      <div className="text-text-main text-base leading-relaxed whitespace-pre-wrap">
                        {msg.content}
                      </div>
                    )}
                    
                    {msg.attachment && (
                      <div className={`flex items-center gap-3 p-3 bg-bg-panel rounded-xl border border-border-subtle w-fit mt-3 ${msg.content ? '' : 'mt-1'}`}>
                        <div className="w-10 h-10 rounded-lg bg-bg-main flex items-center justify-center text-primary border border-border-subtle shrink-0">
                          <FileCheck size={20} />
                        </div>
                        <div className="pr-2">
                          <div className="text-sm font-medium text-text-main truncate max-w-[200px]" title={msg.attachment.fileName}>
                            {msg.attachment.fileName}
                          </div>
                          <div className="text-xs text-text-muted">{msg.attachment.fileType} • {msg.attachment.fileSize}</div>
                        </div>
                      </div>
                    )}
                    
                    {msg.taskAnalysis && (
                      <div className="mt-3 flex flex-col md:flex-row gap-3">
                        {/* Task Analysis Card */}
                        <div className="w-full md:w-auto flex-1 bg-bg-panel border border-border-subtle rounded-xl overflow-hidden shadow-sm">
                          <div className="px-3 py-1.5 bg-bg-main border-b border-border-subtle flex items-center justify-between gap-4">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Task Analysis</span>
                            <span className="text-[10px] font-bold text-primary">{Math.round(msg.taskAnalysis.confidence * 100)}% Confidence</span>
                          </div>
                          <div className="p-3 text-sm">
                            <div className="grid grid-cols-2 gap-x-6 gap-y-3 mb-4">
                              <div>
                                <div className="text-xs text-text-muted mb-0.5">Task</div>
                                <div className="font-medium text-text-main">{msg.taskAnalysis.taskType}</div>
                              </div>
                              <div>
                                <div className="text-xs text-text-muted mb-0.5">Complexity</div>
                                <div className={`font-medium ${msg.taskAnalysis.complexity === 'Complex' ? 'text-red-400' : msg.taskAnalysis.complexity === 'Medium' ? 'text-yellow-400' : 'text-green-400'}`}>
                                  {msg.taskAnalysis.complexity}
                                </div>
                              </div>
                              <div>
                                <div className="text-xs text-text-muted mb-0.5">Input Type</div>
                                <div className="font-medium text-text-main">{msg.taskAnalysis.inputType}</div>
                              </div>
                              <div>
                                <div className="text-xs text-text-muted mb-0.5">Output Type</div>
                                <div className="font-medium text-text-main">{msg.taskAnalysis.outputType}</div>
                              </div>
                            </div>

                            <div className="border-t border-border-subtle pt-3">
                              <div className="grid grid-cols-3 gap-2">
                                <div>
                                  <div className="text-xs text-text-muted mb-0.5">OCR</div>
                                  <div className={`font-medium text-xs flex items-center gap-1 ${msg.taskAnalysis.ocrRequired ? 'text-primary font-bold' : 'text-text-muted'}`}>
                                    {msg.taskAnalysis.ocrRequired ? 'Required' : 'Skip'}
                                  </div>
                                </div>
                                <div>
                                  <div className="text-xs text-text-muted mb-0.5">RAG</div>
                                  <div className={`font-medium text-xs flex items-center gap-1 ${msg.taskAnalysis.ragRequired ? 'text-primary font-bold' : 'text-text-muted'}`}>
                                    {msg.taskAnalysis.ragRequired ? 'Required' : 'Skip'}
                                  </div>
                                </div>
                                <div>
                                  <div className="text-xs text-text-muted mb-0.5">Vision</div>
                                  <div className={`font-medium text-xs flex items-center gap-1 ${msg.taskAnalysis.visionRequired ? 'text-primary font-bold' : 'text-text-muted'}`}>
                                    {msg.taskAnalysis.visionRequired ? 'Required' : 'Skip'}
                                  </div>
                                </div>
                              </div>
                            </div>
                            
                            {msg.taskAnalysis.fileRequired && (
                              <div className="mt-3 pt-3 border-t border-border-subtle">
                                <div className="text-xs text-text-muted mb-0.5">File Action</div>
                                <div className="font-medium text-text-main flex items-center gap-1.5">
                                  <FileCheck size={14} className="text-primary" />
                                  File processing required
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* IRAMR Model Routing Card */}
                        {msg.iramrResult && (
                          <div className="flex flex-col gap-3">
                          <div className="w-full md:w-[320px] bg-bg-panel border border-border-subtle rounded-xl overflow-hidden shadow-sm flex flex-col">
                            <div className="px-3 py-1.5 bg-bg-main border-b border-border-subtle flex items-center justify-between gap-4">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-security animate-pulse"></span>
                                IRAMR ROUTING
                              </span>
                              <span className="text-[10px] font-bold text-security">
                                Score: {msg.iramrResult.finalScore}
                              </span>
                            </div>

                            <div className="p-3 text-sm flex flex-col justify-between flex-1 space-y-3">
                              <div>
                                <div className="mb-2">
                                  <div className="text-xs text-text-muted mb-0.5">Selected Model</div>
                                  <div className="font-bold text-text-main text-base text-primary flex items-center gap-1.5">
                                    {msg.iramrResult.selectedModelName}
                                  </div>
                                </div>

                                <div className="grid grid-cols-3 gap-2 py-2 border-y border-border-subtle text-xs">
                                  <div>
                                    <span className="text-text-muted block text-[10px]">Task Match</span>
                                    <span className="font-medium text-text-main">{msg.iramrResult.taskCapabilityScore}%</span>
                                  </div>
                                  <div>
                                    <span className="text-text-muted block text-[10px]">Hardware Fit</span>
                                    <span className={`font-medium ${
                                      msg.iramrResult.hardwareFit === 'Excellent' ? 'text-security' :
                                      msg.iramrResult.hardwareFit === 'Good' ? 'text-primary' :
                                      msg.iramrResult.hardwareFit === 'Limited' ? 'text-yellow-400' : 'text-red-400'
                                    }`}>
                                      {msg.iramrResult.hardwareFit}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-text-muted block text-[10px]">Resource Score</span>
                                    <span className="font-medium text-text-main">{msg.iramrResult.resourceAvailabilityScore}%</span>
                                  </div>
                                </div>

                                <div className="mt-2.5">
                                  <div className="text-[11px] text-text-muted font-medium mb-1">Why Selected</div>
                                  <div className="text-xs text-text-main bg-bg-main p-2 rounded-lg border border-border-subtle leading-relaxed">
                                    {msg.iramrResult.reason}
                                  </div>
                                </div>
                              </div>

                              {msg.iramrResult.alternatives.filter(a => a.modelId !== msg.iramrResult?.selectedModelId).length > 0 && (
                                <div className="pt-2 border-t border-border-subtle text-xs flex items-center justify-between text-text-muted">
                                  <span className="text-text-muted font-normal">Alternative:</span>
                                  {msg.iramrResult.alternatives
                                    .filter(a => a.modelId !== msg.iramrResult?.selectedModelId)
                                    .map(alt => (
                                      <span key={alt.modelId} className="font-medium text-text-main">
                                        {alt.modelName} — <span className="text-text-muted">{alt.finalScore}</span>
                                      </span>
                                    ))
                                  }
                                </div>
                              )}

                              <div className="pt-2 border-t border-border-subtle text-[11px]">
                                <div className="text-text-muted font-medium mb-1">Tool Requirements</div>
                                <div className="grid grid-cols-3 gap-1 text-[10px]">
                                  <span className={msg.iramrResult.toolRequirements.ocr ? "text-primary font-bold" : "text-text-muted"}>
                                    OCR: {msg.iramrResult.toolRequirements.ocr ? "Yes" : "No"}
                                  </span>
                                  <span className={msg.iramrResult.toolRequirements.rag ? "text-primary font-bold" : "text-text-muted"}>
                                    RAG: {msg.iramrResult.toolRequirements.rag ? "Yes" : "No"}
                                  </span>
                                  <span className={msg.iramrResult.toolRequirements.vision ? "text-primary font-bold" : "text-text-muted"}>
                                    Vision: {msg.iramrResult.toolRequirements.vision ? "Yes" : "No"}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                          
                          {/* LOCAL LLM RUNTIME PANEL */}
                          <div className="w-full md:w-[320px]">
                              <RuntimeStatusPanel modelId={msg.iramrResult.selectedModelId.toLowerCase().includes('tinyllama') ? "tinyllama" : "qwen2.5-1.5b"} />
                          </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
            <div ref={endOfMessagesRef} />
          </div>
        </div>
      </div>
      
      {/* Floating Chat Input Area */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-bg-main via-bg-main to-transparent pt-10 pb-6 px-4">
        <div className="max-w-3xl mx-auto w-full">
          
          {attachment && (
            <div className="mb-2 w-fit px-3 py-1.5 bg-bg-panel border border-border-subtle rounded-lg flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2 shadow-sm">
              <FileCheck size={14} className="text-primary" />
              <span className="text-xs font-medium text-text-main max-w-[150px] truncate" title={attachment.fileName}>{attachment.fileName}</span>
              <button 
                onClick={() => setAttachment(null)}
                className="ml-1 p-0.5 hover:bg-bg-main rounded text-text-muted hover:text-red-500 transition-colors"
              >
                <X size={12} />
              </button>
            </div>
          )}

          <div className="bg-bg-panel border border-border-subtle rounded-2xl p-3 shadow-2xl focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/20 transition-all flex flex-col">
            <textarea 
              className="w-full bg-transparent resize-none outline-none text-text-main placeholder-text-muted min-h-[50px] max-h-[200px] text-base px-2 py-1 custom-scrollbar"
              placeholder="Message Sovereign AI..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={Math.min(5, Math.max(1, inputValue.split('\n').length))}
            />
            
            <div className="flex justify-between items-center mt-2">
              <div className="flex gap-0.5">
                <button 
                  onClick={handleSelectFile}
                  className="p-2 hover:bg-bg-panel-hover text-text-muted hover:text-text-main rounded-xl transition-colors"
                  title="Attach File"
                >
                  <Paperclip size={18} />
                </button>
                <button 
                  onClick={handleSelectFile}
                  className="p-2 hover:bg-bg-panel-hover text-text-muted hover:text-text-main rounded-xl transition-colors"
                >
                  <ImageIcon size={18} />
                </button>
                <button className="p-2 hover:bg-bg-panel-hover text-text-muted hover:text-text-main rounded-xl transition-colors">
                  <Wrench size={18} />
                </button>
                <button className="p-2 hover:bg-bg-panel-hover text-text-muted hover:text-text-main rounded-xl transition-colors">
                  <Code size={18} />
                </button>
              </div>
              <button 
                onClick={handleSubmit}
                disabled={(!inputValue.trim() && !attachment) || isGenerating}
                className={`p-2 rounded-xl transition-all mr-1 shadow-md flex items-center justify-center ${
                  ((!inputValue.trim() && !attachment) || isGenerating) 
                    ? 'bg-bg-main text-text-muted border border-border-subtle cursor-not-allowed' 
                    : 'bg-primary hover:bg-blue-600 text-white'
                }`}
              >
                <Send size={18} className="ml-0.5" />
              </button>
            </div>
          </div>
          <div className="text-center mt-3 text-xs text-text-muted">
            Sovereign AI can make mistakes. Check important info.
          </div>
        </div>
      </div>
    </main>
  );
}
