import React, { useState, useEffect, useRef } from 'react';
import { CardAnalyzer, CardMeasurements, CardAnalysisResult } from '~/models/cardAnalysisModel';
import CardCamera from '~/components/CardCamera';
import CardUploader from '~/components/CardUploader';
import BatchUploader from '~/components/BatchUploader';
import AnalysisResult from '~/components/AnalysisResult';
import CardHistory from '~/components/CardHistory';
import Settings from '~/components/Settings';
import { AnalyzedCard, getSettings, UserSettings } from '~/utils/storage';
import {
  CameraIcon,
  ArrowUpTrayIcon,
  ClockIcon,
  Cog6ToothIcon,
  QuestionMarkCircleIcon,
  SunIcon,
  MoonIcon,
  Squares2X2Icon,
} from '@heroicons/react/24/outline';

const isBrowser = typeof window !== 'undefined' && typeof window.document !== 'undefined';

type AnalysisResultState = CardAnalysisResult | null;

export default function Index() {
  const [activeTab, setActiveTab] = useState<'analyze' | 'history'>('analyze');
  const [analysisMode, setAnalysisMode] = useState<'camera' | 'upload' | 'batch' | null>(null);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResultState>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [initError, setInitError] = useState<string | null>(null);
  const [darkMode, setDarkMode] = useState(false);

  const cardAnalyzerRef = useRef<CardAnalyzer | null>(null);

  // Initialize
  useEffect(() => {
    if (!isBrowser) {
      setIsInitializing(false);
      return;
    }

    const initialize = async () => {
      try {
        const userSettings = await getSettings();
        setSettings(userSettings);

        // Load dark mode from localStorage
        const storedDark = localStorage.getItem('darkMode');
        if (storedDark !== null) {
          setDarkMode(storedDark === 'true');
        } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
          setDarkMode(true);
        }

        const tutorialSeen = localStorage.getItem('tutorialSeen');
        if (!tutorialSeen) setShowTutorial(true);
      } catch (error) {
        console.error('Initialization error:', error);
        setInitError('Failed to initialize. Please refresh.');
      } finally {
        setIsInitializing(false);
      }
    };

    initialize();
  }, []);

  // Apply dark mode class
  useEffect(() => {
    if (!isBrowser) return;
    document.documentElement.classList.toggle('dark', darkMode);
    localStorage.setItem('darkMode', String(darkMode));
  }, [darkMode]);

  const handleCameraCapture = (result: any) => {
    setAnalysisResult(result);
    setAnalysisMode(null);
    if (result.analyzer) cardAnalyzerRef.current = result.analyzer;
  };

  const handleUpload = (result: any) => {
    setAnalysisResult(result);
    setAnalysisMode(null);
    if (result.analyzer) cardAnalyzerRef.current = result.analyzer;
  };

  const handleBatchSelect = (result: any) => {
    setAnalysisResult(result);
    setAnalysisMode(null);
    if (result.analyzer) cardAnalyzerRef.current = result.analyzer;
  };

  const handleHistorySelect = (card: AnalyzedCard) => {
    const dummyImageData = new ImageData(1, 1);
    const dummyPredictions = new CardAnalyzer().calculateMultiGraderPredictions(card.measurements);

    const initialResult: CardAnalysisResult = {
      imageUrl: card.imageUrl,
      measurements: card.measurements,
      potentialGrade: card.potentialGrade,
      graderPredictions: dummyPredictions,
      fullImageData: dummyImageData,
      cardImageData: dummyImageData,
      edgeOverlayImageData: dummyImageData,
      edgeOverlayUrl: '',
    };

    setAnalysisResult(initialResult);
    setActiveTab('analyze');
    cardAnalyzerRef.current = null;

    if (isBrowser) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const analyzer = new CardAnalyzer();
        analyzer.analyzeCard(img).then(result => {
          cardAnalyzerRef.current = analyzer;
          setAnalysisResult(prev => {
            if (!prev) return result;
            return {
              ...prev,
              fullImageData: result.fullImageData,
              cardImageData: result.fullImageData,
              edgeOverlayImageData: result.edgeOverlayImageData,
              edgeOverlayUrl: result.edgeOverlayUrl,
              graderPredictions: result.graderPredictions,
            };
          });
        }).catch(err => console.error('Error regenerating analysis:', err));
      };
      img.onerror = () => console.error('Error loading image from history');
      img.src = card.imageUrl;
    }
  };

  const handleAdjustBorder = async (
    type: 'outer' | 'inner',
    direction: 'left' | 'right' | 'top' | 'bottom',
    amount: number,
    algorithm?: 'Yellow' | 'Canny' | 'PSA'
  ) => {
    if (!cardAnalyzerRef.current || !analysisResult || !analysisResult.imageUrl) return;

    try {
      let algoType = analysisResult.detectionMethod || 'Canny Edge Detection';
      const isAlgorithmChange = amount === 0 && algorithm;

      if (algorithm) {
        if (algorithm === 'Yellow') algoType = 'Yellow Border Detection';
        else if (algorithm === 'Canny') algoType = 'Canny Edge Detection';
        else if (algorithm === 'PSA') algoType = 'PSA Template';
        cardAnalyzerRef.current.detectionMethod = algoType;
      }

      const loadImg = () => new Promise<void>(resolve => {
        const img = new Image();
        img.src = analysisResult.imageUrl!;
        img.onload = () => { cardAnalyzerRef.current!.setImageDimensions(img.width, img.height); resolve(); };
        img.onerror = () => resolve();
      });
      await loadImg();

      let updatedMeasurements: CardMeasurements = analysisResult.measurements;

      if (isAlgorithmChange) {
        const img = new Image();
        img.src = analysisResult.imageUrl;
        await new Promise<void>(resolve => {
          img.onload = async () => {
            try {
              const result = await cardAnalyzerRef.current!.analyzeCard(img);
              updatedMeasurements = result.measurements;
            } catch {
              updatedMeasurements = cardAnalyzerRef.current!.adjustMeasurements(type, direction, 0);
            }
            resolve();
          };
          img.onerror = () => {
            updatedMeasurements = cardAnalyzerRef.current!.adjustMeasurements(type, direction, 0);
            resolve();
          };
        });
      } else {
        updatedMeasurements = cardAnalyzerRef.current.adjustMeasurements(type, direction, amount);
      }

      if (!updatedMeasurements) return;

      const img = new Image();
      img.src = analysisResult.imageUrl;
      await new Promise<void>(resolve => {
        img.onload = () => {
          if (!cardAnalyzerRef.current) return;
          const overlayData = cardAnalyzerRef.current.generateEdgeOverlay(img);
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          if (!ctx) return;
          canvas.width = overlayData.width;
          canvas.height = overlayData.height;
          ctx.putImageData(overlayData, 0, 0);
          const overlayUrl = canvas.toDataURL('image/png');

          setAnalysisResult(prev => {
            if (!prev || !cardAnalyzerRef.current) return prev;
            return {
              ...prev,
              measurements: updatedMeasurements,
              edgeOverlayUrl: overlayUrl,
              detectionMethod: algoType,
              potentialGrade: cardAnalyzerRef.current.calculatePotentialGrade(updatedMeasurements),
              graderPredictions: cardAnalyzerRef.current.calculateMultiGraderPredictions(updatedMeasurements),
            };
          });
          resolve();
        };
        img.onerror = () => resolve();
      });
    } catch (error) {
      console.error('Error adjusting borders:', error);
    }
  };

  const resetAnalysis = () => {
    setAnalysisResult(null);
    cardAnalyzerRef.current = null;
  };

  const closeTutorial = () => {
    setShowTutorial(false);
    if (isBrowser) localStorage.setItem('tutorialSeen', 'true');
  };

  // Skeleton loader component
  const Skeleton = ({ className }: { className?: string }) => (
    <div className={`animate-pulse bg-gray-200 dark:bg-gray-700 rounded ${className}`} />
  );

  const renderTutorial = () => (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 max-w-lg w-full">
        <h2 className="text-2xl font-bold mb-4">Welcome to Pokemon Card Analyzer!</h2>
        <div className="space-y-3 mb-6">
          <p className="text-gray-600 dark:text-gray-400">
            Analyze your card centering to predict grading scores from PSA, BGS, and CGC.
          </p>
          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <h3 className="font-bold text-blue-800 dark:text-blue-300">Step 1: Capture or Upload</h3>
            <p className="text-sm text-blue-700 dark:text-blue-400">Take a photo or upload an image. Place your card on a contrasting background.</p>
          </div>
          <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
            <h3 className="font-bold text-green-800 dark:text-green-300">Step 2: Analyze</h3>
            <p className="text-sm text-green-700 dark:text-green-400">We detect card borders and measure centering automatically.</p>
          </div>
          <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
            <h3 className="font-bold text-purple-800 dark:text-purple-300">Step 3: Review Grades</h3>
            <p className="text-sm text-purple-700 dark:text-purple-400">See predicted grades from PSA, BGS, and CGC side by side.</p>
          </div>
        </div>
        <div className="text-right">
          <button onClick={closeTutorial} className="px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            Get Started
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 transition-colors">
      {/* Header */}
      <header className="bg-blue-600 dark:bg-gray-800 text-white shadow-md">
        <div className="container mx-auto px-4 py-3 flex justify-between items-center">
          <h1 className="text-xl sm:text-2xl font-bold truncate">Pokemon Card Analyzer</h1>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="p-2 rounded-full hover:bg-white/10"
              title={darkMode ? 'Light mode' : 'Dark mode'}
            >
              {darkMode ? <SunIcon className="h-5 w-5" /> : <MoonIcon className="h-5 w-5" />}
            </button>
            <button onClick={() => setShowTutorial(true)} className="p-2 rounded-full hover:bg-white/10" title="Tutorial">
              <QuestionMarkCircleIcon className="h-5 w-5" />
            </button>
            <button onClick={() => setShowSettings(true)} className="p-2 rounded-full hover:bg-white/10" title="Settings">
              <Cog6ToothIcon className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        {isInitializing ? (
          /* Loading skeleton */
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex gap-4 border-b border-gray-200 dark:border-gray-700 pb-2">
              <Skeleton className="h-8 w-28" />
              <Skeleton className="h-8 w-28" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Skeleton className="h-48 rounded-lg" />
              <Skeleton className="h-48 rounded-lg" />
            </div>
            <Skeleton className="h-24 rounded-lg" />
          </div>
        ) : initError && !analysisMode ? (
          <div className="bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 p-4 rounded-lg mb-4">
            {initError}
          </div>
        ) : (
          <>
            {/* Tabs */}
            {!analysisResult && !analysisMode && (
              <div className="flex border-b border-gray-200 dark:border-gray-700 mb-6">
                <button
                  onClick={() => setActiveTab('analyze')}
                  className={`px-4 py-2 font-medium text-sm ${
                    activeTab === 'analyze'
                      ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                  }`}
                >
                  Analyze Card
                </button>
                <button
                  onClick={() => setActiveTab('history')}
                  className={`px-4 py-2 font-medium text-sm ${
                    activeTab === 'history'
                      ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                  }`}
                >
                  Card History
                </button>
              </div>
            )}

            <div className="py-2">
              {/* Mode selection */}
              {activeTab === 'analyze' && !analysisResult && !analysisMode && (
                <div className="max-w-4xl mx-auto">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                    <button
                      onClick={() => setAnalysisMode('camera')}
                      className="flex flex-col items-center justify-center bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-200 dark:border-gray-700 hover:border-blue-500 hover:shadow-lg transition-all"
                    >
                      <div className="bg-blue-100 dark:bg-blue-900/30 p-3 rounded-full mb-3">
                        <CameraIcon className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                      </div>
                      <h3 className="text-lg font-semibold mb-1">Camera</h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400 text-center">Take a photo</p>
                    </button>

                    <button
                      onClick={() => setAnalysisMode('upload')}
                      className="flex flex-col items-center justify-center bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-200 dark:border-gray-700 hover:border-green-500 hover:shadow-lg transition-all"
                    >
                      <div className="bg-green-100 dark:bg-green-900/30 p-3 rounded-full mb-3">
                        <ArrowUpTrayIcon className="h-8 w-8 text-green-600 dark:text-green-400" />
                      </div>
                      <h3 className="text-lg font-semibold mb-1">Upload</h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400 text-center">Single image</p>
                    </button>

                    <button
                      onClick={() => setAnalysisMode('batch')}
                      className="flex flex-col items-center justify-center bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-200 dark:border-gray-700 hover:border-purple-500 hover:shadow-lg transition-all"
                    >
                      <div className="bg-purple-100 dark:bg-purple-900/30 p-3 rounded-full mb-3">
                        <Squares2X2Icon className="h-8 w-8 text-purple-600 dark:text-purple-400" />
                      </div>
                      <h3 className="text-lg font-semibold mb-1">Batch</h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400 text-center">Multiple cards</p>
                    </button>
                  </div>

                  <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg border border-yellow-200 dark:border-yellow-800">
                    <h3 className="font-semibold text-yellow-800 dark:text-yellow-300 mb-2">Tips for Best Results</h3>
                    <ul className="list-disc list-inside text-sm text-yellow-700 dark:text-yellow-400 space-y-1">
                      <li>Place your card on a dark, contrasting background</li>
                      <li>Ensure even lighting without glare</li>
                      <li>Keep the card parallel to the camera</li>
                      <li>Avoid shadows across the card edges</li>
                    </ul>
                  </div>
                </div>
              )}

              {activeTab === 'analyze' && analysisMode === 'camera' && (
                <CardCamera onCapture={handleCameraCapture} onClose={() => setAnalysisMode(null)} />
              )}

              {activeTab === 'analyze' && analysisMode === 'upload' && (
                <CardUploader onUpload={handleUpload} onClose={() => setAnalysisMode(null)} />
              )}

              {activeTab === 'analyze' && analysisMode === 'batch' && (
                <BatchUploader onSelectResult={handleBatchSelect} onClose={() => setAnalysisMode(null)} />
              )}

              {activeTab === 'analyze' && analysisResult && (
                <AnalysisResult
                  imageUrl={analysisResult.imageUrl || ''}
                  edgeOverlayUrl={analysisResult.edgeOverlayUrl}
                  measurements={analysisResult.measurements}
                  potentialGrade={analysisResult.potentialGrade}
                  graderPredictions={analysisResult.graderPredictions}
                  detectionInfo={analysisResult.detectionInfo}
                  detectionMethod={analysisResult.detectionMethod}
                  onBack={resetAnalysis}
                  onReset={resetAnalysis}
                  onAdjustBorder={cardAnalyzerRef.current ? handleAdjustBorder : undefined}
                />
              )}

              {activeTab === 'history' && <CardHistory onSelect={handleHistorySelect} />}
            </div>
          </>
        )}
      </main>

      <footer className="bg-gray-100 dark:bg-gray-800 py-4 border-t border-gray-200 dark:border-gray-700 mt-8">
        <div className="container mx-auto px-4 text-center text-sm text-gray-600 dark:text-gray-400">
          <p>Pokemon Card Analyzer &copy; {new Date().getFullYear()} | Not affiliated with Nintendo, The Pokemon Company, PSA, BGS, or CGC</p>
          <p className="mt-1 text-xs">This tool is for educational purposes only.</p>
        </div>
      </footer>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-40 p-4">
          <Settings onClose={() => setShowSettings(false)} />
        </div>
      )}

      {/* Tutorial Modal */}
      {showTutorial && renderTutorial()}
    </div>
  );
}
