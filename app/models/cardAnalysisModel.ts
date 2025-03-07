import * as tf from '@tensorflow/tfjs';

// Check if we're in a browser environment
const isBrowser = typeof window !== 'undefined' && typeof window.document !== 'undefined';

export interface CardMeasurements {
  leftBorder: number;
  rightBorder: number;
  topBorder: number;
  bottomBorder: number;
  horizontalCentering: number; // 0-100% (100 being perfect)
  verticalCentering: number; // 0-100% (100 being perfect)
  overallCentering: number; // 0-100% (100 being perfect)
}

export interface CardAnalysisResult {
  measurements: CardMeasurements;
  imageUrl?: string; // Add imageUrl property
  cardImageData: ImageData;
  fullImageData: ImageData; // Add the full original image data
  edgeOverlayImageData: ImageData;
  edgeOverlayUrl: string; // URL for the edge overlay image
  potentialGrade: string;
  analyzer?: CardAnalyzer; // Reference to the analyzer instance
  detectionMethod?: string; // Method used for detection (Yellow, Canny, PSA)
}

export class CardAnalyzer {
  private readonly STANDARD_CARD_RATIO = 2.5 / 3.5; // Standard Pokemon card ratio (width/height)
  private lastMeasurements: CardMeasurements | null = null;
  private yellowBorderDetected = false;
  
  // Change from private to public to allow access in _index.tsx
  public cardEdges: {
    left: number;
    right: number;
    top: number;
    bottom: number;
  } | null = null;
  
  private yellowBorders: {
    left: number;
    right: number;
    top: number;
    bottom: number;
  } | null = null;
  
  private innerBoundary: {
    left: boolean;
    right: boolean;
    top: boolean;
    bottom: boolean;
  } | null = null;
  
  private innerEdges: {
    left: number;
    right: number;
    top: number;
    bottom: number;
  } | null = null;
  
  private edgeDebugImage: ImageData | null = null;
  // Store which detection method was used (change to public so it can be modified)
  public detectionMethod: string = 'Canny Edge Detection';
  
  private debugData: {
    samples: {
      leftYellow: {x: number, y: number, color: string}[];
      rightYellow: {x: number, y: number, color: string}[];
      topYellow: {x: number, y: number, color: string}[];
      bottomYellow: {x: number, y: number, color: string}[];
      leftInner: {x: number, y: number, color: string}[];
      rightInner: {x: number, y: number, color: string}[];
      topInner: {x: number, y: number, color: string}[];
      bottomInner: {x: number, y: number, color: string}[];
    };
    yellowEdges: {
      left: number[];
      right: number[];
      top: number[];
      bottom: number[];
    };
    innerEdges: {
      left: number[];
      right: number[];
      top: number[];
      bottom: number[];
    };
  } | null = null;
  
  // Add debug logging utility
  private debug = true; // Set to false in production
  private log(...args: any[]) {
    if (this.debug) console.log(...args);
  }
  
  // Process image and analyze card centering
  async analyzeCard(imageElement: HTMLImageElement | HTMLCanvasElement): Promise<CardAnalysisResult> {
    if (!isBrowser) {
      // Return dummy data if we're on the server
      return this.createDummyResult();
    }
    
    // Try to get image URL if it's available
    let imageUrl = '';
    if ('src' in imageElement && typeof imageElement.src === 'string') {
      imageUrl = imageElement.src;
    }
    
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      throw new Error('Could not get canvas context');
    }
    
    // Set canvas to image dimensions
    canvas.width = imageElement.width || (imageElement as HTMLImageElement).naturalWidth;
    canvas.height = imageElement.height || (imageElement as HTMLImageElement).naturalHeight;
    
    // Draw image to canvas
    ctx.drawImage(imageElement, 0, 0, canvas.width, canvas.height);
    
    // Get image data for processing
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    
    // Detect card edges using PSA-specific detection
    const edges = await this.detectCardEdges(imageData);
    
    // We no longer extract the card region - instead we use the full image everywhere
    // This ensures we always show the full slab, not just the cropped card
    
    // Measure borders directly on the full image
    const initialMeasurements = this.measureCardBorders(imageData, edges);
    this.lastMeasurements = initialMeasurements;
    
    // Create edge overlay for visualization
    const edgeOverlay = this.createEdgeOverlay(imageData, edges);
    
    // Convert edge overlay to a data URL for displaying in the UI
    const overlayCanvas = document.createElement('canvas');
    const overlayCtx = overlayCanvas.getContext('2d');
    
    if (!overlayCtx) {
      throw new Error('Could not get overlay canvas context');
    }
    
    overlayCanvas.width = edgeOverlay.width;
    overlayCanvas.height = edgeOverlay.height;
    overlayCtx.putImageData(edgeOverlay, 0, 0);
    
    const edgeOverlayUrl = overlayCanvas.toDataURL('image/png');
    
    // Calculate potential grade
    const potentialGrade = this.calculatePotentialGrade(this.lastMeasurements);
    
    return {
      measurements: this.lastMeasurements,
      imageUrl,
      cardImageData: imageData, // Use the full image data here too
      fullImageData: imageData,
      edgeOverlayImageData: edgeOverlay,
      edgeOverlayUrl,
      potentialGrade,
      analyzer: this, // Include reference to this analyzer instance
      detectionMethod: this.detectionMethod // Include the detection method used
    };
  }
  
  // Create a dummy result for server-side rendering
  private createDummyResult(): CardAnalysisResult {
    // Create a tiny 1x1 ImageData
    const dummyImageData = new ImageData(1, 1);
    
    return {
      measurements: {
        leftBorder: 0,
        rightBorder: 0,
        topBorder: 0,
        bottomBorder: 0,
        horizontalCentering: 0,
        verticalCentering: 0,
        overallCentering: 0
      },
      imageUrl: '',
      cardImageData: dummyImageData,
      fullImageData: dummyImageData,
      edgeOverlayImageData: dummyImageData,
      edgeOverlayUrl: '',
      potentialGrade: 'N/A'
    };
  }
  
  // Implement Canny Edge Detection for improved edge detection
  private cannyEdgeDetection(imageData: ImageData): Uint8ClampedArray {
    const { width, height, data } = imageData;
    
    // Step 1: Convert to grayscale
    const grayscale = new Uint8ClampedArray(width * height);
    for (let i = 0; i < data.length; i += 4) {
      grayscale[i / 4] = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
    }
    
    // Step 2: Apply Gaussian blur
    const blurred = this.gaussianBlur(grayscale, width, height);
    
    // Step 3: Compute gradients (Sobel operator)
    const gradientData = this.computeGradients(blurred, width, height);
    const { gradientMagnitude, gradientDirection } = gradientData;
    
    // Step 4: Non-maximum suppression
    const thinEdges = this.nonMaximumSuppression(gradientMagnitude, gradientDirection, width, height);
    
    // Step 5: Hysteresis thresholding
    const edges = this.hysteresisThresholding(thinEdges, width, height, 50, 20);
    
    return edges;
  }
  
  // Gaussian blur implementation
  private gaussianBlur(data: Uint8ClampedArray, width: number, height: number): Uint8ClampedArray {
    const kernel = [
      1, 4, 7, 4, 1,
      4, 16, 26, 16, 4,
      7, 26, 41, 26, 7,
      4, 16, 26, 16, 4,
      1, 4, 7, 4, 1
    ];
    const kernelSize = 5;
    const kernelSum = 273;
    const halfKernel = Math.floor(kernelSize / 2);
    
    const result = new Uint8ClampedArray(width * height);
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let sum = 0;
        
        for (let ky = -halfKernel; ky <= halfKernel; ky++) {
          for (let kx = -halfKernel; kx <= halfKernel; kx++) {
            const pixelY = Math.max(0, Math.min(height - 1, y + ky));
            const pixelX = Math.max(0, Math.min(width - 1, x + kx));
            const kernelIndex = (ky + halfKernel) * kernelSize + (kx + halfKernel);
            
            sum += data[pixelY * width + pixelX] * kernel[kernelIndex];
          }
        }
        
        result[y * width + x] = Math.round(sum / kernelSum);
      }
    }
    
    return result;
  }
  
  // Compute gradients using Sobel operator
  private computeGradients(data: Uint8ClampedArray, width: number, height: number): {
    gradientMagnitude: Uint8ClampedArray;
    gradientDirection: Float32Array;
  } {
    const sobelX = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
    const sobelY = [-1, -2, -1, 0, 0, 0, 1, 2, 1];
    
    const gradientMagnitude = new Uint8ClampedArray(width * height);
    const gradientDirection = new Float32Array(width * height);
    
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        let gx = 0;
        let gy = 0;
        
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const pixelIndex = (y + ky) * width + (x + kx);
            const kernelIndex = (ky + 1) * 3 + (kx + 1);
            
            gx += data[pixelIndex] * sobelX[kernelIndex];
            gy += data[pixelIndex] * sobelY[kernelIndex];
          }
        }
        
        const index = y * width + x;
        gradientMagnitude[index] = Math.min(255, Math.round(Math.sqrt(gx * gx + gy * gy)));
        gradientDirection[index] = Math.atan2(gy, gx);
      }
    }
    
    return { gradientMagnitude, gradientDirection };
  }
  
  // Non-maximum suppression
  private nonMaximumSuppression(
    gradientMagnitude: Uint8ClampedArray,
    gradientDirection: Float32Array,
    width: number,
    height: number
  ): Uint8ClampedArray {
    const result = new Uint8ClampedArray(width * height);
    
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const index = y * width + x;
        const angle = gradientDirection[index];
        const magnitude = gradientMagnitude[index];
        
        // Convert angle to degrees and adjust to 0-180
        let angleDeg = (angle * 180 / Math.PI + 180) % 180;
        
        // Find the two adjacent pixels in the gradient direction
        let pixel1Index = index;
        let pixel2Index = index;
        
        // 0 degrees (horizontal)
        if ((angleDeg >= 0 && angleDeg < 22.5) || (angleDeg >= 157.5 && angleDeg <= 180)) {
          pixel1Index = y * width + (x + 1);
          pixel2Index = y * width + (x - 1);
        }
        // 45 degrees (diagonal)
        else if (angleDeg >= 22.5 && angleDeg < 67.5) {
          pixel1Index = (y + 1) * width + (x - 1);
          pixel2Index = (y - 1) * width + (x + 1);
        }
        // 90 degrees (vertical)
        else if (angleDeg >= 67.5 && angleDeg < 112.5) {
          pixel1Index = (y + 1) * width + x;
          pixel2Index = (y - 1) * width + x;
        }
        // 135 degrees (diagonal)
        else if (angleDeg >= 112.5 && angleDeg < 157.5) {
          pixel1Index = (y + 1) * width + (x + 1);
          pixel2Index = (y - 1) * width + (x - 1);
        }
        
        // Check if the current pixel has the maximum gradient magnitude
        if (magnitude >= gradientMagnitude[pixel1Index] && magnitude >= gradientMagnitude[pixel2Index]) {
          result[index] = magnitude;
        } else {
          result[index] = 0;
        }
      }
    }
    
    return result;
  }
  
  // Hysteresis thresholding
  private hysteresisThresholding(
    edges: Uint8ClampedArray,
    width: number,
    height: number,
    highThreshold: number,
    lowThreshold: number
  ): Uint8ClampedArray {
    const result = new Uint8ClampedArray(width * height);
    const visited = new Set<number>();
    
    // Mark strong edges
    for (let i = 0; i < edges.length; i++) {
      if (edges[i] >= highThreshold) {
        result[i] = 255;
        visited.add(i);
      }
    }
    
    // Helper function for depth-first search
    const dfs = (index: number) => {
      const stack = [index];
      
      while (stack.length > 0) {
        const current = stack.pop()!;
        const x = current % width;
        const y = Math.floor(current / width);
        
        // Check 8-connected neighbors
        for (let ny = Math.max(0, y - 1); ny <= Math.min(height - 1, y + 1); ny++) {
          for (let nx = Math.max(0, x - 1); nx <= Math.min(width - 1, x + 1); nx++) {
            const neighborIndex = ny * width + nx;
            
            if (!visited.has(neighborIndex) && edges[neighborIndex] >= lowThreshold) {
              result[neighborIndex] = 255;
              visited.add(neighborIndex);
              stack.push(neighborIndex);
            }
          }
        }
      }
    };
    
    // Find weak edges connected to strong edges
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const index = y * width + x;
        
        if (result[index] === 255) {
          dfs(index);
        }
      }
    }
    
    return result;
  }
  
  // Function to find connected components in binary image
  private findConnectedComponents(binaryImage: Uint8ClampedArray, width: number, height: number): number[][] {
    const visited = new Set<number>();
    const components: number[][] = [];
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const index = y * width + x;
        
        if (binaryImage[index] === 255 && !visited.has(index)) {
          const component: number[] = [];
          const stack = [index];
          visited.add(index);
          
          while (stack.length > 0) {
            const currentIndex = stack.pop()!;
            component.push(currentIndex);
            
            const curX = currentIndex % width;
            const curY = Math.floor(currentIndex / width);
            
            // Check 8-connected neighbors
            for (let ny = Math.max(0, curY - 1); ny <= Math.min(height - 1, curY + 1); ny++) {
              for (let nx = Math.max(0, curX - 1); nx <= Math.min(width - 1, curX + 1); nx++) {
                const neighborIndex = ny * width + nx;
                
                if (binaryImage[neighborIndex] === 255 && !visited.has(neighborIndex)) {
                  stack.push(neighborIndex);
                  visited.add(neighborIndex);
                }
              }
            }
          }
          
          if (component.length > 50) { // Filter out small noise components
            components.push(component);
          }
        }
      }
    }
    
    return components;
  }
  
  // Find bounding box of a component
  private getBoundingBox(component: number[], width: number): { 
    top: number; 
    bottom: number; 
    left: number; 
    right: number 
  } {
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    
    for (const index of component) {
      const x = index % width;
      const y = Math.floor(index / width);
      
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
    
    return {
      top: minY,
      bottom: maxY,
      left: minX,
      right: maxX
    };
  }
  
  // Updated detectCardEdges to use multiple methods and PSA-specific detection
  private async detectCardEdges(imageData: ImageData): Promise<{
    top: number;
    bottom: number;
    left: number;
    right: number;
  }> {
    const { width, height, data } = imageData;
    
    // First try: PSA-specific template detection
    this.log('Checking for PSA template match...');
    const psaTemplate = this.detectPSATemplate(imageData);
    
    if (psaTemplate.found && psaTemplate.estimatedEdges) {
      this.log(`PSA ${psaTemplate.template} template detected with confidence: ${psaTemplate.confidence.toFixed(2)}`);
      this.log('Estimated edges based on PSA template:', psaTemplate.estimatedEdges);
      
      // Store detection method for visualization
      this.detectionMethod = `PSA ${psaTemplate.template} template`;
      
      // Store card edges
      this.cardEdges = psaTemplate.estimatedEdges;
      
      return psaTemplate.estimatedEdges;
    }
    
    // Second try: Canny edge detection
    this.log('PSA template not detected, trying Canny edge detection...');
    const edges = this.cannyEdgeDetection(imageData);
    
    // Find connected components in the edge image
    const components = this.findConnectedComponents(edges, width, height);
    
    // Sort components by size (number of pixels)
    components.sort((a, b) => b.length - a.length);
    
    this.log(`Found ${components.length} edge components`);
    
    if (components.length > 0) {
      // Create a visualization of the largest component for debugging
      const debugImage = new Uint8ClampedArray(width * height * 4);
      
      // First, make the entire image transparent
      for (let i = 0; i < debugImage.length; i += 4) {
        debugImage[i] = 0;
        debugImage[i + 1] = 0;
        debugImage[i + 2] = 0;
        debugImage[i + 3] = 0;
      }
      
      // Then, color the largest component
      for (const pixelIndex of components[0]) {
        const i = pixelIndex * 4;
        debugImage[i] = 255;   // Red
        debugImage[i + 1] = 0; // Green
        debugImage[i + 2] = 0; // Blue
        debugImage[i + 3] = 255; // Alpha
      }
      
      // Store for visualization
      this.edgeDebugImage = new ImageData(debugImage, width, height);
      
      // Get bounding box of the largest component
      const boundingBox = this.getBoundingBox(components[0], width);
      
      // Check if the component is large enough to be a card
      const boxWidth = boundingBox.right - boundingBox.left;
      const boxHeight = boundingBox.bottom - boundingBox.top;
      const aspectRatio = boxHeight / boxWidth;
      
      if (boxWidth > width * 0.3 && boxHeight > height * 0.3 && aspectRatio > 1.0 && aspectRatio < 2.0) {
        this.log('Found card edges using Canny detector:', boundingBox);
        this.log('Aspect ratio:', aspectRatio);
        
        // Store detection method for visualization
        this.detectionMethod = 'Canny Edge Detection';
        
        // Store card edges for later use
        this.cardEdges = {
          left: boundingBox.left,
          right: boundingBox.right,
          top: boundingBox.top,
          bottom: boundingBox.bottom
        };
        
        return boundingBox;
      }
    }
    
    // If Canny detection fails, fall back to our yellow border detection
    this.log('Canny edge detection failed, falling back to yellow border detection');
    
    // Yellow border color ranges for Pokemon cards in PSA slabs
    const YELLOW_MIN_R = 180;
    const YELLOW_MIN_G = 160;
    const YELLOW_MAX_B = 120;
    
    // Store potential yellow border points
    const yellowPoints: {x: number, y: number}[] = [];
    
    // Scan the entire image for yellow border pixels
    for (let y = 0; y < height; y += 2) {
      for (let x = 0; x < width; x += 2) {
        const idx = (y * width + x) * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        
        // Check if this pixel matches Pokemon card yellow border color profile
        if (r > YELLOW_MIN_R && g > YELLOW_MIN_G && b < YELLOW_MAX_B) {
          yellowPoints.push({x, y});
        }
      }
    }
    
    this.log(`Found ${yellowPoints.length} potential yellow border points`);
    
    // If we found yellow points, use them to detect the card boundary
    if (yellowPoints.length > 100) {
      // Find the yellow border boundaries
      const xValues = yellowPoints.map(p => p.x);
      const yValues = yellowPoints.map(p => p.y);
      
      // Calculate the bounding box of yellow pixels
      const yellowLeft = Math.min(...xValues);
      const yellowRight = Math.max(...xValues);
      const yellowTop = Math.min(...yValues);
      const yellowBottom = Math.max(...yValues);
      
      this.log('Yellow border detected:', { yellowLeft, yellowRight, yellowTop, yellowBottom });
      
      // To find the card edges, look at the distribution of yellow pixels
      const horizontalDensity = new Array(width).fill(0);
      const verticalDensity = new Array(height).fill(0);
      
      // Count yellow pixels in each row and column
      for (const point of yellowPoints) {
        horizontalDensity[point.x]++;
        verticalDensity[point.y]++;
      }
      
      // Find peaks in density to locate the card edges
      const horizAvgDensity = yellowPoints.length / width;
      const vertAvgDensity = yellowPoints.length / height;
      
      const horizThreshold = horizAvgDensity * 0.5;
      const vertThreshold = vertAvgDensity * 0.5;
      
      // Find left edge - first column with density above threshold
      let left = 0;
      for (let x = 0; x < width; x++) {
        if (horizontalDensity[x] > horizThreshold) {
          left = Math.max(0, x - 5);
          break;
        }
      }
      
      // Find right edge - last column with density above threshold
      let right = width - 1;
      for (let x = width - 1; x >= 0; x--) {
        if (horizontalDensity[x] > horizThreshold) {
          right = Math.min(width - 1, x + 5);
          break;
        }
      }
      
      // Find top edge - first row with density above threshold
      let top = 0;
      for (let y = 0; y < height; y++) {
        if (verticalDensity[y] > vertThreshold) {
          top = Math.max(0, y - 5);
          break;
        }
      }
      
      // Find bottom edge - last row with density above threshold
      let bottom = height - 1;
      for (let y = height - 1; y >= 0; y--) {
        if (verticalDensity[y] > vertThreshold) {
          bottom = Math.min(height - 1, y + 5);
          break;
        }
      }
      
      this.log('Card edges based on yellow border:', { left, right, top, bottom });
      
      // Store detection method for visualization
      this.detectionMethod = 'Yellow Border Detection';
      
      // Store card edges for border measurement
      this.cardEdges = { left, right, top, bottom };
      
      return { top, bottom, left, right };
    }
    
    // Final fallback to default edge detection
    this.log('Yellow border detection failed, using fallback edge detection');
    
    // Store detection method for visualization
    this.detectionMethod = 'Contrast-Based Detection';
    
    // Array to collect potential edge points
    const leftEdges: number[] = [];
    const rightEdges: number[] = [];
    const topEdges: number[] = [];
    const bottomEdges: number[] = [];
    
    // Scan for edges with high contrast threshold
    const EDGE_THRESHOLD = 45;
    
    // Scan from left side
    for (let y = height * 0.1; y < height * 0.9; y += 3) {
      const row = Math.floor(y);
      for (let x = 0; x < Math.floor(width * 0.3); x++) {
        const idx = (row * width + x) * 4;
        const nextIdx = (row * width + x + 1) * 4;
        
        // Compare brightness between adjacent pixels
        const brightness = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
        const nextBrightness = (data[nextIdx] + data[nextIdx + 1] + data[nextIdx + 2]) / 3;
        
        if (Math.abs(brightness - nextBrightness) > EDGE_THRESHOLD) {
          leftEdges.push(x);
          break;
        }
      }
    }
    
    // Scan from right side
    for (let y = height * 0.1; y < height * 0.9; y += 3) {
      const row = Math.floor(y);
      for (let x = width - 1; x > Math.floor(width * 0.7); x--) {
        const idx = (row * width + x) * 4;
        const prevIdx = (row * width + x - 1) * 4;
        
        // Compare brightness between adjacent pixels
        const brightness = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
        const prevBrightness = (data[prevIdx] + data[prevIdx + 1] + data[prevIdx + 2]) / 3;
        
        if (Math.abs(brightness - prevBrightness) > EDGE_THRESHOLD) {
          rightEdges.push(x);
          break;
        }
      }
    }
    
    // Scan from top
    for (let x = width * 0.1; x < width * 0.9; x += 3) {
      const col = Math.floor(x);
      for (let y = 0; y < Math.floor(height * 0.3); y++) {
        const idx = (y * width + col) * 4;
        const nextRowIdx = ((y + 1) * width + col) * 4;
        
        // Compare brightness between adjacent pixels
        const brightness = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
        const nextBrightness = (data[nextRowIdx] + data[nextRowIdx + 1] + data[nextRowIdx + 2]) / 3;
        
        if (Math.abs(brightness - nextBrightness) > EDGE_THRESHOLD) {
          topEdges.push(y);
          break;
        }
      }
    }
    
    // Scan from bottom
    for (let x = width * 0.1; x < width * 0.9; x += 3) {
      const col = Math.floor(x);
      for (let y = height - 1; y > Math.floor(height * 0.7); y--) {
        const idx = (y * width + col) * 4;
        const prevRowIdx = ((y - 1) * width + col) * 4;
        
        // Compare brightness between adjacent pixels
        const brightness = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
        const prevBrightness = (data[prevRowIdx] + data[prevRowIdx + 1] + data[prevRowIdx + 2]) / 3;
        
        if (Math.abs(brightness - prevBrightness) > EDGE_THRESHOLD) {
          bottomEdges.push(y);
          break;
        }
      }
    }
    
    // Find the most common edge positions
    const findMostCommon = (arr: number[], tolerance: number) => {
      if (arr.length === 0) return 0;
      
      const counts: Record<number, number> = {};
      
      for (const value of arr) {
        let found = false;
        
        for (const key of Object.keys(counts).map(Number)) {
          if (Math.abs(value - key) <= tolerance) {
            counts[key]++;
            found = true;
            break;
          }
        }
        
        if (!found) {
          counts[value] = 1;
        }
      }
      
      let maxCount = 0;
      let mostCommon = arr[0];
      
      for (const [key, count] of Object.entries(counts)) {
        if (count > maxCount) {
          maxCount = count;
          mostCommon = Number(key);
        }
      }
      
      return mostCommon;
    };
    
    // Use the values we have
    const left = leftEdges.length > 0 ? findMostCommon(leftEdges, 5) : Math.floor(width * 0.05);
    const right = rightEdges.length > 0 ? findMostCommon(rightEdges, 5) : Math.floor(width * 0.95);
    const top = topEdges.length > 0 ? findMostCommon(topEdges, 5) : Math.floor(height * 0.05);
    const bottom = bottomEdges.length > 0 ? findMostCommon(bottomEdges, 5) : Math.floor(height * 0.95);
    
    this.log('Fallback edge detection:', { left, right, top, bottom });
    
    // Store card edges for border measurement
    this.cardEdges = { left, right, top, bottom };
    
    return { top, bottom, left, right };
  }
  
  // Changed to public to enable adjustments
  public measureCardBorders(cardRegion: ImageData, edges: { top: number; bottom: number; left: number; right: number; }): CardMeasurements {
    const width = cardRegion.width;
    const height = cardRegion.height;
    const data = cardRegion.data;
    
    this.log('Measuring card borders with inner boundary detection...');
    
    // For Pokemon cards, we need to detect both:
    // 1. The yellow outer border of the card
    // 2. The inner boundary where yellow border transitions to card artwork
    
    // Yellow border color definitions - adjusted to better match Pokémon cards
    const YELLOW_MIN_R = 180; // Lowered to catch more yellow variations
    const YELLOW_MIN_G = 160; // Lowered to catch more yellow variations
    const YELLOW_MAX_B = 120; // Increased to be more inclusive
    
    // High contrast transition from yellow border to artwork - lowered to catch subtle transitions
    const INNER_CONTRAST_THRESHOLD = 30; // Lowered from 50
    
    // Debug visualization - store sample points for debugging
    const debugSamples = {
      leftYellow: [] as {x: number, y: number, color: string}[],
      rightYellow: [] as {x: number, y: number, color: string}[],
      topYellow: [] as {x: number, y: number, color: string}[],
      bottomYellow: [] as {x: number, y: number, color: string}[],
      leftInner: [] as {x: number, y: number, color: string}[],
      rightInner: [] as {x: number, y: number, color: string}[],
      topInner: [] as {x: number, y: number, color: string}[],
      bottomInner: [] as {x: number, y: number, color: string}[]
    };
    
    // Arrays to collect yellow border outer edges
    const yellowLeftEdges: number[] = [];
    const yellowRightEdges: number[] = [];
    const yellowTopEdges: number[] = [];
    const yellowBottomEdges: number[] = [];
    
    // Arrays to collect inner boundary edges (yellow border to artwork)
    const innerLeftEdges: number[] = [];
    const innerRightEdges: number[] = [];
    const innerTopEdges: number[] = [];
    const innerBottomEdges: number[] = [];
    
    // Scan horizontally from left for yellow border and then inner boundary
    for (let y = Math.floor(height * 0.2); y < Math.floor(height * 0.8); y += 2) {
      let foundYellowStart = false;
      let yellowStartX = -1;
      
      for (let x = 0; x < Math.floor(width * 0.4); x++) {
        const idx = (y * width + x) * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        
        // For debugging - store color at this location
        const colorHex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
        
        // First find the start of yellow border
        if (!foundYellowStart && r > YELLOW_MIN_R && g > YELLOW_MIN_G && b < YELLOW_MAX_B) {
          foundYellowStart = true;
          yellowStartX = x;
          yellowLeftEdges.push(x);
          
          // Store yellow detection point for debugging
          debugSamples.leftYellow.push({x, y, color: colorHex});
          this.log(`Left yellow at (${x},${y}): RGB(${r},${g},${b})`);
        }
        
        // Then look for the inner boundary (transition from yellow to artwork)
        if (foundYellowStart && x > yellowStartX + 2) { // Reduced from 3 to 2 pixels - detect transition earlier
          const nextIdx = (y * width + (x + 1)) * 4;
          
          // Calculate brightness and color change
          const brightness = (r + g + b) / 3;
          const nextR = data[nextIdx];
          const nextG = data[nextIdx + 1];
          const nextB = data[nextIdx + 2];
          const nextBrightness = (nextR + nextG + nextB) / 3;
          const nextColorHex = `#${nextR.toString(16).padStart(2, '0')}${nextG.toString(16).padStart(2, '0')}${nextB.toString(16).padStart(2, '0')}`;
          
          // Check for significant brightness or color change
          const brightnessDiff = Math.abs(brightness - nextBrightness);
          const colorDiff = Math.abs(r - nextR) + Math.abs(g - nextG) + Math.abs(b - nextB);
          
          // Add blue detection - check specifically for transition to blue (common in Pokémon card borders)
          const isBlueish = nextB > Math.max(nextR, nextG) + 20;
          
          // More detailed check for transition out of yellow
          const isLeavingYellow = (g - nextG > 20) || (r - nextR > 20) || (nextB - b > 20);
          
          if (brightnessDiff > INNER_CONTRAST_THRESHOLD || 
              colorDiff > INNER_CONTRAST_THRESHOLD * 3 || 
              isBlueish || 
              isLeavingYellow) {
            
            innerLeftEdges.push(x - yellowStartX); // Store the width of yellow border
            debugSamples.leftInner.push({x, y, color: nextColorHex});
            
            // Detailed debug info
            this.log(`Left inner at (${x},${y}): RGB(${r},${g},${b}) -> RGB(${nextR},${nextG},${nextB})`);
            this.log(`Brightness diff: ${brightnessDiff}, Color diff: ${colorDiff}, Is blue: ${isBlueish}, Leaving yellow: ${isLeavingYellow}`);
            break;
          }
        }
      }
    }
    
    // Scan horizontally from right for yellow border and then inner boundary
    for (let y = Math.floor(height * 0.2); y < Math.floor(height * 0.8); y += 2) {
      let foundYellowStart = false;
      let yellowStartX = -1;
      
      for (let x = width - 1; x > Math.floor(width * 0.6); x--) {
        const idx = (y * width + x) * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        
        // For debugging - store color at this location
        const colorHex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
        
        // First find the start of yellow border
        if (!foundYellowStart && r > YELLOW_MIN_R && g > YELLOW_MIN_G && b < YELLOW_MAX_B) {
          foundYellowStart = true;
          yellowStartX = x;
          yellowRightEdges.push(width - x - 1);
          
          // Store yellow detection point for debugging
          debugSamples.rightYellow.push({x, y, color: colorHex});
          this.log(`Right yellow at (${x},${y}): RGB(${r},${g},${b})`);
        }
        
        // Then look for the inner boundary (transition from yellow to artwork)
        if (foundYellowStart && x < yellowStartX - 2) { // Reduced from 3 to 2 pixels
          const prevIdx = (y * width + (x - 1)) * 4;
          
          // Calculate brightness and color change
          const brightness = (r + g + b) / 3;
          const prevR = data[prevIdx];
          const prevG = data[prevIdx + 1];
          const prevB = data[prevIdx + 2];
          const prevBrightness = (prevR + prevG + prevB) / 3;
          const prevColorHex = `#${prevR.toString(16).padStart(2, '0')}${prevG.toString(16).padStart(2, '0')}${prevB.toString(16).padStart(2, '0')}`;
          
          // Check for significant brightness or color change
          const brightnessDiff = Math.abs(brightness - prevBrightness);
          const colorDiff = Math.abs(r - prevR) + Math.abs(g - prevG) + Math.abs(b - prevB);
          
          // Add blue detection - check specifically for transition to blue
          const isBlueish = prevB > Math.max(prevR, prevG) + 20;
          
          // More detailed check for transition out of yellow
          const isLeavingYellow = (g - prevG > 20) || (r - prevR > 20) || (prevB - b > 20);
          
          if (brightnessDiff > INNER_CONTRAST_THRESHOLD || 
              colorDiff > INNER_CONTRAST_THRESHOLD * 3 || 
              isBlueish || 
              isLeavingYellow) {
                
            innerRightEdges.push(yellowStartX - x); // Store the width of yellow border
            debugSamples.rightInner.push({x, y, color: prevColorHex});
            
            // Detailed debug info
            this.log(`Right inner at (${x},${y}): RGB(${r},${g},${b}) -> RGB(${prevR},${prevG},${prevB})`);
            this.log(`Brightness diff: ${brightnessDiff}, Color diff: ${colorDiff}, Is blue: ${isBlueish}, Leaving yellow: ${isLeavingYellow}`);
            break;
          }
        }
      }
    }

    // Scan vertically from top for yellow border and then inner boundary  
    for (let x = Math.floor(width * 0.2); x < Math.floor(width * 0.8); x += 2) {
      let foundYellowStart = false;
      let yellowStartY = -1;
      
      for (let y = 0; y < Math.floor(height * 0.4); y++) {
        const idx = (y * width + x) * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        
        // For debugging - store color at this location
        const colorHex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
        
        // First find the start of yellow border
        if (!foundYellowStart && r > YELLOW_MIN_R && g > YELLOW_MIN_G && b < YELLOW_MAX_B) {
          foundYellowStart = true;
          yellowStartY = y;
          yellowTopEdges.push(y);
          
          // Store yellow detection point for debugging
          debugSamples.topYellow.push({x, y, color: colorHex});
          this.log(`Top yellow at (${x},${y}): RGB(${r},${g},${b})`);
        }
        
        // Then look for the inner boundary (transition from yellow to artwork)
        if (foundYellowStart && y > yellowStartY + 2) { // Reduced from 3 to 2 pixels
          const nextRowIdx = ((y + 1) * width + x) * 4;
          
          // Calculate brightness and color change
          const brightness = (r + g + b) / 3;
          const nextR = data[nextRowIdx];
          const nextG = data[nextRowIdx + 1];
          const nextB = data[nextRowIdx + 2];
          const nextBrightness = (nextR + nextG + nextB) / 3;
          const nextColorHex = `#${nextR.toString(16).padStart(2, '0')}${nextG.toString(16).padStart(2, '0')}${nextB.toString(16).padStart(2, '0')}`;
          
          // Check for significant brightness or color change
          const brightnessDiff = Math.abs(brightness - nextBrightness);
          const colorDiff = Math.abs(r - nextR) + Math.abs(g - nextG) + Math.abs(b - nextB);
          
          // Add blue detection - check specifically for transition to blue
          const isBlueish = nextB > Math.max(nextR, nextG) + 20;
          
          // More detailed check for transition out of yellow
          const isLeavingYellow = (g - nextG > 20) || (r - nextR > 20) || (nextB - b > 20);
          
          if (brightnessDiff > INNER_CONTRAST_THRESHOLD || 
              colorDiff > INNER_CONTRAST_THRESHOLD * 3 || 
              isBlueish || 
              isLeavingYellow) {
                
            innerTopEdges.push(y - yellowStartY); // Store the width of yellow border
            debugSamples.topInner.push({x, y, color: nextColorHex});
            
            // Detailed debug info
            this.log(`Top inner at (${x},${y}): RGB(${r},${g},${b}) -> RGB(${nextR},${nextG},${nextB})`);
            this.log(`Brightness diff: ${brightnessDiff}, Color diff: ${colorDiff}, Is blue: ${isBlueish}, Leaving yellow: ${isLeavingYellow}`);
            break;
          }
        }
      }
    }
    
    // Scan vertically from bottom for yellow border and then inner boundary
    for (let x = Math.floor(width * 0.2); x < Math.floor(width * 0.8); x += 2) {
      let foundYellowStart = false;
      let yellowStartY = -1;
      
      for (let y = height - 1; y > Math.floor(height * 0.6); y--) {
        const idx = (y * width + x) * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        
        // For debugging - store color at this location
        const colorHex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
        
        // First find the start of yellow border
        if (!foundYellowStart && r > YELLOW_MIN_R && g > YELLOW_MIN_G && b < YELLOW_MAX_B) {
          foundYellowStart = true;
          yellowStartY = y;
          yellowBottomEdges.push(height - y - 1);
          
          // Store yellow detection point for debugging
          debugSamples.bottomYellow.push({x, y, color: colorHex});
          this.log(`Bottom yellow at (${x},${y}): RGB(${r},${g},${b})`);
        }
        
        // Then look for the inner boundary (transition from yellow to artwork)
        if (foundYellowStart && y < yellowStartY - 2) { // Reduced from 3 to 2 pixels
          const prevRowIdx = ((y - 1) * width + x) * 4;
          
          // Calculate brightness and color change
          const brightness = (r + g + b) / 3;
          const prevR = data[prevRowIdx];
          const prevG = data[prevRowIdx + 1];
          const prevB = data[prevRowIdx + 2];
          const prevBrightness = (prevR + prevG + prevB) / 3;
          const prevColorHex = `#${prevR.toString(16).padStart(2, '0')}${prevG.toString(16).padStart(2, '0')}${prevB.toString(16).padStart(2, '0')}`;
          
          // Check for significant brightness or color change
          const brightnessDiff = Math.abs(brightness - prevBrightness);
          const colorDiff = Math.abs(r - prevR) + Math.abs(g - prevG) + Math.abs(b - prevB);
          
          // Add blue detection - check specifically for transition to blue
          const isBlueish = prevB > Math.max(prevR, prevG) + 20;
          
          // More detailed check for transition out of yellow
          const isLeavingYellow = (g - prevG > 20) || (r - prevR > 20) || (prevB - b > 20);
          
          if (brightnessDiff > INNER_CONTRAST_THRESHOLD || 
              colorDiff > INNER_CONTRAST_THRESHOLD * 3 || 
              isBlueish || 
              isLeavingYellow) {
                
            innerBottomEdges.push(yellowStartY - y); // Store the width of yellow border
            debugSamples.bottomInner.push({x, y, color: prevColorHex});
            
            // Detailed debug info
            this.log(`Bottom inner at (${x},${y}): RGB(${r},${g},${b}) -> RGB(${prevR},${prevG},${prevB})`);
            this.log(`Brightness diff: ${brightnessDiff}, Color diff: ${colorDiff}, Is blue: ${isBlueish}, Leaving yellow: ${isLeavingYellow}`);
            break;
          }
        }
      }
    }
    
    // Output sample points for manual analysis
    this.log('Debug sample points:', JSON.stringify(debugSamples));
    
    this.log('Yellow border detection points:', {
      left: yellowLeftEdges.length,
      right: yellowRightEdges.length,
      top: yellowTopEdges.length,
      bottom: yellowBottomEdges.length
    });
    
    this.log('Inner boundary detection points:', {
      left: innerLeftEdges.length,
      right: innerRightEdges.length,
      top: innerTopEdges.length,
      bottom: innerBottomEdges.length
    });
    
    // Calculate median values to get reliable border measurements
    const calculateMedian = (arr: number[]): number => {
      if (arr.length === 0) return Math.floor(Math.min(width, height) * 0.1);
      const sorted = [...arr].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      return sorted.length % 2 === 0 
        ? (sorted[mid - 1] + sorted[mid]) / 2
        : sorted[mid];
    };
    
    // Use inner boundary measurements if available, otherwise use yellow border measurements
    let leftBorder, rightBorder, topBorder, bottomBorder;
    
    if (innerLeftEdges.length > 5) {
      leftBorder = calculateMedian(innerLeftEdges);
      this.log('Using inner left boundary:', leftBorder);
    } else {
      leftBorder = calculateMedian(yellowLeftEdges);
      this.log('Using yellow left border:', leftBorder);
    }
    
    if (innerRightEdges.length > 5) {
      rightBorder = calculateMedian(innerRightEdges);
      this.log('Using inner right boundary:', rightBorder);
    } else {
      rightBorder = calculateMedian(yellowRightEdges);
      this.log('Using yellow right border:', rightBorder);
    }
    
    if (innerTopEdges.length > 5) {
      topBorder = calculateMedian(innerTopEdges);
      this.log('Using inner top boundary:', topBorder);
    } else {
      topBorder = calculateMedian(yellowTopEdges);
      this.log('Using yellow top border:', topBorder);
    }
    
    if (innerBottomEdges.length > 5) {
      bottomBorder = calculateMedian(innerBottomEdges);
      this.log('Using inner bottom boundary:', bottomBorder);
    } else {
      bottomBorder = calculateMedian(yellowBottomEdges);
      this.log('Using yellow bottom border:', bottomBorder);
    }
    
    this.log('Final border measurements:', { 
      leftBorder, 
      rightBorder, 
      topBorder, 
      bottomBorder
    });
    
    // Store raw data for visualization
    this.debugData = {
      samples: debugSamples,
      yellowEdges: {
        left: yellowLeftEdges,
        right: yellowRightEdges,
        top: yellowTopEdges,
        bottom: yellowBottomEdges
      },
      innerEdges: {
        left: innerLeftEdges,
        right: innerRightEdges,
        top: innerTopEdges,
        bottom: innerBottomEdges
      }
    };
    
    // If detection failed (not enough points), use fallback
    if ((yellowLeftEdges.length < 5 && innerLeftEdges.length < 5) || 
        (yellowRightEdges.length < 5 && innerRightEdges.length < 5) || 
        (yellowTopEdges.length < 5 && innerTopEdges.length < 5) || 
        (yellowBottomEdges.length < 5 && innerBottomEdges.length < 5)) {
      this.log('Border detection insufficient, using fallback measurements');
      
      // Calculate approximate borders as percentage of card size (common for PSA cards)
      const approxLeftBorder = Math.floor(width * 0.1);
      const approxRightBorder = Math.floor(width * 0.1);
      const approxTopBorder = Math.floor(height * 0.15); // PSA cards often have larger top border
      const approxBottomBorder = Math.floor(height * 0.1);
      
      // Calculate centering percentages
      const horizontalDiff = Math.abs(approxLeftBorder - approxRightBorder);
      const verticalDiff = Math.abs(approxTopBorder - approxBottomBorder);
      
      const horizontalMax = approxLeftBorder + approxRightBorder;
      const verticalMax = approxTopBorder + approxBottomBorder;
      
      const horizontalCentering = horizontalMax > 0 
        ? 100 - (horizontalDiff / horizontalMax) * 100 
        : 100;
        
      const verticalCentering = verticalMax > 0 
        ? 100 - (verticalDiff / verticalMax) * 100 
        : 100;
      
      // Overall centering is an average of horizontal and vertical
      const overallCentering = (horizontalCentering + verticalCentering) / 2;
      
      // Store the measurements for overlay visualization
      this.lastMeasurements = {
        leftBorder: approxLeftBorder,
        rightBorder: approxRightBorder,
        topBorder: approxTopBorder,
        bottomBorder: approxBottomBorder,
        horizontalCentering,
        verticalCentering,
        overallCentering
      };
      
      return this.lastMeasurements;
    }
    
    // Calculate centering percentages
    // Perfect centering would be equal borders on opposite sides
    const horizontalDiff = Math.abs(leftBorder - rightBorder);
    const verticalDiff = Math.abs(topBorder - bottomBorder);
    
    const horizontalMax = leftBorder + rightBorder;
    const verticalMax = topBorder + bottomBorder;
    
    const horizontalCentering = horizontalMax > 0 
      ? 100 - (horizontalDiff / horizontalMax) * 100 
      : 100;
      
    const verticalCentering = verticalMax > 0 
      ? 100 - (verticalDiff / verticalMax) * 100 
      : 100;
    
    // Overall centering is an average of horizontal and vertical
    const overallCentering = (horizontalCentering + verticalCentering) / 2;
    
    // Store the measurements for overlay visualization
    this.lastMeasurements = {
      leftBorder,
      rightBorder,
      topBorder,
      bottomBorder,
      horizontalCentering,
      verticalCentering,
      overallCentering
    };
    
    // Store inner boundary points for visualization
    this.innerBoundary = {
      left: innerLeftEdges.length > 5 ? true : false,
      right: innerRightEdges.length > 5 ? true : false,
      top: innerTopEdges.length > 5 ? true : false,
      bottom: innerBottomEdges.length > 5 ? true : false
    };
    
    return this.lastMeasurements;
  }
  
  // Changed to public to enable regenerating the overlay
  public createEdgeOverlay(imageData: ImageData, edges: { top: number; bottom: number; left: number; right: number; }): ImageData {
    if (!isBrowser) {
      throw new Error('Canvas operations require a browser environment');
    }
    
    // Create a canvas to draw the overlay
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      throw new Error('Failed to get canvas context');
    }
    
    // Set canvas to image dimensions
    canvas.width = imageData.width;
    canvas.height = imageData.height;
    
    // Draw the original image
    ctx.putImageData(imageData, 0, 0);
    
    // Draw card edge boundaries
    ctx.strokeStyle = 'red';
    ctx.lineWidth = 2;
    
    // Ensure edges are properly validated to prevent jumps
    const validatedEdges = {
      left: Math.max(0, Math.min(imageData.width - 10, edges.left)),
      right: Math.max(edges.left + 10, Math.min(imageData.width, edges.right)),
      top: Math.max(0, Math.min(imageData.height - 10, edges.top)),
      bottom: Math.max(edges.top + 10, Math.min(imageData.height, edges.bottom))
    };
    
    ctx.strokeRect(
      validatedEdges.left, 
      validatedEdges.top, 
      validatedEdges.right - validatedEdges.left, 
      validatedEdges.bottom - validatedEdges.top
    );
    
    // If we have the last measurement data, draw the card borders based on those
    if (this.lastMeasurements) {
      // Calculate distribution percentages for opposing sides
      const calculateDistribution = (side1: number, side2: number): [number, number] => {
        const total = side1 + side2;
        if (total <= 0) return [50, 50]; // Default to 50/50 if no data
        
        const side1Percent = (side1 / total) * 100;
        const side2Percent = (side2 / total) * 100;
        return [side1Percent, side2Percent];
      };
      
      const [leftPercent, rightPercent] = calculateDistribution(
        this.lastMeasurements.leftBorder, 
        this.lastMeasurements.rightBorder
      );
      
      const [topPercent, bottomPercent] = calculateDistribution(
        this.lastMeasurements.topBorder, 
        this.lastMeasurements.bottomBorder
      );
      
      // Format distribution as text (e.g., "55/45")
      const formatDistribution = (percent1: number, percent2: number) => 
        `${Math.round(percent1)}/${Math.round(percent2)}`;
      
      const horizontalDistribution = formatDistribution(leftPercent, rightPercent);
      const verticalDistribution = formatDistribution(topPercent, bottomPercent);
    
      // Draw a yellow border rectangle
      ctx.strokeStyle = 'yellow';
      
      // Calculate the inner rectangle based on measurements
      // Ensure values stay within valid ranges to prevent jumps
      const cardWidth = validatedEdges.right - validatedEdges.left;
      const cardHeight = validatedEdges.bottom - validatedEdges.top;
      
      const leftBorder = Math.min(cardWidth / 2, this.lastMeasurements.leftBorder);
      const rightBorder = Math.min(cardWidth / 2, this.lastMeasurements.rightBorder);
      const topBorder = Math.min(cardHeight / 2, this.lastMeasurements.topBorder);
      const bottomBorder = Math.min(cardHeight / 2, this.lastMeasurements.bottomBorder);
      
      const innerLeft = validatedEdges.left + leftBorder;
      const innerRight = validatedEdges.right - rightBorder;
      const innerTop = validatedEdges.top + topBorder;
      const innerBottom = validatedEdges.bottom - bottomBorder;
      
      // Ensure the inner rectangle is valid
      if (innerRight > innerLeft && innerBottom > innerTop) {
        ctx.strokeRect(
          innerLeft,
          innerTop,
          innerRight - innerLeft,
          innerBottom - innerTop
        );
        
        // Add border measurements to the overlay for better visualization
        ctx.font = '12px Arial';
        ctx.fillStyle = 'yellow';
        
        // Label the borders with their measurements
        ctx.fillText(`${Math.round(leftBorder)}px`, validatedEdges.left + leftBorder / 2, (innerTop + innerBottom) / 2);
        ctx.fillText(`${Math.round(rightBorder)}px`, innerRight + rightBorder / 2, (innerTop + innerBottom) / 2);
        ctx.fillText(`${Math.round(topBorder)}px`, (innerLeft + innerRight) / 2, validatedEdges.top + topBorder / 2);
        ctx.fillText(`${Math.round(bottomBorder)}px`, (innerLeft + innerRight) / 2, innerBottom + bottomBorder / 2);
        
        // Show centering info
        ctx.fillStyle = 'white';
        ctx.fillRect((innerLeft + innerRight) / 2 - 50, innerBottom + 5, 100, 40);
        
        ctx.fillStyle = 'black';
        ctx.fillText(`H: ${horizontalDistribution}`, (innerLeft + innerRight) / 2 - 40, innerBottom + 20);
        ctx.fillText(`V: ${verticalDistribution}`, (innerLeft + innerRight) / 2 - 40, innerBottom + 35);
      }
      
      // Draw inner boundaries in cyan with a dashed line if detected
      if (this.innerBoundary) {
        ctx.strokeStyle = 'cyan';
        ctx.setLineDash([5, 5]); // Use a dashed line
        
        // Calculate the inner image boundaries based on the inner edges
        let innerBoundaryLeft = innerLeft;
        let innerBoundaryRight = innerRight;
        let innerBoundaryTop = innerTop;
        let innerBoundaryBottom = innerBottom;
        
        // Adjust if we have measured inner edges
        if (this.innerEdges) {
          if (this.innerBoundary.left) innerBoundaryLeft = edges.left + this.innerEdges.left;
          if (this.innerBoundary.right) innerBoundaryRight = edges.right - this.innerEdges.right;
          if (this.innerBoundary.top) innerBoundaryTop = edges.top + this.innerEdges.top;
          if (this.innerBoundary.bottom) innerBoundaryBottom = edges.bottom - this.innerEdges.bottom;
        }
        
        ctx.strokeRect(
          innerBoundaryLeft,
          innerBoundaryTop,
          innerBoundaryRight - innerBoundaryLeft,
          innerBoundaryBottom - innerBoundaryTop
        );
        
        // Reset line dash
        ctx.setLineDash([]);
      }
      
      // Create a translucent background for the text
      const centerX = edges.left + (edges.right - edges.left) / 2;
      const textY = edges.top - 10 > 10 ? edges.top - 10 : edges.bottom + 30;
      const textWidth = 250;
      const textHeight = 170; // Increased height to fit distribution information
      
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(
        centerX - textWidth / 2,
        textY,
        textWidth,
        textHeight
      );
      
      // Draw centering percentages
      ctx.fillStyle = 'white';
      ctx.font = '14px Arial';
      ctx.textAlign = 'center';
      
      const textLines = [
        `H-Center: ${this.lastMeasurements.horizontalCentering.toFixed(1)}%`,
        `V-Center: ${this.lastMeasurements.verticalCentering.toFixed(1)}%`,
        `Overall: ${this.lastMeasurements.overallCentering.toFixed(1)}%`,
        `L/R: ${horizontalDistribution} (${leftPercent.toFixed(1)}%/${rightPercent.toFixed(1)}%)`,
        `T/B: ${verticalDistribution} (${topPercent.toFixed(1)}%/${bottomPercent.toFixed(1)}%)`,
        `L: ${this.lastMeasurements.leftBorder.toFixed(1)}px R: ${this.lastMeasurements.rightBorder.toFixed(1)}px`,
        `T: ${this.lastMeasurements.topBorder.toFixed(1)}px B: ${this.lastMeasurements.bottomBorder.toFixed(1)}px`,
        `Algorithm: ${this.detectionMethod}`
      ];
      
      textLines.forEach((line, i) => {
        ctx.fillText(line, centerX, textY + 20 + i * 20);
      });
      
      // Draw visual indicators of distribution
      const barWidth = 150;
      const barHeight = 8;
      const barY = textY + 20 + textLines.length * 20 + 5;
      
      // Horizontal distribution bar
      ctx.fillStyle = 'gray';
      ctx.fillRect(centerX - barWidth/2, barY, barWidth, barHeight);
      
      ctx.fillStyle = 'rgba(100, 149, 237, 0.8)'; // Left - cornflower blue
      ctx.fillRect(centerX - barWidth/2, barY, barWidth * leftPercent/100, barHeight);
      
      ctx.fillStyle = 'rgba(50, 205, 50, 0.8)'; // Right - lime green
      ctx.fillRect(centerX - barWidth/2 + barWidth * leftPercent/100, barY, barWidth * rightPercent/100, barHeight);
      
      // Vertical distribution bar
      ctx.fillStyle = 'gray';
      ctx.fillRect(centerX - barWidth/2, barY + barHeight + 5, barWidth, barHeight);
      
      ctx.fillStyle = 'rgba(100, 149, 237, 0.8)'; // Top - cornflower blue
      ctx.fillRect(centerX - barWidth/2, barY + barHeight + 5, barWidth * topPercent/100, barHeight);
      
      ctx.fillStyle = 'rgba(50, 205, 50, 0.8)'; // Bottom - lime green
      ctx.fillRect(centerX - barWidth/2 + barWidth * topPercent/100, barY + barHeight + 5, barWidth * bottomPercent/100, barHeight);
      
      // Labels for the bars
      ctx.fillStyle = 'white';
      ctx.font = '10px Arial';
      ctx.textAlign = 'left';
      ctx.fillText('L/R:', centerX - barWidth/2 - 30, barY + barHeight/2 + 3);
      ctx.fillText('T/B:', centerX - barWidth/2 - 30, barY + barHeight*2 + 5 + 3);
      
      // Draw center lines in green
      ctx.strokeStyle = 'green';
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 5]);
      
      // Horizontal center line
      const hCenter = edges.top + (edges.bottom - edges.top) / 2;
      ctx.beginPath();
      ctx.moveTo(edges.left, hCenter);
      ctx.lineTo(edges.right, hCenter);
      ctx.stroke();
      
      // Vertical center line
      const vCenter = edges.left + (edges.right - edges.left) / 2;
      ctx.beginPath();
      ctx.moveTo(vCenter, edges.top);
      ctx.lineTo(vCenter, edges.bottom);
      ctx.stroke();
      
      // Reset line dash
      ctx.setLineDash([]);
    }
    
    // Return the image data
    return ctx.getImageData(0, 0, canvas.width, canvas.height);
  }
  
  // Changed to public to enable recalculating the grade
  public calculatePotentialGrade(measurements: CardMeasurements): string {
    const { overallCentering } = measurements;
    
    // Simplified grading scale based on centering
    if (overallCentering >= 97) {
      return 'PSA 10';
    } else if (overallCentering >= 90) {
      return 'PSA 9';
    } else if (overallCentering >= 80) {
      return 'PSA 8';
    } else if (overallCentering >= 70) {
      return 'PSA 7';
    } else if (overallCentering >= 60) {
      return 'PSA 6';
    } else {
      return 'PSA 5 or lower';
    }
  }

  // Add interactive adjustment capabilities
  adjustMeasurements(adjustmentType: 'outerEdges' | 'yellowBorder' | 'innerEdges', 
                    direction: 'left' | 'right' | 'top' | 'bottom',
                    amount: number): CardMeasurements {
    // Make sure we have measurements to adjust
    if (!this.lastMeasurements || !this.cardEdges) {
      throw new Error('No measurements available to adjust');
    }
    
    // Create a copy of the current measurements
    const newMeasurements = {...this.lastMeasurements};
    const oldEdges = {...this.cardEdges}; // Save old edges for calculations
    
    // Adjust the requested border
    if (adjustmentType === 'outerEdges') {
      // Update the card edges - we're moving the PSA slab edge
      if (direction === 'left') {
        this.cardEdges.left += amount;
        // If left edge moved inward, border decreases; if outward, border increases
        newMeasurements.leftBorder -= amount;
      }
      else if (direction === 'right') {
        this.cardEdges.right += amount;
        // If right edge moved outward, border increases; if inward, border decreases
        newMeasurements.rightBorder += amount;
      }
      else if (direction === 'top') {
        this.cardEdges.top += amount;
        // If top edge moved inward, border decreases; if outward, border increases
        newMeasurements.topBorder -= amount;
      }
      else if (direction === 'bottom') {
        this.cardEdges.bottom += amount;
        // If bottom edge moved outward, border increases; if inward, border decreases
        newMeasurements.bottomBorder += amount;
      }
      
      // Ensure border measurements don't go negative
      newMeasurements.leftBorder = Math.max(0, newMeasurements.leftBorder);
      newMeasurements.rightBorder = Math.max(0, newMeasurements.rightBorder);
      newMeasurements.topBorder = Math.max(0, newMeasurements.topBorder);
      newMeasurements.bottomBorder = Math.max(0, newMeasurements.bottomBorder);
    }
    else if (adjustmentType === 'yellowBorder' || adjustmentType === 'innerEdges') {
      // Update the border measurements directly (card edge doesn't move, only the yellow border)
      if (direction === 'left') newMeasurements.leftBorder += amount;
      else if (direction === 'right') newMeasurements.rightBorder += amount;
      else if (direction === 'top') newMeasurements.topBorder += amount;
      else if (direction === 'bottom') newMeasurements.bottomBorder += amount;
      
      // Ensure border measurements don't go negative or exceed card dimensions
      const cardWidth = this.cardEdges.right - this.cardEdges.left;
      const cardHeight = this.cardEdges.bottom - this.cardEdges.top;
      
      newMeasurements.leftBorder = Math.max(0, Math.min(cardWidth - 10, newMeasurements.leftBorder));
      newMeasurements.rightBorder = Math.max(0, Math.min(cardWidth - 10, newMeasurements.rightBorder));
      newMeasurements.topBorder = Math.max(0, Math.min(cardHeight - 10, newMeasurements.topBorder));
      newMeasurements.bottomBorder = Math.max(0, Math.min(cardHeight - 10, newMeasurements.bottomBorder));
    }
    
    // Recalculate centering percentages
    const horizontalDiff = Math.abs(newMeasurements.leftBorder - newMeasurements.rightBorder);
    const verticalDiff = Math.abs(newMeasurements.topBorder - newMeasurements.bottomBorder);
    
    const horizontalMax = newMeasurements.leftBorder + newMeasurements.rightBorder;
    const verticalMax = newMeasurements.topBorder + newMeasurements.bottomBorder;
    
    newMeasurements.horizontalCentering = horizontalMax > 0 
      ? 100 - (horizontalDiff / horizontalMax) * 100 
      : 100;
      
    newMeasurements.verticalCentering = verticalMax > 0 
      ? 100 - (verticalDiff / verticalMax) * 100 
      : 100;
    
    newMeasurements.overallCentering = (newMeasurements.horizontalCentering + newMeasurements.verticalCentering) / 2;
    
    // Update the last measurements
    this.lastMeasurements = newMeasurements;
    
    return newMeasurements;
  }

  // Specialized PSA template detection method
  private detectPSATemplate(imageData: ImageData): { 
    found: boolean; 
    template: 'standard' | 'tall' | 'thick'; 
    confidence: number;
    estimatedEdges?: { top: number; bottom: number; left: number; right: number; } 
  } {
    const { width, height, data } = imageData;
    
    // PSA slabs have specific aspect ratios
    // Standard: ~1.5:1 (height:width)
    // Tall: ~1.6:1 (for taller cards)
    // Thick: ~1.4:1 (for thicker slabs)
    
    const imageAspectRatio = height / width;
    
    // Check which template it most closely matches
    let template: 'standard' | 'tall' | 'thick';
    let confidence = 0;
    
    if (Math.abs(imageAspectRatio - 1.5) < 0.1) {
      template = 'standard';
      confidence = 1 - Math.abs(imageAspectRatio - 1.5) * 10; // Higher confidence when closer to expected ratio
    } else if (imageAspectRatio > 1.5) {
      template = 'tall';
      confidence = 1 - Math.abs(imageAspectRatio - 1.6) * 10;
    } else {
      template = 'thick';
      confidence = 1 - Math.abs(imageAspectRatio - 1.4) * 10;
    }
    
    // If confidence is too low, we likely don't have a PSA slab
    if (confidence < 0.5) {
      return { found: false, template, confidence };
    }
    
    // PSA slabs have a red label at the top
    // Scan the top 10% of the image for red pixels
    let redPixelCount = 0;
    let totalPixels = 0;
    let redXSum = 0;
    let redYSum = 0;
    
    for (let y = 0; y < Math.floor(height * 0.1); y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        
        // Check for PSA red
        if (r > 180 && g < 80 && b < 80) {
          redPixelCount++;
          redXSum += x;
          redYSum += y;
        }
        
        totalPixels++;
      }
    }
    
    const redPixelPercentage = redPixelCount / totalPixels;
    
    // If we have a significant number of red pixels, it's likely a PSA slab
    if (redPixelPercentage > 0.05) {
      confidence = Math.min(confidence + redPixelPercentage, 0.95);
      
      // Calculate average position of red pixels to find label center
      const avgX = redXSum / redPixelCount;
      const avgY = redYSum / redPixelCount;
      
      // Estimate slab dimensions based on template
      const estimatedWidth = width * 0.9; // Slab is typically 90% of image width
      const estimatedHeight = estimatedWidth * (template === 'standard' ? 1.5 : 
                                               template === 'tall' ? 1.6 : 1.4);
      
      // Calculate estimated slab position
      const left = Math.max(0, Math.floor((width - estimatedWidth) / 2));
      const right = Math.min(width - 1, Math.floor(left + estimatedWidth));
      const top = Math.max(0, Math.floor(avgY - (avgY * 0.5))); // Label is near the top
      const bottom = Math.min(height - 1, Math.floor(top + estimatedHeight));
      
      return { 
        found: true, 
        template, 
        confidence,
        estimatedEdges: { top, bottom, left, right }
      };
    }
    
    return { found: false, template, confidence };
  }

  // Change from private to public to allow access in _index.tsx
  public async extractCardRegion(imageData: ImageData, edges: { top: number; bottom: number; left: number; right: number; }): Promise<ImageData> {
    if (!isBrowser) {
      return new ImageData(1, 1);
    }
    
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      throw new Error('Could not get canvas context');
    }
    
    const width = edges.right - edges.left;
    const height = edges.bottom - edges.top;
    
    canvas.width = width;
    canvas.height = height;
    
    // Create a new ImageData object for the card region
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    
    if (!tempCtx) {
      throw new Error('Could not get temp canvas context');
    }
    
    tempCanvas.width = imageData.width;
    tempCanvas.height = imageData.height;
    tempCtx.putImageData(imageData, 0, 0);
    
    // Draw the card region to our main canvas
    ctx.drawImage(
      tempCanvas,
      edges.left, edges.top, width, height,
      0, 0, width, height
    );
    
    return ctx.getImageData(0, 0, width, height);
  }
}

// Singleton instance
export const cardAnalyzer = new CardAnalyzer(); 