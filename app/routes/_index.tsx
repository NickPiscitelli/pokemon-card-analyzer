import React, { useState, useEffect, useRef } from 'react';
import { initTensorFlow } from '~/models/cardDetectionModel';
import { CardAnalyzer } from '~/models/cardAnalysisModel'; 
import CardCamera from '~/components/CardCamera';
import CardUploader from '~/components/CardUploader';
import AnalysisResult from '~/components/AnalysisResult';
import CardHistory from '~/components/CardHistory';
import Settings from '~/components/Settings';
import { AnalyzedCard, getSettings, UserSettings } from '~/utils/storage';
import { 
  CameraIcon, 
  ArrowUpTrayIcon, 
  ClockIcon, 
  Cog6ToothIcon,
  QuestionMarkCircleIcon 
} from '@heroicons/react/24/outline';

// Check if we're in a browser environment
const isBrowser = typeof window !== 'undefined' && typeof window.document !== 'undefined';

// Define the analysis result type
import { CardAnalysisResult } from '~/models/cardAnalysisModel';
type AnalysisResultState = CardAnalysisResult | null;

export default function Index() {
  const [activeTab, setActiveTab] = useState<'analyze' | 'history'>('analyze');
  const [analysisMode, setAnalysisMode] = useState<'camera' | 'upload' | null>(null);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResultState>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [initError, setInitError] = useState<string | null>(null);
  const [initTimeout, setInitTimeout] = useState(false);
  
  // Reference to the CardAnalyzer instance for adjustments
  const cardAnalyzerRef = useRef<CardAnalyzer | null>(null);
  
  // Initialize TensorFlow and load settings
  useEffect(() => {
    const initialize = async () => {
      try {
        // Set a timeout to default to camera mode if initialization takes too long
        const timeoutId = setTimeout(() => {
          setInitTimeout(true);
          setAnalysisMode('camera');
        }, 5000); // Wait 5 seconds before defaulting to camera mode
        
        // Initialize TensorFlow.js
        await initTensorFlow();
        
        // Load user settings
        const userSettings = await getSettings();
        setSettings(userSettings);
        
        // Show tutorial for first-time users
        if (isBrowser) {
          const tutorialSeen = localStorage.getItem('tutorialSeen');
          if (!tutorialSeen) {
            setShowTutorial(true);
          }
        }
        
        // Clear the timeout if initialization completes successfully
        clearTimeout(timeoutId);
      } catch (error) {
        console.error('Initialization error:', error);
        setInitError('Failed to initialize the application. Please refresh the page and try again.');
        // Default to camera mode on error
        setAnalysisMode('camera');
      } finally {
        setIsInitializing(false);
      }
    };
    
    // Only run in the browser
    if (isBrowser) {
      initialize();
    } else {
      // If we're on the server, just set initializing to false
      setIsInitializing(false);
    }
  }, []);
  
  const handleCameraCapture = (result: any) => {
    setAnalysisResult(result);
    setAnalysisMode(null);
    // Store the analyzer instance for adjustments
    if (result.analyzer) {
      cardAnalyzerRef.current = result.analyzer;
    }
  };
  
  const handleUpload = (result: any) => {
    setAnalysisResult(result);
    setAnalysisMode(null);
    // Store the analyzer instance for adjustments
    if (result.analyzer) {
      cardAnalyzerRef.current = result.analyzer;
    }
  };
  
  const handleHistorySelect = (card: AnalyzedCard) => {
    // For history items, we need to create a placeholder for the fullImageData and cardImageData
    // since these can't be stored in IndexedDB directly
    const dummyImageData = new ImageData(1, 1);
    
    const initialResult: CardAnalysisResult = {
      imageUrl: card.imageUrl,
      measurements: card.measurements,
      potentialGrade: card.potentialGrade,
      fullImageData: dummyImageData,
      cardImageData: dummyImageData, // Both use the same image data now
      edgeOverlayImageData: dummyImageData,
      edgeOverlayUrl: '' // We won't have an edge overlay for history items initially
    };
    
    setAnalysisResult(initialResult);
    setActiveTab('analyze');
    // Clear the analyzer reference since we don't have it for history items
    cardAnalyzerRef.current = null;
    
    // Load the image and regenerate the edge overlay if possible
    if (isBrowser) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        // Create a full image data from the loaded image
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (ctx) {
          canvas.width = img.width;
          canvas.height = img.height;
          ctx.drawImage(img, 0, 0);
          const fullImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          
          // Create a new analyzer instance
          const analyzer = new CardAnalyzer();
          
          // Try to recreate edge overlay
          analyzer.analyzeCard(img).then(result => {
            // Update the analyzer reference
            cardAnalyzerRef.current = analyzer;
            
            // Update the analysis result with the regenerated data
            setAnalysisResult(prevState => {
              if (!prevState) return result;
              return {
                ...prevState,
                fullImageData: result.fullImageData,
                cardImageData: result.fullImageData, // Both use the same full image data
                edgeOverlayImageData: result.edgeOverlayImageData,
                edgeOverlayUrl: result.edgeOverlayUrl
              };
            });
          }).catch(err => {
            console.error('Error regenerating analysis:', err);
          });
        }
      };
      img.onerror = () => {
        console.error('Error loading image from history');
      };
      img.src = card.imageUrl;
    }
  };
  
  // Handle border adjustments
  const handleAdjustBorder = async (type: 'outer' | 'inner', direction: 'left' | 'right' | 'top' | 'bottom', amount: number) => {
    if (!cardAnalyzerRef.current || !analysisResult || !analysisResult.fullImageData) {
      console.warn('Cannot adjust borders: analyzer not available or no analysis result');
      return;
    }
    
    try {
      console.log('Adjusting borders:', { type, direction, amount });
      
      // Update measurements
      const updatedMeasurements = cardAnalyzerRef.current.adjustMeasurements(type, direction, amount);
      console.log('Updated measurements:', updatedMeasurements);
      
      // Get current edges
      const currentEdges = cardAnalyzerRef.current.getCurrentEdges();
      console.log('Current edges:', currentEdges);
      
      if (!currentEdges) {
        console.warn('Current edges not available');
        return;
      }
      
      // Create a temporary canvas to hold the full image
      const tempCanvas = document.createElement('canvas');
      const tempCtx = tempCanvas.getContext('2d');
      if (!tempCtx) throw new Error('Could not get canvas context');
      
      // Set canvas dimensions to match the image data
      tempCanvas.width = analysisResult.fullImageData.width;
      tempCanvas.height = analysisResult.fullImageData.height;
      
      // Draw the full image data to the canvas
      tempCtx.putImageData(analysisResult.fullImageData, 0, 0);
      
      // Create a new edge overlay using the canvas as the source with both edge types
      const newEdgeOverlay = cardAnalyzerRef.current.generateEdgeOverlay(
        tempCanvas,
        currentEdges,
        null
      );
      console.log('Generated new edge overlay:', { width: newEdgeOverlay.width, height: newEdgeOverlay.height });
      
      // Convert the overlay to a data URL
      const overlayCanvas = document.createElement('canvas');
      overlayCanvas.width = newEdgeOverlay.width;
      overlayCanvas.height = newEdgeOverlay.height;
      const overlayCtx = overlayCanvas.getContext('2d');
      if (!overlayCtx) throw new Error('Could not get canvas context');
      
      overlayCtx.putImageData(newEdgeOverlay, 0, 0);
      const newOverlayUrl = overlayCanvas.toDataURL();
      console.log('Generated new edge overlay URL');
      
      // Update the analysis result
      setAnalysisResult(prevState => {
        if (!prevState) return prevState;
        console.log('Updating analysis result with new overlay');
        return {
          ...prevState,
          measurements: updatedMeasurements,
          edgeOverlayImageData: newEdgeOverlay,
          edgeOverlayUrl: newOverlayUrl,
          potentialGrade: cardAnalyzerRef.current!.getPotentialGrade(updatedMeasurements),
          detectionMethod: cardAnalyzerRef.current!.detectionMethod
        };
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
    if (isBrowser) {
      localStorage.setItem('tutorialSeen', 'true');
    }
  };
  
  const renderTutorial = () => {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-xl p-6 max-w-lg w-full">
          <h2 className="text-2xl font-bold mb-4">Welcome to Pokémon Card Analyzer!</h2>
          
          <div className="space-y-4 mb-6">
            <p>
              This tool helps you analyze the centering of your Pokémon cards to predict potential grading scores.
              Here's how to use it:
            </p>
            
            <div className="p-3 bg-blue-50 rounded-lg">
              <h3 className="font-bold text-blue-800">Step 1: Capture or Upload</h3>
              <p className="text-sm text-blue-700">
                Take a photo with your camera or upload an existing image. 
                For best results, place your card on a contrasting background.
              </p>
            </div>
            
            <div className="p-3 bg-green-50 rounded-lg">
              <h3 className="font-bold text-green-800">Step 2: Analyze</h3>
              <p className="text-sm text-green-700">
                The application will automatically detect your card's borders and measure the centering.
              </p>
            </div>
            
            <div className="p-3 bg-purple-50 rounded-lg">
              <h3 className="font-bold text-purple-800">Step 3: Review</h3>
              <p className="text-sm text-purple-700">
                Check your card's centering scores and potential grading outcome. You can download a
                report or save the analysis to your history.
              </p>
            </div>
          </div>
          
          <div className="text-right">
            <button 
              onClick={closeTutorial}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Get Started
            </button>
          </div>
        </div>
      </div>
    );
  };
  
  return (
    <div className={`min-h-screen ${settings?.theme === 'dark' ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-900'}`}>
      <header className="bg-blue-600 text-white p-4 shadow-md">
        <div className="container mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-bold">Pokémon Card Analyzer</h1>
          <div className="flex space-x-2">
            <button 
              onClick={() => setShowTutorial(true)}
              className="p-2 rounded-full hover:bg-blue-700"
              title="Tutorial"
            >
              <QuestionMarkCircleIcon className="h-6 w-6" />
            </button>
            <button 
              onClick={() => setShowSettings(true)}
              className="p-2 rounded-full hover:bg-blue-700"
              title="Settings"
            >
              <Cog6ToothIcon className="h-6 w-6" />
            </button>
          </div>
        </div>
      </header>
      
      <main className="container mx-auto p-4">
        {isInitializing && !initTimeout ? (
          <div className="flex flex-col items-center justify-center min-h-[60vh]">
            <div className="animate-pulse text-6xl mb-4">🔍</div>
            <p className="text-xl font-semibold mb-2">Initializing...</p>
            <p className="text-sm text-gray-500">
              Loading card detection models and preparing the analyzer
            </p>
          </div>
        ) : initError && !analysisMode ? (
          <div className="bg-red-100 text-red-800 p-4 rounded-lg mb-4">
            {initError}
          </div>
        ) : (
          <>
            {/* Tabs */}
            {!analysisResult && !analysisMode ? (
              <div className="flex border-b border-gray-200 mb-6">
                <button
                  onClick={() => setActiveTab('analyze')}
                  className={`px-4 py-2 font-medium text-sm ${
                    activeTab === 'analyze'
                      ? 'border-b-2 border-blue-500 text-blue-600'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Analyze Card
                </button>
                <button
                  onClick={() => setActiveTab('history')}
                  className={`px-4 py-2 font-medium text-sm ${
                    activeTab === 'history'
                      ? 'border-b-2 border-blue-500 text-blue-600'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Card History
                </button>
              </div>
            ) : null}
            
            {/* Content */}
            <div className="py-4">
              {activeTab === 'analyze' && !analysisResult && !analysisMode ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
                  <button
                    onClick={() => setAnalysisMode('camera')}
                    className="flex flex-col items-center justify-center bg-white rounded-lg shadow-md p-8 border border-gray-200 hover:border-blue-500 hover:shadow-lg transition-all"
                  >
                    <div className="bg-blue-100 p-4 rounded-full mb-4">
                      <CameraIcon className="h-10 w-10 text-blue-600" />
                    </div>
                    <h3 className="text-xl font-semibold mb-2">Use Camera</h3>
                    <p className="text-sm text-gray-500 text-center">
                      Take a photo of your card with your device's camera
                    </p>
                  </button>
                  
                  <button
                    onClick={() => setAnalysisMode('upload')}
                    className="flex flex-col items-center justify-center bg-white rounded-lg shadow-md p-8 border border-gray-200 hover:border-blue-500 hover:shadow-lg transition-all"
                  >
                    <div className="bg-green-100 p-4 rounded-full mb-4">
                      <ArrowUpTrayIcon className="h-10 w-10 text-green-600" />
                    </div>
                    <h3 className="text-xl font-semibold mb-2">Upload Image</h3>
                    <p className="text-sm text-gray-500 text-center">
                      Upload an existing image of your card from your device
                    </p>
                  </button>
                  
                  <div className="md:col-span-2 bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                    <h3 className="font-semibold text-yellow-800 mb-2">Tips for Best Results</h3>
                    <ul className="list-disc list-inside text-sm text-yellow-700 space-y-1">
                      <li>Place your card on a dark, contrasting background</li>
                      <li>Ensure even lighting without glare on the card</li>
                      <li>Keep the card parallel to the camera for accurate measurements</li>
                      <li>Avoid shadows across the card edges</li>
                    </ul>
                  </div>
                </div>
              ) : null}
              
              {(activeTab === 'analyze' && analysisMode === 'camera') || (isInitializing && initTimeout) ? (
                <CardCamera
                  onCapture={handleCameraCapture}
                  onClose={() => setAnalysisMode(null)}
                />
              ) : null}
              
              {activeTab === 'analyze' && analysisMode === 'upload' ? (
                <CardUploader
                  onUpload={handleUpload}
                  onClose={() => setAnalysisMode(null)}
                />
              ) : null}
              
              {activeTab === 'analyze' && analysisResult ? (
                <AnalysisResult
                  imageUrl={analysisResult.imageUrl || ''}
                  edgeOverlayUrl={analysisResult.edgeOverlayUrl}
                  measurements={analysisResult.measurements}
                  potentialGrade={analysisResult.potentialGrade}
                  onBack={resetAnalysis}
                  onReset={resetAnalysis}
                  onAdjustBorder={cardAnalyzerRef.current ? handleAdjustBorder : undefined}
                />
              ) : null}
              
              {activeTab === 'history' ? (
                <CardHistory onSelect={handleHistorySelect} />
              ) : null}
            </div>
          </>
        )}
      </main>
      
      <footer className="bg-gray-100 py-4 border-t border-gray-200">
        <div className="container mx-auto px-4 text-center text-sm text-gray-600">
          <p>
            Pokémon Card Analyzer &copy; {new Date().getFullYear()} | 
            Not affiliated with Nintendo, The Pokémon Company, PSA, BGS, or CGC
          </p>
          <p className="mt-1">
            This tool is for educational purposes only. All trademarks belong to their respective owners.
          </p>
        </div>
      </footer>
      
      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-40 p-4">
          <Settings onClose={() => setShowSettings(false)} />
        </div>
      )}
      
      {/* Tutorial Modal */}
      {showTutorial && renderTutorial()}
    </div>
  );
}
