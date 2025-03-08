import React, { useState, useEffect, useRef } from 'react';
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
    type: 'outer' | 'inner',
    direction: 'left' | 'right' | 'top' | 'bottom',
    amount: number
  ) => void;
  onResetAdjustments?: () => void;
}

export default function AnalysisResult({ 
  imageUrl, 
  edgeOverlayUrl, 
  measurements, 
  potentialGrade,
  onBack,
  onReset,
  onAdjustBorder,
  onResetAdjustments
}: AnalysisResultProps) {
  const [showAdjustmentControls, setShowAdjustmentControls] = useState(true);
  const [adjustmentType, setAdjustmentType] = useState<'outer' | 'inner'>('outer');
  const [focusedBorder, setFocusedBorder] = useState<'left' | 'right' | 'top' | 'bottom' | null>(null);
  const [zoomFocus, setZoomFocus] = useState(true);
  const [showZoomOverlay, setShowZoomOverlay] = useState(false);
  const [zoomPosition, setZoomPosition] = useState({ x: 0, y: 0 });
  const zoomOverlayTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Effect to handle algorithm changes
  useEffect(() => {
    if (onAdjustBorder && focusedBorder) {
      onAdjustBorder(adjustmentType, focusedBorder, 0);
    }
  }, [onAdjustBorder, focusedBorder, adjustmentType]);
  
  // Add effect to log URL changes
  useEffect(() => {
    console.log('AnalysisResult received new overlay URL:', edgeOverlayUrl);
  }, [edgeOverlayUrl]);
  
  // Add effect to log measurement changes and distribution calculations
  useEffect(() => {
    console.log('AnalysisResult received new measurements:', measurements);
    const { topBorder, bottomBorder } = measurements;
    console.log('Top border:', topBorder, 'Bottom border:', bottomBorder);
    
    // Calculate distribution percentages for logging
    const total = topBorder + bottomBorder;
    const topPercentCalc = total > 0 ? (topBorder / total) * 100 : 50;
    const bottomPercentCalc = total > 0 ? (bottomBorder / total) * 100 : 50;
    console.log('Top/Bottom distribution:', topPercentCalc.toFixed(1), bottomPercentCalc.toFixed(1));
    console.log('Vertical distribution formatted:', `${Math.round(topPercentCalc)}/${Math.round(bottomPercentCalc)}`);
  }, [measurements]);
  
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
  
  if (overallCentering >= 97) {
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
  
  // Toggle adjustment controls
  const toggleAdjustmentControls = () => {
    setShowAdjustmentControls(!showAdjustmentControls);
  };
  
  // Handle border adjustment
  const handleAdjustBorder = (
    type: 'outer' | 'inner',
    direction: 'left' | 'right' | 'top' | 'bottom', 
    amount: number
  ) => {
    if (onAdjustBorder) {
      // Use 0.5px as the minimum adjustment size for finest control
      const adjustmentAmount = amount * 0.5;
      
      // Set the focused border to the direction being adjusted
      setFocusedBorder(direction);
      
      // Call the parent's onAdjustBorder
      onAdjustBorder(type, direction, adjustmentAmount);
      
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
  
  const getZoomPosition = () => {
    if (!focusedBorder) return { x: '50%', y: '50%' };
    
    // For each edge, we want to:
    // - Center the view on the opposite axis (50%)
    // - Position the edge at the corresponding side of the zoom window
    switch (focusedBorder) {
      case 'left':
        return { x: '0', y: '50%' };
      case 'right':
        return { x: '100%', y: '50%' };
      case 'top':
        return { x: '50%', y: '25%' };  // Adjusted to show the top edge properly
      case 'bottom':
        return { x: '50%', y: '100%' };
      default:
        return { x: '50%', y: '50%' };
    }
  };
  
  // Get zoom window style
  const getZoomWindowStyle = () => {
    const { x, y } = getZoomPosition();
    const baseStyle = {
      position: 'absolute' as const,
      width: '200px',
      height: '200px',
      opacity: 0.95,
    };

    // Adjust position based on focused border
    if (focusedBorder === 'left') {
      return {
        ...baseStyle,
        left: '10px',
        top: '50%',
        transform: 'translateY(-50%)',
      };
    } else if (focusedBorder === 'right') {
      return {
        ...baseStyle,
        right: '10px',
        top: '50%',
        transform: 'translateY(-50%)',
      };
    } else if (focusedBorder === 'top') {
      return {
        ...baseStyle,
        top: '10px',
        left: '50%',
        transform: 'translateX(-50%)',
      };
    } else if (focusedBorder === 'bottom') {
      return {
        ...baseStyle,
        bottom: '10px',
        left: '50%',
        transform: 'translateX(-50%)',
      };
    }

    // Default position (top-right corner)
    return {
      ...baseStyle,
      right: '10px',
      top: '10px',
    };
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
          <div className="overflow-auto max-h-[70vh] border border-gray-200 rounded-lg p-1">
            <img 
              src={edgeOverlayUrl || imageUrl} 
              alt="Card with analysis overlay" 
              className="w-full rounded-lg shadow-md"
            />
            
            {/* Zoom Overlay - shows when border adjustments are made */}
            {showZoomOverlay && (
              <div 
                className="bg-white border-4 border-black shadow-lg overflow-hidden transition-all duration-300 transform scale-100 z-10"
                style={getZoomWindowStyle()}
              >
                <div 
                  className="w-full h-full"
                  style={{
                    backgroundImage: `url(${edgeOverlayUrl || imageUrl})`,
                    backgroundSize: '300%',
                    backgroundPosition: getZoomPosition().x + ' ' + getZoomPosition().y,
                    backgroundRepeat: 'no-repeat',
                    transformOrigin: getZoomPosition().x + ' ' + getZoomPosition().y
                  }}
                ></div>
                <div className="absolute bottom-2 right-2 bg-black text-white text-xs px-2 py-0.5 rounded opacity-75">
                  3x
                </div>
                {/* Border indicator */}
                {focusedBorder === 'left' && (
                  <div 
                    className="absolute top-0 bottom-0 w-0.5 bg-red-500 animate-pulse" 
                    style={{ left: '33.333%' }}
                  ></div>
                )}
                {focusedBorder === 'right' && (
                  <div 
                    className="absolute top-0 bottom-0 w-0.5 bg-red-500 animate-pulse" 
                    style={{ left: '66.666%' }}
                  ></div>
                )}
                {focusedBorder === 'top' && (
                  <div 
                    className="absolute left-0 right-0 h-0.5 bg-red-500 animate-pulse" 
                    style={{ top: '50%' }}
                  ></div>
                )}
                {focusedBorder === 'bottom' && (
                  <div 
                    className="absolute left-0 right-0 h-0.5 bg-red-500 animate-pulse" 
                    style={{ top: '66.666%' }}
                  ></div>
                )}
                
                {/* Crosshair */}
                <div className="absolute left-1/2 top-1/2 w-8 h-8 pointer-events-none opacity-60" style={{ transform: 'translate(-50%, -50%)' }}>
                  <div className="absolute left-1/2 top-0 bottom-0 w-px bg-black"></div>
                  <div className="absolute top-1/2 left-0 right-0 h-px bg-black"></div>
                </div>
              </div>
            )}
          </div>
          
          <div className="absolute bottom-3 right-3 flex space-x-2">
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
        </div>
        
        {/* Adjustment Controls */}
        {showAdjustmentControls && (
          <div className="w-full bg-blue-50 p-4 rounded-lg mb-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-medium text-blue-800">Fine-Tuning Controls</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Left side: Border Selection */}
              <div className="space-y-4">
                {/* Border Type Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Border to Adjust
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button 
                      className={`p-2 rounded-lg border ${adjustmentType === 'outer' ? 'bg-blue-100 border-blue-500 font-medium' : 'bg-white'}`}
                      onClick={() => setAdjustmentType('outer')}
                    >
                      Outer Edges
                    </button>
                    <button 
                      className={`p-2 rounded-lg border ${adjustmentType === 'inner' ? 'bg-blue-100 border-blue-500 font-medium' : 'bg-white'}`}
                      onClick={() => setAdjustmentType('inner')}
                    >
                      Inner Edges
                    </button>
                  </div>
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
                    {adjustmentType === 'outer' && 'Outer Edges'}
                    {adjustmentType === 'inner' && 'Inner Edges'}
                  </span>
                </div>
              </div>
            </div>
            
            {/* Reset Adjustments Button */}
            {onResetAdjustments && (
              <div className="mt-6 flex justify-center">
                <button
                  onClick={onResetAdjustments}
                  className="flex items-center py-2 px-4 bg-red-600 text-white rounded-lg shadow hover:bg-red-700"
                  title="Reset all manual adjustments"
                >
                  <ArrowPathIcon className="h-5 w-5 mr-2" />
                  Reset Adjustments
                </button>
              </div>
            )}
          </div>
        )}
        
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
          <h3 className="text-lg font-medium mb-4 border-b pb-2">Centering Analysis</h3>
          
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
          </div>
          
          <div className="mb-6">
            <h4 className="font-medium mb-2">Distribution Visualization</h4>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm text-gray-600">Left-Right Distribution</span>
                  <span className="text-sm text-gray-600">{horizontalDistribution}</span>
                </div>
                <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div className="bg-blue-500 h-full float-left" style={{ width: `${leftPercent}%` }}></div>
                  <div className="bg-green-500 h-full float-left" style={{ width: `${rightPercent}%` }}></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm text-gray-600">Top-Bottom Distribution</span>
                  <span className="text-sm text-gray-600">{verticalDistribution}</span>
                </div>
                <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div className="bg-blue-500 h-full float-left" style={{ width: `${topPercent}%` }}></div>
                  <div className="bg-green-500 h-full float-left" style={{ width: `${bottomPercent}%` }}></div>
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