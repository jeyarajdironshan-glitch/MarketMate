import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Volume2, X, Sparkles, AlertCircle, ArrowRight } from 'lucide-react';
import { translations } from '../i18n/translations';

export default function VoiceAssistant({ 
  isOpen, 
  onClose, 
  currentLang, 
  onExecuteAction, 
  token 
}) {
  const t = translations[currentLang] || translations.en;

  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [spokenResponse, setSpokenResponse] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(true);
  const [statusMessage, setStatusMessage] = useState('');

  const recognitionRef = useRef(null);

  // Initialize Speech Recognition on Mount
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;

      // Set language code based on current language
      const langCodes = {
        si: 'si-LK',
        ta: 'ta-LK',
        en: 'en-US'
      };
      recognition.lang = langCodes[currentLang] || 'en-US';

      recognition.onstart = () => {
        setIsListening(true);
        setStatusMessage(t.voice_listening);
      };

      recognition.onresult = (event) => {
        const text = event.results[0][0].transcript;
        setTranscript(text);
        setIsListening(false);
        handleSendVoiceCommand(text);
      };

      recognition.onerror = (event) => {
        console.warn('Speech recognition error:', event.error);
        setIsListening(false);
        if (event.error === 'not-allowed') {
          setStatusMessage('Microphone access denied. Please click a suggested command below.');
        } else {
          setStatusMessage('Listening timed out. You may type or tap a command below.');
        }
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    } else {
      setSpeechSupported(false);
    }
  }, [currentLang]);

  // Toggle Microphone
  const toggleListening = () => {
    if (!speechSupported) {
      setStatusMessage(t.voice_unsupported);
      return;
    }

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      try {
        setTranscript('');
        setSpokenResponse('');
        const langCodes = { si: 'si-LK', ta: 'ta-LK', en: 'en-US' };
        if (recognitionRef.current) {
          recognitionRef.current.lang = langCodes[currentLang] || 'en-US';
          recognitionRef.current.start();
        }
      } catch (err) {
        console.warn('Recognition start exception:', err);
      }
    }
  };

  // Process command via Backend Voice Engine
  const handleSendVoiceCommand = async (textToProcess) => {
    if (!textToProcess) return;
    setIsProcessing(true);
    setStatusMessage('Analyzing agricultural query...');

    try {
      const res = await fetch('/api/voice/process-command', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          transcript: textToProcess,
          language: currentLang
        })
      });

      const data = await res.json();
      if (data.success) {
        setSpokenResponse(data.responseText);
        setStatusMessage('Answer ready');

        // Play text-to-speech if available
        speakText(data.spokenText || data.responseText, currentLang);

        // If command requires tab navigation or action
        if (data.action && onExecuteAction) {
          onExecuteAction(data);
        }
      } else {
        setStatusMessage(data.message || 'Error processing speech command.');
      }
    } catch (err) {
      console.error('Voice backend query failed:', err);
      setStatusMessage('Voice service communication error.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Text-To-Speech Synthesizer
  const speakText = (text, lang) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel(); // Stop any pending speech
      const utterance = new SpeechSynthesisUtterance(text);
      const voiceLangs = { si: 'si-LK', ta: 'ta-LK', en: 'en-US' };
      utterance.lang = voiceLangs[lang] || 'en-US';
      utterance.rate = 0.95;
      utterance.pitch = 1.0;
      window.speechSynthesis.speak(utterance);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs transition-opacity">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden transition-all animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-agri-dark to-agri-emerald p-4 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-agri-mint" />
            </div>
            <div>
              <h3 className="font-bold text-base">{t.voice_assistant}</h3>
              <p className="text-[11px] text-slate-200">Tamil • Sinhala • English Natural Speech Interface</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center transition"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 text-center">
          
          {/* Main Animated Microphone Button */}
          <div className="relative inline-flex items-center justify-center my-2">
            {isListening && (
              <div className="absolute w-28 h-28 rounded-full bg-emerald-400 animate-voice-wave opacity-50" />
            )}
            <button
              onClick={toggleListening}
              className={`relative z-10 w-20 h-20 rounded-full flex items-center justify-center shadow-lg transition-transform active:scale-95 ${
                isListening
                  ? 'bg-red-500 text-white ring-4 ring-red-200 animate-pulse'
                  : 'bg-gradient-to-tr from-agri-dark to-agri-mint text-white hover:scale-105'
              }`}
            >
              {isListening ? (
                <Mic className="w-9 h-9" />
              ) : (
                <Mic className="w-9 h-9 text-emerald-100" />
              )}
            </button>
          </div>

          {/* Status Text */}
          <p className="mt-3 text-sm font-semibold text-slate-700 min-h-[22px]">
            {isListening ? t.voice_listening : (statusMessage || t.voice_prompt)}
          </p>

          {/* Transcript Display */}
          {transcript && (
            <div className="mt-4 p-3 rounded-xl bg-slate-50 border border-slate-200 text-left">
              <p className="text-[11px] font-bold uppercase text-slate-400">You Asked:</p>
              <p className="text-sm font-semibold text-slate-800 italic">"{transcript}"</p>
            </div>
          )}

          {/* Spoken Response Display */}
          {spokenResponse && (
            <div className="mt-3 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-left">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-bold uppercase text-emerald-700">MarketMate Voice Answer:</span>
                <button 
                  onClick={() => speakText(spokenResponse, currentLang)}
                  className="text-xs text-emerald-700 hover:text-emerald-900 flex items-center gap-1 font-semibold"
                >
                  <Volume2 className="w-3.5 h-3.5" />
                  {t.voice_speak}
                </button>
              </div>
              <p className="text-sm font-medium text-emerald-900">{spokenResponse}</p>
            </div>
          )}

          {/* Suggested Quick Commands */}
          <div className="mt-5 text-left border-t border-slate-100 pt-4">
            <p className="text-xs font-bold text-slate-600 mb-2">{t.voice_suggestions}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                onClick={() => {
                  setTranscript(t.cmd_tomato);
                  handleSendVoiceCommand(t.cmd_tomato);
                }}
                className="text-left text-xs bg-slate-50 hover:bg-emerald-50 hover:text-emerald-800 hover:border-emerald-200 p-2.5 rounded-lg border border-slate-200 font-medium transition flex items-center justify-between"
              >
                <span>"{t.cmd_tomato}"</span>
                <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              </button>

              <button
                onClick={() => {
                  setTranscript(t.cmd_payments);
                  handleSendVoiceCommand(t.cmd_payments);
                }}
                className="text-left text-xs bg-slate-50 hover:bg-emerald-50 hover:text-emerald-800 hover:border-emerald-200 p-2.5 rounded-lg border border-slate-200 font-medium transition flex items-center justify-between"
              >
                <span>"{t.cmd_payments}"</span>
                <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              </button>

              <button
                onClick={() => {
                  setTranscript(t.cmd_market);
                  handleSendVoiceCommand(t.cmd_market);
                }}
                className="text-left text-xs bg-slate-50 hover:bg-emerald-50 hover:text-emerald-800 hover:border-emerald-200 p-2.5 rounded-lg border border-slate-200 font-medium transition flex items-center justify-between"
              >
                <span>"{t.cmd_market}"</span>
                <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              </button>

              <button
                onClick={() => {
                  setTranscript(t.cmd_deliveries);
                  handleSendVoiceCommand(t.cmd_deliveries);
                }}
                className="text-left text-xs bg-slate-50 hover:bg-emerald-50 hover:text-emerald-800 hover:border-emerald-200 p-2.5 rounded-lg border border-slate-200 font-medium transition flex items-center justify-between"
              >
                <span>"{t.cmd_deliveries}"</span>
                <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              </button>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <span>Active Language: <strong className="uppercase">{currentLang}</strong></span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold rounded-lg transition"
          >
            {t.close}
          </button>
        </div>

      </div>
    </div>
  );
}
