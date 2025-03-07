import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { ArrowUpTrayIcon, PhotoIcon, XMarkIcon, ArrowPathIcon, BugAntIcon } from '@heroicons/react/24/solid';
import { cardDetector } from '~/models/cardDetectionModel';
import { cardAnalyzer } from '~/models/cardAnalysisModel';
import { saveCard, generateId } from '~/utils/storage';

interface CardUploaderProps {
  onUpload: (result: any) => void;
  onClose: () => void;
}

export default function CardUploader({ onUpload, onClose }: CardUploaderProps) {
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<any | null>(null);
  const [showDebug, setShowDebug] = useState(false);
  
  const handleDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;
    
    const file = acceptedFiles[0];
    
    // Check if file is an image
    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file');
      return;
    }
    
    // Check file size (limit to 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError('File size too large. Please upload an image smaller than 10MB');
      return;
    }
    
    setUploading(true);
    setError(null);
    setDebugInfo(null);
    
    try {
      // Read file and convert to data URL
      const reader = new FileReader();
      
      const imageUrl = await new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          if (typeof reader.result === 'string') {
            resolve(reader.result);
          } else {
            reject(new Error('Failed to read file'));
          }
        };
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsDataURL(file);
      });
      
      setUploadedImage(imageUrl);
    } catch (error) {
      console.error('Error uploading image:', error);
      setError('Failed to upload image. Please try again.');
    }
    
    setUploading(false);
  }, []);
  
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: handleDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.webp']
    },
    maxFiles: 1,
    disabled: uploading || analyzing
  });
  
  const cancelUpload = useCallback(() => {
    setUploadedImage(null);
    setError(null);
    setDebugInfo(null);
  }, []);
  
  const analyzeCard = useCallback(async () => {
    if (!uploadedImage) return;
    
    setAnalyzing(true);
    setError(null);
    setDebugInfo(null);
    
    try {
      // Create an image element from the uploaded image
      const img = new Image();
      img.src = uploadedImage;
      
      // Wait for the image to load
      await new Promise<void>((resolve) => {
        img.onload = () => resolve();
      });
      
      // First, detect if there's a card in the image
      const potentialCards = await cardDetector.detectCard(img);
      
      // Store debug info
      setDebugInfo({
        imageWidth: img.width,
        imageHeight: img.height,
        potentialCards: potentialCards,
        timestamp: new Date().toISOString()
      });
      
      if (potentialCards.length === 0) {
        throw new Error('No card detected in the image');
      }
      
      // Analyze the card centering
      const analysisResult = await cardAnalyzer.analyzeCard(img);
      
      // Save the card to history
      const cardRecord = {
        id: generateId(),
        timestamp: Date.now(),
        imageUrl: uploadedImage,
        measurements: analysisResult.measurements,
        potentialGrade: analysisResult.potentialGrade
      };
      
      await saveCard(cardRecord);
      
      // Pass the result back to the parent component
      onUpload({
        ...analysisResult,
        imageUrl: uploadedImage,
        analyzer: cardAnalyzer
      });
    } catch (error) {
      console.error('Failed to analyze card:', error);
      setError(`Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    
    setAnalyzing(false);
  }, [uploadedImage, onUpload]);
  
  const toggleDebug = useCallback(() => {
    setShowDebug(prev => !prev);
  }, []);
  
  return (
    <div className="flex flex-col items-center w-full max-w-md mx-auto bg-white rounded-lg shadow-lg overflow-hidden">
      {error && (
        <div className="w-full p-4 bg-red-100 text-red-800 text-sm">
          {error}
          {debugInfo && (
            <button 
              onClick={toggleDebug}
              className="ml-2 text-blue-600 underline"
            >
              {showDebug ? 'Hide Debug Info' : 'Show Debug Info'}
            </button>
          )}
        </div>
      )}
      
      {debugInfo && showDebug && (
        <div className="w-full p-4 bg-gray-100 text-gray-800 text-xs font-mono overflow-auto">
          <h4 className="font-bold mb-1">Debug Information:</h4>
          <pre className="whitespace-pre-wrap break-all">
            {JSON.stringify(debugInfo, null, 2)}
          </pre>
        </div>
      )}
      
      <div className="w-full p-4">
        {!uploadedImage ? (
          <div 
            {...getRootProps()} 
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
              isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-gray-50'
            }`}
          >
            <input {...getInputProps()} />
            
            <PhotoIcon className="mx-auto h-12 w-12 text-gray-400" />
            
            <p className="mt-2 text-sm font-medium text-gray-900">
              {isDragActive ? 'Drop the image here' : 'Drag and drop a card image'}
            </p>
            
            <p className="mt-1 text-xs text-gray-500">
              PNG, JPG, JPEG up to 10MB
            </p>
            
            <button
              type="button"
              disabled={uploading}
              className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-300"
            >
              {uploading ? (
                <>
                  <ArrowPathIcon className="h-5 w-5 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <ArrowUpTrayIcon className="h-5 w-5 mr-2" />
                  Upload
                </>
              )}
            </button>
          </div>
        ) : (
          <div className="relative">
            <img 
              src={uploadedImage} 
              alt="Uploaded card" 
              className="w-full rounded-lg shadow-md" 
            />
            <button
              onClick={cancelUpload}
              className="absolute top-2 right-2 p-1 bg-black bg-opacity-50 rounded-full text-white hover:bg-opacity-70"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
            
            <div className="mt-4 flex gap-2">
              <button
                onClick={cancelUpload}
                className="flex-1 py-3 px-4 bg-gray-200 text-gray-800 font-medium rounded-lg flex items-center justify-center"
              >
                Upload Different
              </button>
              <button
                onClick={analyzeCard}
                disabled={analyzing}
                className="flex-1 py-3 px-4 bg-green-600 text-white font-medium rounded-lg flex items-center justify-center disabled:bg-gray-400"
              >
                {analyzing ? (
                  <>
                    <ArrowPathIcon className="h-5 w-5 mr-2 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  'Analyze Card'
                )}
              </button>
            </div>
          </div>
        )}
      </div>
      
      <div className="p-4 w-full flex justify-between">
        <button
          onClick={onClose}
          className="w-full py-2 px-4 bg-gray-100 text-gray-800 font-medium rounded-lg"
        >
          Cancel
        </button>
        
        <button 
          onClick={toggleDebug}
          className="ml-2 p-2 bg-gray-200 text-gray-700 rounded-lg flex items-center justify-center"
          title="Toggle Debug Mode"
        >
          <BugAntIcon className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
} 