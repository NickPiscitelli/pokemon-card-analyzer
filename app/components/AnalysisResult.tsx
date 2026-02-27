import React, { useState, useEffect, useRef } from 'react';
import { CardMeasurements, MultiGraderPredictions, CardAnalyzer } from '~/models/cardAnalysisModel';
import {
  ArrowDownTrayIcon,
  ArrowPathIcon,
  ClipboardIcon,
  CheckIcon,
  ChevronUpIcon,
  ChevronDownIcon,
} from '@heroicons/react/24/solid';

interface AnalysisResultProps {
  imageUrl: string;
  edgeOverlayUrl?: string;
  measurements: CardMeasurements;
  potentialGrade: string;
  graderPredictions?: MultiGraderPredictions;
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
  graderPredictions,
  onBack,
  onReset,
  onAdjustBorder,
  onResetAdjustments
}: AnalysisResultProps) {
  const [showAdjustmentControls, setShowAdjustmentControls] = useState(false);
  const [adjustmentType, setAdjustmentType] = useState<'outer' | 'inner'>('outer');
  const [focusedBorder, setFocusedBorder] = useState<'left' | 'right' | 'top' | 'bottom' | null>(null);
  const [zoomFocus, setZoomFocus] = useState(true);
  const [showZoomOverlay, setShowZoomOverlay] = useState(false);
  const [copied, setCopied] = useState(false);

  const {
    leftBorder, rightBorder, topBorder, bottomBorder,
    horizontalCentering, verticalCentering, overallCentering
  } = measurements;

  // Distribution calculations
  const calcDist = (a: number, b: number): [number, number] => {
    const total = a + b;
    if (total <= 0) return [50, 50];
    return [(a / total) * 100, (b / total) * 100];
  };

  const [leftPct, rightPct] = calcDist(leftBorder, rightBorder);
  const [topPct, bottomPct] = calcDist(topBorder, bottomBorder);

  const hDiffPct = Math.abs(leftPct - rightPct);
  const vDiffPct = Math.abs(topPct - bottomPct);

  const formatDist = (a: number, b: number) => `${Math.round(a)}/${Math.round(b)}`;

  // Color coding for centering quality
  const getDiffColor = (diffPct: number) => {
    if (diffPct < 10) return { text: 'text-green-600 dark:text-green-400', bg: 'bg-green-100 dark:bg-green-900/30', label: 'Excellent' };
    if (diffPct < 20) return { text: 'text-yellow-600 dark:text-yellow-400', bg: 'bg-yellow-100 dark:bg-yellow-900/30', label: 'Borderline' };
    return { text: 'text-red-600 dark:text-red-400', bg: 'bg-red-100 dark:bg-red-900/30', label: 'Poor' };
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-600 dark:text-green-400';
    if (score >= 75) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  const getProgressColor = (score: number) => {
    if (score >= 90) return 'bg-green-500';
    if (score >= 75) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  // Grader card styling
  const getGraderStyle = (meetsThreshold: boolean) => {
    if (meetsThreshold) return 'border-green-500 bg-green-50 dark:bg-green-900/20';
    return 'border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50';
  };

  const getGraderGradeColor = (meetsThreshold: boolean) => {
    if (meetsThreshold) return 'text-green-600 dark:text-green-400';
    return 'text-gray-700 dark:text-gray-300';
  };

  // Handle border adjustment
  const handleAdjust = (direction: 'left' | 'right' | 'top' | 'bottom', amount: number) => {
    if (onAdjustBorder) {
      onAdjustBorder(adjustmentType, direction, amount * 0.5);
      setFocusedBorder(direction);
      if (zoomFocus) {
        setShowZoomOverlay(true);
        setTimeout(() => setShowZoomOverlay(false), 10000);
      }
    }
  };

  const getZoomPosition = () => {
    switch (focusedBorder) {
      case 'left': return { x: '0', y: '50%' };
      case 'right': return { x: '100%', y: '50%' };
      case 'top': return { x: '50%', y: '25%' };
      case 'bottom': return { x: '50%', y: '100%' };
      default: return { x: '50%', y: '50%' };
    }
  };

  const getZoomStyle = () => {
    const base = { position: 'absolute' as const, width: '180px', height: '180px', opacity: 0.95 };
    if (focusedBorder === 'left') return { ...base, left: '8px', top: '50%', transform: 'translateY(-50%)' };
    if (focusedBorder === 'right') return { ...base, right: '8px', top: '50%', transform: 'translateY(-50%)' };
    if (focusedBorder === 'top') return { ...base, top: '8px', left: '50%', transform: 'translateX(-50%)' };
    if (focusedBorder === 'bottom') return { ...base, bottom: '8px', left: '50%', transform: 'translateX(-50%)' };
    return { ...base, right: '8px', top: '8px' };
  };

  // Copy centering data to clipboard
  const copyToClipboard = async () => {
    const data = {
      measurements: {
        leftBorder: +leftBorder.toFixed(1),
        rightBorder: +rightBorder.toFixed(1),
        topBorder: +topBorder.toFixed(1),
        bottomBorder: +bottomBorder.toFixed(1),
      },
      centering: {
        horizontal: +horizontalCentering.toFixed(1),
        vertical: +verticalCentering.toFixed(1),
        overall: +overallCentering.toFixed(1),
      },
      distribution: {
        leftRight: formatDist(leftPct, rightPct),
        topBottom: formatDist(topPct, bottomPct),
      },
      predictions: graderPredictions ? {
        PSA: graderPredictions.psa.grade,
        BGS: graderPredictions.bgs.grade,
        CGC: graderPredictions.cgc.grade,
      } : { grade: potentialGrade },
    };

    try {
      await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const textArea = document.createElement('textarea');
      textArea.value = JSON.stringify(data, null, 2);
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Download analysis as image
  const downloadAnalysis = () => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = 1200;
    canvas.height = 1800;

    // Background
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Header gradient
    const headerGrad = ctx.createLinearGradient(0, 0, canvas.width, 0);
    headerGrad.addColorStop(0, '#2563eb');
    headerGrad.addColorStop(1, '#7c3aed');
    ctx.fillStyle = headerGrad;
    ctx.fillRect(0, 0, canvas.width, 80);

    ctx.font = 'bold 32px Arial';
    ctx.fillStyle = 'white';
    ctx.textAlign = 'center';
    ctx.fillText('Pokemon Card Centering Analysis', canvas.width / 2, 52);

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = edgeOverlayUrl || imageUrl;

    img.onload = () => {
      // Card image
      const imgW = 500;
      const imgH = (img.height / img.width) * imgW;
      const imgX = (canvas.width - imgW) / 2;
      const imgY = 110;

      // Card shadow
      ctx.shadowColor = 'rgba(0,0,0,0.5)';
      ctx.shadowBlur = 20;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 10;
      ctx.drawImage(img, imgX, imgY, imgW, imgH);
      ctx.shadowBlur = 0;

      const startY = imgY + imgH + 40;

      // Section: Centering Scores
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(50, startY, canvas.width - 100, 140);
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1;
      ctx.strokeRect(50, startY, canvas.width - 100, 140);

      ctx.font = 'bold 24px Arial';
      ctx.fillStyle = '#94a3b8';
      ctx.textAlign = 'left';
      ctx.fillText('CENTERING SCORES', 80, startY + 35);

      // Score bars
      const barY = startY + 55;
      const barW = 300;

      // Horizontal
      ctx.font = '18px Arial';
      ctx.fillStyle = '#cbd5e1';
      ctx.fillText(`Horizontal: ${horizontalCentering.toFixed(1)}%`, 80, barY + 15);
      ctx.fillStyle = '#334155';
      ctx.fillRect(80, barY + 22, barW, 12);
      ctx.fillStyle = horizontalCentering >= 90 ? '#22c55e' : horizontalCentering >= 75 ? '#eab308' : '#ef4444';
      ctx.fillRect(80, barY + 22, barW * (horizontalCentering / 100), 12);

      // Vertical
      ctx.fillStyle = '#cbd5e1';
      ctx.fillText(`Vertical: ${verticalCentering.toFixed(1)}%`, 500, barY + 15);
      ctx.fillStyle = '#334155';
      ctx.fillRect(500, barY + 22, barW, 12);
      ctx.fillStyle = verticalCentering >= 90 ? '#22c55e' : verticalCentering >= 75 ? '#eab308' : '#ef4444';
      ctx.fillRect(500, barY + 22, barW * (verticalCentering / 100), 12);

      // Overall
      ctx.font = 'bold 20px Arial';
      ctx.fillStyle = '#cbd5e1';
      ctx.fillText(`Overall: ${overallCentering.toFixed(1)}%`, 920, barY + 15);

      // Section: Distribution & Measurements
      const secY = startY + 160;
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(50, secY, canvas.width - 100, 120);
      ctx.strokeStyle = '#334155';
      ctx.strokeRect(50, secY, canvas.width - 100, 120);

      ctx.font = 'bold 24px Arial';
      ctx.fillStyle = '#94a3b8';
      ctx.fillText('DISTRIBUTION', 80, secY + 35);

      ctx.font = '20px Arial';
      ctx.fillStyle = '#cbd5e1';
      ctx.fillText(`L/R: ${formatDist(leftPct, rightPct)}  (${leftBorder.toFixed(1)}px / ${rightBorder.toFixed(1)}px)`, 80, secY + 70);
      ctx.fillText(`T/B: ${formatDist(topPct, bottomPct)}  (${topBorder.toFixed(1)}px / ${bottomBorder.toFixed(1)}px)`, 80, secY + 100);

      // Section: Grade Predictions
      const gradeY = secY + 140;
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(50, gradeY, canvas.width - 100, 130);
      ctx.strokeStyle = '#334155';
      ctx.strokeRect(50, gradeY, canvas.width - 100, 130);

      ctx.font = 'bold 24px Arial';
      ctx.fillStyle = '#94a3b8';
      ctx.fillText('PREDICTED CENTERING GRADES', 80, gradeY + 35);

      if (graderPredictions) {
        const preds = [graderPredictions.psa, graderPredictions.bgs, graderPredictions.cgc];
        const colW = (canvas.width - 200) / 3;
        preds.forEach((p, i) => {
          const cx = 100 + i * colW + colW / 2;
          ctx.font = 'bold 18px Arial';
          ctx.fillStyle = '#94a3b8';
          ctx.textAlign = 'center';
          ctx.fillText(p.company, cx, gradeY + 65);
          ctx.font = 'bold 28px Arial';
          ctx.fillStyle = p.meetsThreshold ? '#22c55e' : '#cbd5e1';
          ctx.fillText(p.grade, cx, gradeY + 100);
          ctx.font = '14px Arial';
          ctx.fillStyle = '#64748b';
          ctx.fillText(p.label, cx, gradeY + 120);
        });
        ctx.textAlign = 'left';
      } else {
        ctx.font = 'bold 36px Arial';
        ctx.fillStyle = '#3b82f6';
        ctx.textAlign = 'center';
        ctx.fillText(potentialGrade, canvas.width / 2, gradeY + 90);
        ctx.textAlign = 'left';
      }

      // Footer
      ctx.font = '16px Arial';
      ctx.fillStyle = '#475569';
      ctx.textAlign = 'center';
      ctx.fillText('Generated by Pokemon Card Analyzer', canvas.width / 2, canvas.height - 30);

      canvas.toBlob((blob) => {
        if (!blob) return;
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
    <div className="flex flex-col lg:flex-row gap-6 w-full max-w-6xl mx-auto">
      {/* Left Column: Card Image */}
      <div className="flex-1 flex flex-col items-center">
        <div className="relative w-full max-w-md mb-4">
          <div className="overflow-auto max-h-[70vh] border border-gray-200 dark:border-gray-700 rounded-lg bg-black">
            <img
              src={edgeOverlayUrl || imageUrl}
              alt="Card with analysis overlay"
              className="w-full"
            />

            {/* Zoom Overlay */}
            {showZoomOverlay && focusedBorder && (
              <div
                className="bg-white dark:bg-gray-800 border-2 border-blue-500 shadow-lg overflow-hidden z-10"
                style={getZoomStyle()}
              >
                <div
                  className="w-full h-full"
                  style={{
                    backgroundImage: `url(${edgeOverlayUrl || imageUrl})`,
                    backgroundSize: '300%',
                    backgroundPosition: getZoomPosition().x + ' ' + getZoomPosition().y,
                    backgroundRepeat: 'no-repeat',
                  }}
                />
                <div className="absolute bottom-1 right-1 bg-black/75 text-white text-xs px-1.5 py-0.5 rounded">3x</div>
              </div>
            )}
          </div>

          {/* Toggle fine-tuning */}
          {onAdjustBorder && (
            <button
              onClick={() => setShowAdjustmentControls(!showAdjustmentControls)}
              className={`absolute bottom-3 right-3 p-2 rounded-full text-white shadow ${showAdjustmentControls ? 'bg-blue-600' : 'bg-gray-800/70'} hover:opacity-90`}
              title="Toggle Fine-Tuning"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
              </svg>
            </button>
          )}
        </div>

        {/* Fine-Tuning Controls */}
        {showAdjustmentControls && onAdjustBorder && (
          <div className="w-full max-w-md bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg mb-4 border border-blue-200 dark:border-blue-800">
            <h3 className="font-medium text-blue-800 dark:text-blue-300 mb-3 text-sm">Fine-Tuning Controls</h3>

            <div className="flex gap-2 mb-3">
              <button
                className={`flex-1 py-1.5 text-sm rounded border ${adjustmentType === 'outer' ? 'bg-blue-100 dark:bg-blue-800 border-blue-500 font-medium' : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600'}`}
                onClick={() => setAdjustmentType('outer')}
              >
                Outer Edges
              </button>
              <button
                className={`flex-1 py-1.5 text-sm rounded border ${adjustmentType === 'inner' ? 'bg-blue-100 dark:bg-blue-800 border-blue-500 font-medium' : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600'}`}
                onClick={() => setAdjustmentType('inner')}
              >
                Inner Edges
              </button>
            </div>

            {/* Directional controls */}
            <div className="flex items-center justify-center gap-1">
              <div className="flex flex-col items-center gap-1">
                <button onClick={() => handleAdjust('top', -1)} className="p-2 bg-blue-600 text-white rounded hover:bg-blue-700" title="Move top edge up">
                  <ChevronUpIcon className="h-5 w-5" />
                </button>
                <div className="flex gap-1">
                  <button onClick={() => handleAdjust('left', 1)} className="p-2 bg-blue-600 text-white rounded hover:bg-blue-700" title="Move left edge left">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                  </button>
                  <div className="w-10 h-10 flex items-center justify-center bg-gray-200 dark:bg-gray-600 rounded text-xs font-mono">
                    {focusedBorder ? focusedBorder[0].toUpperCase() : '-'}
                  </div>
                  <button onClick={() => handleAdjust('right', 1)} className="p-2 bg-blue-600 text-white rounded hover:bg-blue-700" title="Move right edge right">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                  </button>
                </div>
                <button onClick={() => handleAdjust('bottom', 1)} className="p-2 bg-blue-600 text-white rounded hover:bg-blue-700" title="Move bottom edge down">
                  <ChevronDownIcon className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2 mt-3">
              <input type="checkbox" id="zoomToggle" checked={zoomFocus} onChange={e => setZoomFocus(e.target.checked)} className="w-4 h-4" />
              <label htmlFor="zoomToggle" className="text-xs text-gray-600 dark:text-gray-400">Show magnifier</label>
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex flex-wrap gap-2 w-full max-w-md">
          <button onClick={downloadAnalysis} className="flex-1 flex items-center justify-center gap-2 py-2 px-3 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm">
            <ArrowDownTrayIcon className="h-4 w-4" />
            Download
          </button>
          <button onClick={copyToClipboard} className="flex-1 flex items-center justify-center gap-2 py-2 px-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm">
            {copied ? <CheckIcon className="h-4 w-4" /> : <ClipboardIcon className="h-4 w-4" />}
            {copied ? 'Copied!' : 'Copy JSON'}
          </button>
          <button onClick={onReset} className="flex-1 flex items-center justify-center gap-2 py-2 px-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">
            <ArrowPathIcon className="h-4 w-4" />
            New
          </button>
        </div>
      </div>

      {/* Right Column: Analysis Data */}
      <div className="flex-1 space-y-4">
        {/* Multi-Grader Predictions */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Centering Grade Predictions</h3>

          {graderPredictions ? (
            <div className="grid grid-cols-3 gap-3">
              {[graderPredictions.psa, graderPredictions.bgs, graderPredictions.cgc].map(pred => (
                <div key={pred.company} className={`rounded-lg border-2 p-3 text-center ${getGraderStyle(pred.meetsThreshold)}`}>
                  <div className="text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">{pred.company}</div>
                  <div className={`text-xl font-bold ${getGraderGradeColor(pred.meetsThreshold)}`}>{pred.grade.split(' ')[1]}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{pred.label}</div>
                  {pred.meetsThreshold && (
                    <div className="mt-1 inline-block px-1.5 py-0.5 bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 text-[10px] font-medium rounded">
                      TOP GRADE
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{potentialGrade}</div>
            </div>
          )}
        </div>

        {/* Overall Centering */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Centering Scores</h3>

          <div className={`text-3xl font-bold mb-4 ${getScoreColor(overallCentering)}`}>
            {overallCentering.toFixed(1)}%
            <span className="text-base font-normal text-gray-500 dark:text-gray-400 ml-2">Overall</span>
          </div>

          {/* Horizontal */}
          <div className="mb-3">
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-600 dark:text-gray-400">Horizontal</span>
              <span className={`font-medium ${getScoreColor(horizontalCentering)}`}>{horizontalCentering.toFixed(1)}%</span>
            </div>
            <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${getProgressColor(horizontalCentering)}`} style={{ width: `${horizontalCentering}%` }} />
            </div>
          </div>

          {/* Vertical */}
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-600 dark:text-gray-400">Vertical</span>
              <span className={`font-medium ${getScoreColor(verticalCentering)}`}>{verticalCentering.toFixed(1)}%</span>
            </div>
            <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${getProgressColor(verticalCentering)}`} style={{ width: `${verticalCentering}%` }} />
            </div>
          </div>
        </div>

        {/* Distribution */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Distribution</h3>

          <div className="space-y-3">
            {/* L/R */}
            <div className={`rounded-lg p-3 ${getDiffColor(hDiffPct).bg}`}>
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm font-medium">Left / Right</span>
                <span className={`text-sm font-bold ${getDiffColor(hDiffPct).text}`}>
                  {formatDist(leftPct, rightPct)} ({hDiffPct.toFixed(1)}% diff)
                </span>
              </div>
              <div className="w-full h-3 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden flex">
                <div className="bg-blue-500 h-full" style={{ width: `${leftPct}%` }} />
                <div className="bg-orange-500 h-full" style={{ width: `${rightPct}%` }} />
              </div>
              <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
                <span>L: {leftBorder.toFixed(1)}px</span>
                <span>R: {rightBorder.toFixed(1)}px</span>
              </div>
            </div>

            {/* T/B */}
            <div className={`rounded-lg p-3 ${getDiffColor(vDiffPct).bg}`}>
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm font-medium">Top / Bottom</span>
                <span className={`text-sm font-bold ${getDiffColor(vDiffPct).text}`}>
                  {formatDist(topPct, bottomPct)} ({vDiffPct.toFixed(1)}% diff)
                </span>
              </div>
              <div className="w-full h-3 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden flex">
                <div className="bg-blue-500 h-full" style={{ width: `${topPct}%` }} />
                <div className="bg-orange-500 h-full" style={{ width: `${bottomPct}%` }} />
              </div>
              <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
                <span>T: {topBorder.toFixed(1)}px</span>
                <span>B: {bottomBorder.toFixed(1)}px</span>
              </div>
            </div>
          </div>
        </div>

        {/* Grading Thresholds Reference */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Centering Thresholds</h3>
          <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
            <div className="flex justify-between"><span>PSA 10 (Gem Mint)</span><span>55/45 or better</span></div>
            <div className="flex justify-between"><span>BGS 10 (Black Label)</span><span>50/50 perfect</span></div>
            <div className="flex justify-between"><span>BGS 9.5 (Gem Mint)</span><span>55/45 or better</span></div>
            <div className="flex justify-between"><span>CGC 10 (Pristine)</span><span>55/45 or better</span></div>
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-3 italic">
            Based on centering only. Actual grades depend on surface, edges, and corners.
          </p>
        </div>
      </div>
    </div>
  );
}
