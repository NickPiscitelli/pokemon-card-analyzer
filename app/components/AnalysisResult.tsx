import React, { useState, useEffect } from 'react';
import { CardMeasurements } from '~/models/cardAnalysisModel';
import { 
  ArrowDownTrayIcon, 
  ArrowLeftIcon, 
  ArrowPathIcon, 
  BugAntIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  MagnifyingGlassIcon
} from '@heroicons/react/24/solid';

interface AnalysisResultProps {
  imageUrl: string;
  edgeOverlayUrl?: string;
  measurements: CardMeasurements;
  potentialGrade: string;
  onBack: () => void;
  onReset: () => void;
  onAdjustBorder?: (
    type: 'outerEdges' | 'yellowBorder' | 'innerEdges',
    direction: 'left' | 'right' | 'top' | 'bottom',
    amount: number,
    algorithm?: 'Yellow' | 'Canny' | 'PSA'
  ) => void;
}

export default function AnalysisResult({ 
  imageUrl, 
  edgeOverlayUrl, 
  measurements, 
  potentialGrade,
  onBack,
  onReset,
  onAdjustBorder
}: AnalysisResultProps) {
  const [isDebugMode, setIsDebugMode] = useState(true);
  const [showAdjustmentControls, setShowAdjustmentControls] = useState(true);
  const [adjustmentType, setAdjustmentType] = useState<'outerEdges' | 'yellowBorder' | 'innerEdges'>('yellowBorder');
  const [algorithm, setAlgorithm] = useState<'Yellow' | 'Canny' | 'PSA'>('Canny');
  
  // Effect to handle algorithm changes
  useEffect(() => {
    // When algorithm changes, trigger a border adjustment to update detection
    if (onAdjustBorder && focusedBorder) {
      // Make a minimal adjustment that won't be noticeable but will trigger a redraw with new algorithm
      onAdjustBorder(adjustmentType, focusedBorder, 0, algorithm);
    }
  }, [algorithm, onAdjustBorder, focusedBorder, adjustmentType]);
  const [zoomFocus, setZoomFocus] = useState(true);
  const [focusedBorder, setFocusedBorder] = useState<'left' | 'right' | 'top' | 'bottom' | null>('left');
  const [zoomLevel, setZoomLevel] = useState<'fit' | 'full' | 'custom'>('fit');
  const [customZoom, setCustomZoom] = useState(100); // percentage
  const [showZoomOverlay, setShowZoomOverlay] = useState(false);
  const [zoomPosition, setZoomPosition] = useState({ x: 0, y: 0 });
  
  const { 
    leftBorder, 
    rightBorder, 
    topBorder, 
    bottomBorder,
    horizontalCentering,
    verticalCentering,
    overallCentering
  } = measurements;
  
  // Determine color based on centering score
  const getCenteringColor = (score: number) => {
    if (score >= 90) return 'text-green-600';
    if (score >= 75) return 'text-yellow-600';
    return 'text-red-600';
  };
  
  // Get progress bar color based on score
  const getProgressColor = (score: number) => {
    if (score >= 90) return 'bg-green-600';
    if (score >= 75) return 'bg-yellow-600';
    return 'bg-red-600';
  };
  
  // Format a number with 1 decimal place
  const formatNumber = (num: number) => {
    return num.toFixed(1);
  };
  
  // Format percentages to 1 decimal place
  const formatPercentage = (value: number) => `${value.toFixed(1)}%`;
  
  // Calculate the border offset ratio
  const horizontalRatio = leftBorder > 0 && rightBorder > 0 
    ? Math.max(leftBorder, rightBorder) / Math.min(leftBorder, rightBorder) 
    : 0;
  
  const verticalRatio = topBorder > 0 && bottomBorder > 0 
    ? Math.max(topBorder, bottomBorder) / Math.min(topBorder, bottomBorder) 
    : 0;
    
  // Calculate the distribution percentages for opposing sides
  const calculateDistribution = (side1: number, side2: number): [number, number] => {
    const total = side1 + side2;
    if (total <= 0) return [50, 50]; // Default to 50/50 if no measurements
    
    const side1Percent = (side1 / total) * 100;
    const side2Percent = (side2 / total) * 100;
    return [side1Percent, side2Percent];
  };
  
  const [leftPercent, rightPercent] = calculateDistribution(leftBorder, rightBorder);
  const [topPercent, bottomPercent] = calculateDistribution(topBorder, bottomBorder);
  
  // Format distribution as text (e.g., "55/45")
  const formatDistribution = (percent1: number, percent2: number) => 
    `${Math.round(percent1)}/${Math.round(percent2)}`;
  
  const horizontalDistribution = formatDistribution(leftPercent, rightPercent);
  const verticalDistribution = formatDistribution(topPercent, bottomPercent);
  
  // Format offset ratio
  const formatRatio = (value: number) => value > 0 ? `${value.toFixed(2)}:1` : 'N/A';
  
  // Determine centering grade based on overall centering percentage
  let centeringGradeLabel = 'Poor';
  let centeringColor = 'text-red-600';
  
  if (overallCentering >= 95) {
    centeringGradeLabel = 'Perfect';
    centeringColor = 'text-green-600';
  } else if (overallCentering >= 90) {
    centeringGradeLabel = 'Excellent';
    centeringColor = 'text-green-500';
  } else if (overallCentering >= 80) {
    centeringGradeLabel = 'Very Good';
    centeringColor = 'text-green-400';
  } else if (overallCentering >= 70) {
    centeringGradeLabel = 'Good';
    centeringColor = 'text-yellow-500';
  } else if (overallCentering >= 60) {
    centeringGradeLabel = 'Fair';
    centeringColor = 'text-orange-500';
  }
  
  // Toggle debug mode
  const toggleDebug = () => {
    setIsDebugMode(!isDebugMode);
  };
  
  // Toggle adjustment controls
  const toggleAdjustmentControls = () => {
    setShowAdjustmentControls(!showAdjustmentControls);
  };
  
  // Toggle between zoom modes
  const toggleZoomMode = () => {
    // Cycle through zoom modes: fit -> full -> custom -> fit
    if (zoomLevel === 'fit') {
      setZoomLevel('full');
    } else if (zoomLevel === 'full') {
      setZoomLevel('custom');
    } else {
      setZoomLevel('fit');
    }
  };
  
  // Adjust custom zoom level
  const adjustZoom = (amount: number) => {
    setZoomLevel('custom');
    setCustomZoom(prev => Math.max(50, Math.min(200, prev + amount)));
  };
  
  // Get image class based on zoom level
  const getImageClass = () => {
    if (!isDebugMode) return 'w-full rounded-lg shadow-md';
    
    switch (zoomLevel) {
      case 'fit':
        return 'max-h-[70vh] object-contain mx-auto rounded-lg shadow-md';
      case 'full':
        return 'w-full h-auto rounded-lg shadow-md';
      case 'custom':
        return `rounded-lg shadow-md mx-auto`;
    }
  };
  
  // Get image style based on zoom level
  const getImageStyle = () => {
    if (zoomLevel === 'custom') {
      return { 
        width: `${customZoom}%`,
        maxWidth: '100%'
      };
    }
    return {};
  };
  
  // Handle border adjustment
  const handleAdjustBorder = (
    type: 'outerEdges' | 'yellowBorder' | 'innerEdges',
    direction: 'left' | 'right' | 'top' | 'bottom', 
    amount: number
  ) => {
    if (onAdjustBorder) {
      // Use 0.5px as the minimum adjustment size for finest control
      const adjustmentAmount = amount * 0.5;
      
      // Set the focused border to the direction being adjusted
      setFocusedBorder(direction);
      
      // Pass the current algorithm to the parent component
      onAdjustBorder(type, direction, adjustmentAmount, algorithm);
      
      // If zoom focus is enabled, show the zoom overlay
      if (zoomFocus) {
        setShowZoomOverlay(true);
        
        // Keep the zoom overlay visible for 10 seconds after each adjustment
        setTimeout(() => {
          setShowZoomOverlay(false);
        }, 10000);
      }
    }
  };
  
  // Download the analysis as an image
  const downloadAnalysis = () => {
    // Create a canvas element
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      console.error('Failed to get canvas context');
      return;
    }
    
    // Set canvas dimensions
    canvas.width = 1200;
    canvas.height = 1600;
    
    // Draw background
    ctx.fillStyle = '#f8fafc'; // Tailwind slate-50
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Load and draw the card image
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = imageUrl;
    
    img.onload = () => {
      // Draw the card image
      const imgWidth = 600;
      const imgHeight = (img.height / img.width) * imgWidth;
      const imgX = (canvas.width - imgWidth) / 2;
      const imgY = 100;
      
      ctx.drawImage(img, imgX, imgY, imgWidth, imgHeight);
      
      // Draw title
      ctx.font = 'bold 48px Arial';
      ctx.fillStyle = '#0f172a'; // Tailwind slate-900
      ctx.textAlign = 'center';
      ctx.fillText('Pokémon Card Centering Analysis', canvas.width / 2, 60);
      
      // Draw measurements
      ctx.font = 'bold 36px Arial';
      ctx.fillText('Border Measurements', canvas.width / 2, imgY + imgHeight + 60);
      
      // Draw measurements table
      const tableY = imgY + imgHeight + 100;
      const tableWidth = 800;
      const tableX = (canvas.width - tableWidth) / 2;
      
      ctx.font = '28px Arial';
      ctx.textAlign = 'left';
      
      // Draw the measurements
      ctx.fillText(`Left Border: ${formatNumber(leftBorder)}px`, tableX, tableY);
      ctx.fillText(`Right Border: ${formatNumber(rightBorder)}px`, tableX, tableY + 40);
      ctx.fillText(`Top Border: ${formatNumber(topBorder)}px`, tableX, tableY + 80);
      ctx.fillText(`Bottom Border: ${formatNumber(bottomBorder)}px`, tableX, tableY + 120);
      
      // Draw centering scores
      ctx.font = 'bold 36px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('Centering Scores', canvas.width / 2, tableY + 180);
      
      ctx.font = '28px Arial';
      ctx.textAlign = 'left';
      
      // Horizontal centering
      ctx.fillText(`Horizontal Centering: ${formatNumber(horizontalCentering)}%`, tableX, tableY + 230);
      ctx.fillRect(tableX, tableY + 240, tableWidth, 20);
      ctx.fillStyle = getProgressColor(horizontalCentering);
      ctx.fillRect(tableX, tableY + 240, tableWidth * (horizontalCentering / 100), 20);
      
      // Reset fill style
      ctx.fillStyle = '#0f172a';
      
      // Vertical centering
      ctx.fillText(`Vertical Centering: ${formatNumber(verticalCentering)}%`, tableX, tableY + 290);
      ctx.fillRect(tableX, tableY + 300, tableWidth, 20);
      ctx.fillStyle = getProgressColor(verticalCentering);
      ctx.fillRect(tableX, tableY + 300, tableWidth * (verticalCentering / 100), 20);
      
      // Reset fill style
      ctx.fillStyle = '#0f172a';
      
      // Overall centering
      ctx.font = 'bold 32px Arial';
      ctx.fillText(`Overall Centering: ${formatNumber(overallCentering)}%`, tableX, tableY + 350);
      ctx.fillRect(tableX, tableY + 360, tableWidth, 30);
      ctx.fillStyle = getProgressColor(overallCentering);
      ctx.fillRect(tableX, tableY + 360, tableWidth * (overallCentering / 100), 30);
      
      // Reset fill style
      ctx.fillStyle = '#0f172a';
      
      // Draw potential grade
      ctx.font = 'bold 40px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('Potential Grade', canvas.width / 2, tableY + 430);
      
      ctx.font = 'bold 36px Arial';
      ctx.fillStyle = getProgressColor(overallCentering);
      ctx.fillText(potentialGrade, canvas.width / 2, tableY + 480);
      
      // Draw footer
      ctx.fillStyle = '#0f172a';
      ctx.font = '24px Arial';
      ctx.fillText('Generated by Pokémon Card Analyzer', canvas.width / 2, canvas.height - 40);
      
      // Convert canvas to blob and download
      canvas.toBlob((blob) => {
        if (!blob) {
          console.error('Failed to convert canvas to blob');
          return;
        }
        
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `pokemon-card-analysis-${Date.now()}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      });
    };
  };
  
  return (
    <div className="flex flex-col lg:flex-row gap-6 w-full max-w-6xl mx-auto bg-white rounded-lg shadow-lg p-6">
      <div className="flex-1 flex flex-col items-center">
        <h2 className="text-xl font-semibold mb-4">Card Analysis</h2>
        
        <div className="relative w-full max-w-md mb-4">
          {/* Always show edge overlay with borders */}
          <div className="overflow-auto max-h-[70vh] border border-gray-200 rounded-lg p-1">
            <img 
              src={edgeOverlayUrl || imageUrl} 
              alt="Card with analysis overlay" 
              className={getImageClass()}
              style={getImageStyle()}
            />
            
            {/* Zoom Overlay - shows when border adjustments are made */}
            {showZoomOverlay && (
              <div 
                className="absolute bg-white border-4 border-blue-500 shadow-lg overflow-hidden transition-all duration-300 transform scale-100 z-10" 
                style={{
                  right: '10px',
                  top: '10px',
                  width: '200px',
                  height: '200px',
                  opacity: 0.95
                }}
              >
                <div 
                  className="w-full h-full"
                  style={{
                    backgroundImage: `url(${edgeOverlayUrl || imageUrl})`,
                    backgroundSize: '400%',
                    backgroundPosition: focusedBorder === 'left' ? '15% 50%' : 
                                       focusedBorder === 'right' ? '85% 50%' : 
                                       focusedBorder === 'top' ? '50% 15%' : 
                                       focusedBorder === 'bottom' ? '50% 85%' : '50% 50%',
                  }}
                ></div>
                <div className="absolute bottom-2 right-2 bg-blue-700 text-white text-xs px-2 py-0.5 rounded opacity-75">
                  3x
                </div>
                {/* Border indicator */}
                {focusedBorder === 'left' && <div className="absolute left-0 top-0 bottom-0 w-2 bg-red-500 animate-pulse"></div>}
                {focusedBorder === 'right' && <div className="absolute right-0 top-0 bottom-0 w-2 bg-red-500 animate-pulse"></div>}
                {focusedBorder === 'top' && <div className="absolute top-0 left-0 right-0 h-2 bg-red-500 animate-pulse"></div>}
                {focusedBorder === 'bottom' && <div className="absolute bottom-0 left-0 right-0 h-2 bg-red-500 animate-pulse"></div>}
                
                {/* Crosshair */}
                <div className="absolute left-1/2 top-1/2 w-8 h-8 pointer-events-none opacity-60" style={{ transform: 'translate(-50%, -50%)' }}>
                  <div className="absolute left-1/2 top-0 bottom-0 w-px bg-blue-600"></div>
                  <div className="absolute top-1/2 left-0 right-0 h-px bg-blue-600"></div>
                </div>
              </div>
            )}
          </div>
          
          <div className="absolute bottom-3 right-3 flex space-x-2">
            {/* Debug toggle button */}
            <button
              onClick={toggleDebug}
              className="p-2 bg-gray-800 bg-opacity-70 rounded-full text-white hover:bg-opacity-90"
              title={isDebugMode ? "Show Original Image" : "Show Edge Detection"}
            >
              <BugAntIcon className="h-5 w-5" />
            </button>
            
            {/* Adjustment toggle button */}
            <button
              onClick={toggleAdjustmentControls}
              className={`p-2 ${showAdjustmentControls ? 'bg-blue-600' : 'bg-gray-800 bg-opacity-70'} rounded-full text-white hover:bg-opacity-90`}
              title="Toggle Fine-Tuning Controls"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
              </svg>
            </button>
          </div>
          
          {/* Zoom controls - always shown */}
          <div className="absolute bottom-3 left-3 flex items-center space-x-2 bg-gray-800 bg-opacity-70 rounded-full p-1">
            <button
              onClick={() => adjustZoom(-10)}
              className="p-1 text-white hover:bg-gray-700 rounded-full"
              title="Zoom Out"
              disabled={zoomLevel === 'fit' || (zoomLevel === 'custom' && customZoom <= 50)}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
              </svg>
            </button>
            
            <button
              onClick={toggleZoomMode}
              className="p-1 text-white hover:bg-gray-700 rounded-full"
              title={`Current: ${zoomLevel === 'fit' ? 'Fit to view' : zoomLevel === 'full' ? 'Full width' : `${customZoom}%`}`}
            >
              <span className="text-xs px-1">
                {zoomLevel === 'fit' ? 'Fit' : zoomLevel === 'full' ? '100%' : `${customZoom}%`}
              </span>
            </button>
            
            <button
              onClick={() => adjustZoom(10)}
              className="p-1 text-white hover:bg-gray-700 rounded-full"
              title="Zoom In"
              disabled={zoomLevel === 'full' || (zoomLevel === 'custom' && customZoom >= 200)}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>
        </div>
        
        {/* Adjustment Controls */}
        {showAdjustmentControls && (
          <div className="w-full bg-blue-50 p-4 rounded-lg mb-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-medium text-blue-800">Fine-Tuning Controls</h3>
              <div className="flex items-center space-x-2">
                <select 
                  className="text-sm font-medium text-gray-700 bg-white px-3 py-1 rounded-lg border"
                  value={algorithm}
                  onChange={(e) => setAlgorithm(e.target.value as 'Yellow' | 'Canny' | 'PSA')}
                >
                  <option value="Yellow">Yellow Detection</option>
                  <option value="Canny">Canny Edge</option>
                  <option value="PSA">PSA Template</option>
                </select>
                <div className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded">
                  Current: {algorithm}
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Left side: Border Selection */}
              <div className="space-y-4">
                {/* Border Type Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Border to Adjust
                  </label>
                  <select 
                    className="w-full p-2 border rounded-lg bg-white"
                    value={adjustmentType}
                    onChange={(e) => setAdjustmentType(e.target.value as 'outerEdges' | 'yellowBorder' | 'innerEdges')}
                  >
                    <option value="outerEdges">Outer Edges</option>
                    <option value="yellowBorder">Yellow Border</option>
                    <option value="innerEdges">Inner Edges</option>
                  </select>
                </div>

                {/* Edge Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Edge
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button 
                      className={`p-2 rounded-lg border ${focusedBorder === 'top' ? 'bg-blue-100 border-blue-500 font-medium' : 'bg-white'}`}
                      onClick={() => setFocusedBorder('top')}
                    >
                      Top
                    </button>
                    <button 
                      className={`p-2 rounded-lg border ${focusedBorder === 'bottom' ? 'bg-blue-100 border-blue-500 font-medium' : 'bg-white'}`}
                      onClick={() => setFocusedBorder('bottom')}
                    >
                      Bottom
                    </button>
                    <button 
                      className={`p-2 rounded-lg border ${focusedBorder === 'left' ? 'bg-blue-100 border-blue-500 font-medium' : 'bg-white'}`}
                      onClick={() => setFocusedBorder('left')}
                    >
                      Left
                    </button>
                    <button 
                      className={`p-2 rounded-lg border ${focusedBorder === 'right' ? 'bg-blue-100 border-blue-500 font-medium' : 'bg-white'}`}
                      onClick={() => setFocusedBorder('right')}
                    >
                      Right
                    </button>
                  </div>
                </div>

                {/* Settings */}
                <div className="space-y-2">
                  {/* Zoom Focus Toggle */}
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="zoomFocus"
                      checked={zoomFocus}
                      onChange={(e) => setZoomFocus(e.target.checked)}
                      className="w-4 h-4 text-blue-600"
                    />
                    <label htmlFor="zoomFocus" className="text-sm font-medium text-gray-700">
                      Show magnifier when adjusting
                    </label>
                  </div>
                  
                  {/* Already moved algorithm selection to the top bar */}
                </div>
              </div>

              {/* Center: Visual indicators */}
              <div className="flex items-center justify-center">
                <div className="relative w-48 h-48 border-2 border-gray-300 rounded-lg bg-white flex items-center justify-center">
                  {/* Card representation */}
                  <div className="w-32 h-40 bg-yellow-200 border border-yellow-600 rounded relative">
                    {/* Indicator for selected edge */}
                    {focusedBorder === 'top' && (
                      <div className="absolute top-0 left-0 right-0 h-2 bg-blue-500 animate-pulse"></div>
                    )}
                    {focusedBorder === 'bottom' && (
                      <div className="absolute bottom-0 left-0 right-0 h-2 bg-blue-500 animate-pulse"></div>
                    )}
                    {focusedBorder === 'left' && (
                      <div className="absolute top-0 bottom-0 left-0 w-2 bg-blue-500 animate-pulse"></div>
                    )}
                    {focusedBorder === 'right' && (
                      <div className="absolute top-0 bottom-0 right-0 w-2 bg-blue-500 animate-pulse"></div>
                    )}
                  </div>
                </div>
              </div>

              {/* Right side: Arrow Controls */}
              <div className="flex flex-col items-center justify-center space-y-4">
                <p className="text-sm font-medium text-gray-700">
                  Move {focusedBorder || 'selected'} edge
                </p>
                
                {!focusedBorder && (
                  <div className="bg-yellow-50 p-4 rounded-lg text-center w-full">
                    <p className="text-yellow-700 text-sm">Select an edge from the buttons on the left</p>
                  </div>
                )}
                
                {/* Top edge controls */}
                {focusedBorder === 'top' && (
                  <div className="grid grid-cols-1 gap-4">
                    <button 
                      className="py-4 px-8 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-lg w-full flex justify-center"
                      onClick={() => handleAdjustBorder(adjustmentType, focusedBorder, 1)}
                      title="Move top edge up (increase border)"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                      </svg>
                    </button>
                    
                    <button 
                      className="py-4 px-8 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-lg w-full flex justify-center"
                      onClick={() => handleAdjustBorder(adjustmentType, focusedBorder, -1)}
                      title="Move top edge down (decrease border)"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                      </svg>
                    </button>
                  </div>
                )}
                
                {/* Bottom edge controls */}
                {focusedBorder === 'bottom' && (
                  <div className="grid grid-cols-1 gap-4">
                    <button 
                      className="py-4 px-8 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-lg w-full flex justify-center"
                      onClick={() => handleAdjustBorder(adjustmentType, focusedBorder, -1)}
                      title="Move bottom edge up (decrease border)"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                      </svg>
                    </button>
                    
                    <button 
                      className="py-4 px-8 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-lg w-full flex justify-center"
                      onClick={() => handleAdjustBorder(adjustmentType, focusedBorder, 1)}
                      title="Move bottom edge down (increase border)"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                      </svg>
                    </button>
                  </div>
                )}
                
                {/* Left edge controls */}
                {focusedBorder === 'left' && (
                  <div className="grid grid-cols-1 gap-4">
                    <button 
                      className="py-4 px-8 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-lg w-full flex justify-center"
                      onClick={() => handleAdjustBorder(adjustmentType, focusedBorder, 1)}
                      title="Move left edge left (increase border)"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                      </svg>
                    </button>
                    
                    <button 
                      className="py-4 px-8 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-lg w-full flex justify-center"
                      onClick={() => handleAdjustBorder(adjustmentType, focusedBorder, -1)}
                      title="Move left edge right (decrease border)"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                      </svg>
                    </button>
                  </div>
                )}
                
                {/* Right edge controls */}
                {focusedBorder === 'right' && (
                  <div className="grid grid-cols-1 gap-4">
                    <button 
                      className="py-4 px-8 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-lg w-full flex justify-center"
                      onClick={() => handleAdjustBorder(adjustmentType, focusedBorder, -1)}
                      title="Move right edge left (decrease border)"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                      </svg>
                    </button>
                    
                    <button 
                      className="py-4 px-8 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-lg w-full flex justify-center"
                      onClick={() => handleAdjustBorder(adjustmentType, focusedBorder, 1)}
                      title="Move right edge right (increase border)"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                      </svg>
                    </button>
                  </div>
                )}
                
                <div className="text-center p-2 bg-gray-100 rounded-lg w-full">
                  <span className="text-sm font-medium">
                    {adjustmentType === 'outerEdges' && 'Card Edges'}
                    {adjustmentType === 'yellowBorder' && 'Yellow Border'}
                    {adjustmentType === 'innerEdges' && 'Inner Edges'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Debug Information - Always shown and not overlaid */}
        <div className="w-full bg-gray-100 p-4 rounded-lg mb-4 text-sm">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-base font-medium">Measurement Details</h3>
            <div className="text-sm font-medium px-2 py-1 bg-white rounded border flex items-center space-x-2">
              <span>Using</span> 
              <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full">{algorithm}</span>
              <span>Algorithm</span>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>Left Border:</span>
                <span className="font-medium">{leftBorder.toFixed(1)}px</span>
              </div>
              <div className="flex justify-between">
                <span>Right Border:</span>
                <span className="font-medium">{rightBorder.toFixed(1)}px</span>
              </div>
              <div className="flex justify-between">
                <span>Top Border:</span>
                <span className="font-medium">{topBorder.toFixed(1)}px</span>
              </div>
              <div className="flex justify-between">
                <span>Bottom Border:</span>
                <span className="font-medium">{bottomBorder.toFixed(1)}px</span>
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>Horizontal Ratio:</span>
                <span className="font-medium">{formatRatio(horizontalRatio)}</span>
              </div>
              <div className="flex justify-between">
                <span>Vertical Ratio:</span>
                <span className="font-medium">{formatRatio(verticalRatio)}</span>
              </div>
              <div className="flex justify-between">
                <span>L/R Distribution:</span>
                <span className="font-medium">{horizontalDistribution}</span>
              </div>
              <div className="flex justify-between">
                <span>T/B Distribution:</span>
                <span className="font-medium">{verticalDistribution}</span>
              </div>
            </div>
          </div>
          
          <div className="mt-4 space-y-2">
            <div className="flex justify-between items-center">
              <span>Horizontal Centering:</span>
              <span className={`font-medium ${getCenteringColor(horizontalCentering)}`}>
                {formatPercentage(horizontalCentering)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span>Vertical Centering:</span>
              <span className={`font-medium ${getCenteringColor(verticalCentering)}`}>
                {formatPercentage(verticalCentering)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span>Overall Centering:</span>
              <span className={`font-medium ${getCenteringColor(overallCentering)}`}>
                {formatPercentage(overallCentering)}
              </span>
            </div>
          </div>
          
          {/* Visual distribution bars */}
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="mb-3">
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs text-gray-600">Left-Right Distribution</span>
                <span className="text-xs text-gray-600">{horizontalDistribution}</span>
              </div>
              <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                <div className="bg-blue-500 h-full float-left" style={{ width: `${leftPercent}%` }}></div>
                <div className="bg-green-500 h-full float-left" style={{ width: `${rightPercent}%` }}></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs text-gray-600">Top-Bottom Distribution</span>
                <span className="text-xs text-gray-600">{verticalDistribution}</span>
              </div>
              <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                <div className="bg-blue-500 h-full float-left" style={{ width: `${topPercent}%` }}></div>
                <div className="bg-green-500 h-full float-left" style={{ width: `${bottomPercent}%` }}></div>
              </div>
            </div>
          </div>
        </div>
        
        <div className="flex space-x-4">
          <button
            onClick={downloadAnalysis}
            className="flex items-center justify-center py-2 px-4 bg-green-600 text-white rounded-lg shadow hover:bg-green-700"
          >
            <ArrowDownTrayIcon className="h-5 w-5 mr-2" />
            Download Report
          </button>
          
          <button
            onClick={onReset}
            className="flex items-center justify-center py-2 px-4 bg-blue-600 text-white rounded-lg shadow hover:bg-blue-700"
          >
            <ArrowPathIcon className="h-5 w-5 mr-2" />
            Analyze Another
          </button>
        </div>
      </div>
      
      <div className="flex-1">
        <div className="bg-gray-50 rounded-lg shadow p-6">
          <h3 className="text-lg font-medium mb-4 border-b pb-2">Centering Measurements</h3>
          
          <div className="mb-6">
            <h4 className="font-medium mb-2">Overall Centering Grade</h4>
            <div className={`text-3xl font-bold ${centeringColor}`}>
              {centeringGradeLabel} ({formatPercentage(overallCentering)})
            </div>
          </div>
          
          <div className="mb-6">
            <h4 className="font-medium mb-2">Centering Details</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-gray-600">Horizontal Centering</div>
                <div className="text-lg font-semibold">{formatPercentage(horizontalCentering)}</div>
                <div className="text-xs text-gray-500">Left/Right: {horizontalDistribution}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Vertical Centering</div>
                <div className="text-lg font-semibold">{formatPercentage(verticalCentering)}</div>
                <div className="text-xs text-gray-500">Top/Bottom: {verticalDistribution}</div>
              </div>
            </div>
          </div>
          
          <div className="mb-6">
            <h4 className="font-medium mb-2">Border Measurements</h4>
            <div className="grid grid-cols-2 gap-x-6 gap-y-2">
              <div>
                <div className="text-sm text-gray-600">Left-Right Ratio</div>
                <div className="text-lg font-semibold">{formatRatio(horizontalRatio)}</div>
                <div className="flex w-full h-2 bg-gray-200 rounded-full overflow-hidden mt-1">
                  <div className="bg-blue-500 h-full" style={{ width: `${leftPercent}%` }}></div>
                  <div className="bg-green-500 h-full" style={{ width: `${rightPercent}%` }}></div>
                </div>
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>L: {Math.round(leftPercent)}%</span>
                  <span>R: {Math.round(rightPercent)}%</span>
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Top-Bottom Ratio</div>
                <div className="text-lg font-semibold">{formatRatio(verticalRatio)}</div>
                <div className="flex w-full h-2 bg-gray-200 rounded-full overflow-hidden mt-1">
                  <div className="bg-blue-500 h-full" style={{ width: `${topPercent}%` }}></div>
                  <div className="bg-green-500 h-full" style={{ width: `${bottomPercent}%` }}></div>
                </div>
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>T: {Math.round(topPercent)}%</span>
                  <span>B: {Math.round(bottomPercent)}%</span>
                </div>
              </div>
            </div>
          </div>
          
          <div>
            <h4 className="font-medium mb-2">PSA Potential Grade</h4>
            <div className="text-2xl font-bold text-blue-600">{potentialGrade}</div>
            <p className="text-sm text-gray-500 mt-1">
              Based on centering metrics only. Actual grade depends on additional factors.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
} 