import React, { useState, useRef, useCallback, useEffect } from 'react';
import Webcam from 'react-webcam';
import { cardDetector } from '~/models/cardDetectionModel';
import { cardAnalyzer } from '~/models/cardAnalysisModel';
import { saveCard, generateId } from '~/utils/storage';
import { CameraIcon, ArrowPathIcon, CheckIcon } from '@heroicons/react/24/solid';

interface CardCameraProps {
  onCapture: (result: any) => void;
  onClose: () => void;
}

export default function CardCamera({ onCapture, onClose }: CardCameraProps) {
  const webcamRef = useRef<Webcam>(null);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  const handleCameraReady = useCallback(() => {
    setIsCameraReady(true);
    setCameraError(null);
  }, []);
  
  const handleCameraError = useCallback((error: string | DOMException) => {
    console.error('Camera error:', error);
    setCameraError('Failed to access camera. Please ensure you have granted camera permissions.');
    setIsCameraReady(false);
  }, []);
  
  const captureImage = useCallback(async () => {
    if (!webcamRef.current) return;
    
    setIsCapturing(true);
    
    try {
      const imageSrc = webcamRef.current.getScreenshot();
      if (!imageSrc) {
        throw new Error('Failed to capture image');
      }
      
      setCapturedImage(imageSrc);
    } catch (error) {
      console.error('Failed to capture image:', error);
      setCameraError('Failed to capture image. Please try again.');
    }
    
    setIsCapturing(false);
  }, [webcamRef]);
  
  const retakeImage = useCallback(() => {
    setCapturedImage(null);
  }, []);
  
  const analyzeCard = useCallback(async () => {
    if (!capturedImage) return;
    
    setIsAnalyzing(true);
    
    try {
      // Create an image element from the captured image
      const img = new Image();
      img.src = capturedImage;
      
      // Wait for the image to load
      await new Promise<void>((resolve) => {
        img.onload = () => resolve();
      });
      
      // First, detect if there's a card in the image
      const potentialCards = await cardDetector.detectCard(img);
      
      if (potentialCards.length === 0) {
        throw new Error('No card detected in the image');
      }
      
      // Analyze the card centering
      const analysisResult = await cardAnalyzer.analyzeCard(img);
      
      // Save the card to history
      const cardRecord = {
        id: generateId(),
        timestamp: Date.now(),
        imageUrl: capturedImage,
        measurements: analysisResult.measurements,
        potentialGrade: analysisResult.potentialGrade
      };
      
      await saveCard(cardRecord);
      
      // Pass the result back to the parent component
      onCapture({
        ...analysisResult,
        imageUrl: capturedImage,
        analyzer: cardAnalyzer
      });
    } catch (error) {
      console.error('Failed to analyze card:', error);
      setCameraError(`Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    
    setIsAnalyzing(false);
  }, [capturedImage, onCapture]);
  
  return (
    <div className="flex flex-col items-center w-full max-w-md mx-auto bg-white rounded-lg shadow-lg overflow-hidden">
      {cameraError && (
        <div className="w-full p-4 bg-red-100 text-red-800 text-sm">
          {cameraError}
        </div>
      )}
      
      <div className="relative w-full aspect-[3/4] bg-gray-900">
        {!capturedImage ? (
          <Webcam
            audio={false}
            ref={webcamRef}
            screenshotFormat="image/jpeg"
            className="absolute inset-0 w-full h-full object-cover"
            onUserMedia={handleCameraReady}
            onUserMediaError={handleCameraError}
            videoConstraints={{
              facingMode: 'environment'
            }}
          />
        ) : (
          <img 
            src={capturedImage} 
            alt="Captured card" 
            className="absolute inset-0 w-full h-full object-contain"
          />
        )}
        
        {/* Guide overlay */}
        {isCameraReady && !capturedImage && (
          <div className="absolute inset-0 border-2 border-dashed border-yellow-400 m-8 pointer-events-none">
            <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-yellow-400"></div>
            <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-yellow-400"></div>
            <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-yellow-400"></div>
            <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-yellow-400"></div>
          </div>
        )}
      </div>
      
      <div className="p-4 w-full">
        {!capturedImage ? (
          <button
            onClick={captureImage}
            disabled={!isCameraReady || isCapturing}
            className="w-full py-3 px-4 bg-blue-600 text-white font-medium rounded-lg flex items-center justify-center disabled:bg-gray-400"
          >
            {isCapturing ? (
              <ArrowPathIcon className="w-5 h-5 animate-spin mr-2" />
            ) : (
              <CameraIcon className="w-5 h-5 mr-2" />
            )}
            {isCapturing ? 'Capturing...' : 'Capture Card'}
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={retakeImage}
              className="flex-1 py-3 px-4 bg-gray-200 text-gray-800 font-medium rounded-lg flex items-center justify-center"
            >
              Retake
            </button>
            <button
              onClick={analyzeCard}
              disabled={isAnalyzing}
              className="flex-1 py-3 px-4 bg-green-600 text-white font-medium rounded-lg flex items-center justify-center disabled:bg-gray-400"
            >
              {isAnalyzing ? (
                <ArrowPathIcon className="w-5 h-5 animate-spin mr-2" />
              ) : (
                <CheckIcon className="w-5 h-5 mr-2" />
              )}
              {isAnalyzing ? 'Analyzing...' : 'Analyze'}
            </button>
          </div>
        )}
        
        <button
          onClick={onClose}
          className="mt-2 w-full py-2 px-4 bg-gray-100 text-gray-800 font-medium rounded-lg"
        >
          Cancel
        </button>
      </div>
    </div>
  );
} 