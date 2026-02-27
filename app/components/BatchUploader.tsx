import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { ArrowUpTrayIcon, PhotoIcon, XMarkIcon, ArrowPathIcon } from '@heroicons/react/24/solid';
import { cardDetector } from '~/models/cardDetectionModel';
import { CardAnalyzer, CardAnalysisResult, MultiGraderPredictions } from '~/models/cardAnalysisModel';
import { saveCard, generateId } from '~/utils/storage';

interface BatchResult {
  id: string;
  fileName: string;
  imageUrl: string;
  result: CardAnalysisResult | null;
  error: string | null;
  status: 'pending' | 'processing' | 'done' | 'error';
}

interface BatchUploaderProps {
  onSelectResult: (result: CardAnalysisResult & { imageUrl: string }) => void;
  onClose: () => void;
}

export default function BatchUploader({ onSelectResult, onClose }: BatchUploaderProps) {
  const [items, setItems] = useState<BatchResult[]>([]);
  const [processing, setProcessing] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(-1);

  const handleDrop = useCallback((acceptedFiles: File[]) => {
    const imageFiles = acceptedFiles.filter(f => f.type.startsWith('image/') && f.size <= 10 * 1024 * 1024);
    if (imageFiles.length === 0) return;

    const newItems: BatchResult[] = imageFiles.map(file => ({
      id: generateId(),
      fileName: file.name,
      imageUrl: '',
      result: null,
      error: null,
      status: 'pending' as const,
    }));

    // Read all files
    imageFiles.forEach((file, i) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setItems(prev => prev.map((item, idx) =>
            idx === i ? { ...item, imageUrl: reader.result as string } : item
          ));
        }
      };
      reader.readAsDataURL(file);
    });

    setItems(prev => [...prev, ...newItems]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: handleDrop,
    accept: { 'image/*': ['.jpeg', '.jpg', '.png', '.webp'] },
    disabled: processing,
  });

  const processAll = useCallback(async () => {
    setProcessing(true);
    const itemsToProcess = items.filter(i => i.status === 'pending' && i.imageUrl);

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.status !== 'pending' || !item.imageUrl) continue;

      setCurrentIndex(i);
      setItems(prev => prev.map((it, idx) => idx === i ? { ...it, status: 'processing' } : it));

      try {
        const img = new Image();
        img.src = item.imageUrl;
        await new Promise<void>(resolve => { img.onload = () => resolve(); });

        await cardDetector.detectCard(img);

        const analyzer = new CardAnalyzer();
        const result = await analyzer.analyzeCard(img);

        // Save to history
        await saveCard({
          id: item.id,
          timestamp: Date.now(),
          imageUrl: item.imageUrl,
          measurements: result.measurements,
          potentialGrade: result.potentialGrade,
        });

        setItems(prev => prev.map((it, idx) =>
          idx === i ? { ...it, status: 'done', result: { ...result, imageUrl: item.imageUrl, analyzer } } : it
        ));
      } catch (err) {
        setItems(prev => prev.map((it, idx) =>
          idx === i ? { ...it, status: 'error', error: err instanceof Error ? err.message : 'Analysis failed' } : it
        ));
      }
    }

    setCurrentIndex(-1);
    setProcessing(false);
  }, [items]);

  const removeItem = (index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  const clearAll = () => {
    setItems([]);
    setCurrentIndex(-1);
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-600';
    if (score >= 75) return 'text-yellow-600';
    return 'text-red-600';
  };

  const completedCount = items.filter(i => i.status === 'done').length;
  const errorCount = items.filter(i => i.status === 'error').length;

  return (
    <div className="w-full max-w-4xl mx-auto">
      {/* Drop zone */}
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors mb-4 ${
          isDragActive ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800'
        }`}
      >
        <input {...getInputProps()} />
        <PhotoIcon className="mx-auto h-10 w-10 text-gray-400" />
        <p className="mt-2 text-sm font-medium">{isDragActive ? 'Drop images here' : 'Drag & drop multiple card images'}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">PNG, JPG, JPEG, WebP up to 10MB each</p>
      </div>

      {/* Controls */}
      {items.length > 0 && (
        <div className="flex items-center justify-between mb-4">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {items.length} card{items.length !== 1 ? 's' : ''} queued
            {completedCount > 0 && <span className="text-green-600 ml-2">{completedCount} done</span>}
            {errorCount > 0 && <span className="text-red-600 ml-2">{errorCount} failed</span>}
          </div>
          <div className="flex gap-2">
            <button onClick={clearAll} disabled={processing} className="py-1.5 px-3 text-sm bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50">
              Clear All
            </button>
            <button
              onClick={processAll}
              disabled={processing || items.filter(i => i.status === 'pending' && i.imageUrl).length === 0}
              className="py-1.5 px-3 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 flex items-center gap-1"
            >
              {processing && <ArrowPathIcon className="h-4 w-4 animate-spin" />}
              {processing ? `Processing ${currentIndex + 1}/${items.length}...` : 'Analyze All'}
            </button>
          </div>
        </div>
      )}

      {/* Progress bar */}
      {processing && (
        <div className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full mb-4 overflow-hidden">
          <div
            className="h-full bg-blue-500 rounded-full transition-all duration-300"
            style={{ width: `${((completedCount + errorCount) / items.length) * 100}%` }}
          />
        </div>
      )}

      {/* Results grid */}
      {items.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {items.map((item, index) => (
            <div
              key={item.id}
              className={`relative rounded-lg border overflow-hidden cursor-pointer transition-shadow hover:shadow-md ${
                item.status === 'done' ? 'border-green-300 dark:border-green-700' :
                item.status === 'error' ? 'border-red-300 dark:border-red-700' :
                item.status === 'processing' ? 'border-blue-300 dark:border-blue-700' :
                'border-gray-200 dark:border-gray-700'
              } bg-white dark:bg-gray-800`}
              onClick={() => {
                if (item.status === 'done' && item.result) {
                  onSelectResult({ ...item.result, imageUrl: item.imageUrl });
                }
              }}
            >
              {/* Image preview */}
              <div className="aspect-[3/4] bg-gray-100 dark:bg-gray-900 overflow-hidden">
                {item.imageUrl ? (
                  <img src={item.imageUrl} alt={item.fileName} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <div className="animate-pulse w-8 h-8 rounded bg-gray-300 dark:bg-gray-700" />
                  </div>
                )}
              </div>

              {/* Status overlay */}
              {item.status === 'processing' && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                  <ArrowPathIcon className="h-8 w-8 text-white animate-spin" />
                </div>
              )}

              {/* Info bar */}
              <div className="p-2">
                <p className="text-xs truncate text-gray-600 dark:text-gray-400">{item.fileName}</p>
                {item.status === 'done' && item.result && (
                  <div className="flex justify-between items-center mt-1">
                    <span className={`text-xs font-bold ${getScoreColor(item.result.measurements.overallCentering)}`}>
                      {item.result.measurements.overallCentering.toFixed(1)}%
                    </span>
                    <span className="text-xs text-gray-500">{item.result.potentialGrade}</span>
                  </div>
                )}
                {item.status === 'error' && (
                  <p className="text-xs text-red-500 mt-1 truncate">{item.error}</p>
                )}
                {item.status === 'pending' && (
                  <p className="text-xs text-gray-400 mt-1">Pending</p>
                )}
              </div>

              {/* Remove button */}
              {!processing && (
                <button
                  onClick={e => { e.stopPropagation(); removeItem(index); }}
                  className="absolute top-1 right-1 p-0.5 bg-black/50 rounded-full text-white hover:bg-black/70"
                >
                  <XMarkIcon className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Close button */}
      <div className="mt-4">
        <button
          onClick={onClose}
          className="w-full py-2 px-4 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 font-medium rounded-lg"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
