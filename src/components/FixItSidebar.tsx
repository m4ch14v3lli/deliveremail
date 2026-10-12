import React, { useEffect, useState } from 'react';
import { X, Wrench, CheckCircle, Copy, Check } from 'lucide-react';

interface FixItSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  steps: string[];
  copySnippet?: string;
}

export const FixItSidebar: React.FC<FixItSidebarProps> = ({ isOpen, onClose, title, steps, copySnippet }) => {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      setCopied(false);
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const handleCopy = async () => {
    if (copySnippet) {
      try {
        await navigator.clipboard.writeText(copySnippet);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        console.error('Failed to copy text: ', err);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div 
        className="fixed inset-0 bg-black/20 z-40 print:hidden transition-opacity"
        onClick={onClose}
      />
      <div className="fixed inset-y-0 right-0 w-full sm:w-[400px] bg-white shadow-xl z-50 print:hidden flex flex-col border-l border-gray-200 transform transition-transform">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-2 text-gray-900">
            <Wrench className="w-5 h-5" />
            <h2 className="text-base font-bold">Fix Implementation</h2>
          </div>
          <button 
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-sm transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-6">{title}</h3>
          
          <div className="space-y-6">
            {steps.map((step, idx) => (
              <div key={idx} className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div className="w-6 h-6 rounded-full bg-gray-900 text-white flex items-center justify-center text-xs font-bold shrink-0">
                    {idx + 1}
                  </div>
                  {idx !== steps.length - 1 && (
                    <div className="w-px h-full bg-gray-200 my-1" />
                  )}
                </div>
                <div className="pb-6">
                  <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{step}</p>
                </div>
              </div>
            ))}
          </div>

          {copySnippet && (
            <div className="mt-2 mb-6">
              <div className="bg-gray-900 rounded-sm overflow-hidden border border-gray-800 shadow-sm relative">
                <div className="flex justify-between items-center px-3 py-2 bg-gray-800 border-b border-gray-700">
                  <span className="text-[10px] text-gray-300 font-medium uppercase tracking-wider">Example Record</span>
                  <button 
                    onClick={handleCopy}
                    className="text-gray-400 hover:text-white transition-colors p-1"
                    title="Copy to clipboard"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <div className="p-3 overflow-x-auto">
                  <code className="text-xs font-mono text-gray-300 whitespace-pre-wrap break-all">
                    {copySnippet}
                  </code>
                </div>
              </div>
            </div>
          )}

          <div className="mt-8 p-4 bg-green-50 border border-green-200 rounded-sm flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
            <p className="text-xs text-green-800 font-medium leading-relaxed">
              Once changes are published to your DNS registrar, please allow up to 48 hours for global propagation before re-running the audit.
            </p>
          </div>
        </div>
      </div>
    </>
  );
};
