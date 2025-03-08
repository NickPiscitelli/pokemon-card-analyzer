// Check if we're in a browser environment
const isBrowser = typeof window !== 'undefined' && typeof window.document !== 'undefined';

// WebGL shader for edge detection and color analysis
const vertexShaderSource = `
  attribute vec2 a_position;
  attribute vec2 a_texCoord;
  varying vec2 v_texCoord;

  void main() {
    gl_Position = vec4(a_position, 0, 1);
    v_texCoord = a_texCoord;
  }
`;

const fragmentShaderSource = `
  precision highp float;
  uniform sampler2D u_image;
  uniform vec2 u_resolution;
  varying vec2 v_texCoord;

  // Constants for yellow border detection
  const vec3 YELLOW_MIN = vec3(0.7, 0.63, 0.0);
  const vec3 YELLOW_MAX = vec3(1.0, 0.95, 0.47);
  const float CONTRAST_THRESHOLD = 0.18;

  bool isYellow(vec3 color) {
    return all(greaterThanEqual(color, YELLOW_MIN)) && 
           all(lessThanEqual(color, YELLOW_MAX));
  }

  float getContrast(vec2 coord, vec2 offset) {
    vec3 color1 = texture2D(u_image, coord).rgb;
    vec3 color2 = texture2D(u_image, coord + offset).rgb;
    return length(color1 - color2);
  }

  void main() {
    vec2 onePixel = vec2(1.0) / u_resolution;
    vec3 color = texture2D(u_image, v_texCoord).rgb;
    
    // Check for yellow border
    float isYellowBorder = float(isYellow(color));
    
    // Calculate contrast in all directions
    float contrast = max(
      max(
        getContrast(v_texCoord, vec2(onePixel.x, 0.0)),
        getContrast(v_texCoord, vec2(0.0, onePixel.y))
      ),
      max(
        getContrast(v_texCoord, vec2(-onePixel.x, 0.0)),
        getContrast(v_texCoord, vec2(0.0, -onePixel.y))
      )
    );
    
    // Output: R channel for yellow detection, G channel for contrast
    gl_FragColor = vec4(isYellowBorder, contrast > CONTRAST_THRESHOLD ? 1.0 : 0.0, 0.0, 1.0);
  }
`;

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
  imageUrl?: string;
  cardImageData: ImageData;
  fullImageData: ImageData;
  edgeOverlayImageData: ImageData;
  edgeOverlayUrl: string;
  potentialGrade: string;
  analyzer?: CardAnalyzer;
  detectionMethod?: string;
}

export class CardAnalyzer {
  private gl: WebGLRenderingContext | null = null;
  private program: WebGLProgram | null = null;
  private lastMeasurements: CardMeasurements | null = null;
  private cardEdges: { left: number; right: number; top: number; bottom: number; } | null = null;
  private innerEdges: { left: number; right: number; top: number; bottom: number; } | null = null;
  public detectionMethod: string = 'Canny Edge Detection';
  private imageWidth: number | null = null;
  private imageHeight: number | null = null;

  constructor() {
    if (isBrowser) {
      const canvas = document.createElement('canvas');
      this.gl = canvas.getContext('webgl');
      if (this.gl) {
        this.initWebGL();
      }
    }
  }

  private initWebGL(): void {
    if (!this.gl) return;

    // Create shaders
    const vertexShader = this.createShader(this.gl.VERTEX_SHADER, vertexShaderSource);
    const fragmentShader = this.createShader(this.gl.FRAGMENT_SHADER, fragmentShaderSource);

    if (!vertexShader || !fragmentShader) return;

    // Create program
    this.program = this.gl.createProgram();
    if (!this.program) return;

    this.gl.attachShader(this.program, vertexShader);
    this.gl.attachShader(this.program, fragmentShader);
    this.gl.linkProgram(this.program);

    if (!this.gl.getProgramParameter(this.program, this.gl.LINK_STATUS)) {
      console.error('Unable to initialize WebGL program');
      return;
    }
  }

  private createShader(type: number, source: string): WebGLShader | null {
    if (!this.gl) return null;

    const shader = this.gl.createShader(type);
    if (!shader) return null;

    this.gl.shaderSource(shader, source);
    this.gl.compileShader(shader);

    if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
      console.error('Shader compile error:', this.gl.getShaderInfoLog(shader));
      this.gl.deleteShader(shader);
      return null;
    }

    return shader;
  }

  private setupWebGLContext(width: number, height: number): void {
    if (!this.gl || !this.program) return;

    this.gl.canvas.width = width;
    this.gl.canvas.height = height;
    this.gl.viewport(0, 0, width, height);

    // Set up buffers
    const positions = new Float32Array([
      -1, -1,
      1, -1,
      -1, 1,
      1, 1,
    ]);

    const texCoords = new Float32Array([
      0, 0,
      1, 0,
      0, 1,
      1, 1,
    ]);

    // Create and bind position buffer
    const positionBuffer = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, positionBuffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, positions, this.gl.STATIC_DRAW);

    const positionLocation = this.gl.getAttribLocation(this.program, 'a_position');
    this.gl.enableVertexAttribArray(positionLocation);
    this.gl.vertexAttribPointer(positionLocation, 2, this.gl.FLOAT, false, 0, 0);

    // Create and bind texture coordinate buffer
    const texCoordBuffer = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, texCoordBuffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, texCoords, this.gl.STATIC_DRAW);

    const texCoordLocation = this.gl.getAttribLocation(this.program, 'a_texCoord');
    this.gl.enableVertexAttribArray(texCoordLocation);
    this.gl.vertexAttribPointer(texCoordLocation, 2, this.gl.FLOAT, false, 0, 0);
  }

  private createTexture(image: HTMLImageElement | HTMLCanvasElement): WebGLTexture | null {
    if (!this.gl) return null;

    const texture = this.gl.createTexture();
    this.gl.bindTexture(this.gl.TEXTURE_2D, texture);

    // Set texture parameters
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);

    // Upload image to texture
    this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, image);

    return texture;
  }

  private async processImageWithWebGL(image: HTMLImageElement | HTMLCanvasElement): Promise<{
    yellowBorderData: Float32Array;
    contrastData: Float32Array;
  }> {
    if (!this.gl || !this.program) {
      throw new Error('WebGL not initialized');
    }

    this.setupWebGLContext(image.width, image.height);
    const texture = this.createTexture(image);

    if (!texture) {
      throw new Error('Failed to create texture');
    }

    // Use the shader program
    this.gl.useProgram(this.program);

    // Set uniforms
    const resolutionLocation = this.gl.getUniformLocation(this.program, 'u_resolution');
    this.gl.uniform2f(resolutionLocation, image.width, image.height);

    // Draw
    this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);

    // Read results
    const pixels = new Uint8Array(image.width * image.height * 4);
    this.gl.readPixels(0, 0, image.width, image.height, this.gl.RGBA, this.gl.UNSIGNED_BYTE, pixels);

    // Convert to separate yellow border and contrast data
    const yellowBorderData = new Float32Array(image.width * image.height);
    const contrastData = new Float32Array(image.width * image.height);

    for (let i = 0; i < pixels.length; i += 4) {
      const idx = i / 4;
      yellowBorderData[idx] = pixels[i] / 255;     // R channel
      contrastData[idx] = pixels[i + 1] / 255;     // G channel
    }

    return { yellowBorderData, contrastData };
  }

  async analyzeCard(imageElement: HTMLImageElement | HTMLCanvasElement): Promise<CardAnalysisResult> {
    try {
      // Process the image with WebGL for edge detection
      const { yellowBorderData, contrastData } = await this.processImageWithWebGL(imageElement);

      // Get dimensions
      const width = imageElement.width;
      const height = imageElement.height;
      
      // Store image dimensions for future calculations
      this.imageWidth = width;
      this.imageHeight = height;

      // Detect slab edges (optional, can be null)
      const slabEdges = this.detectSlabEdges(contrastData, width, height);

      // Detect card edges
      const cardEdges = this.detectCardEdges(yellowBorderData, contrastData, width, height);

      // Store card edges for later use
      this.cardEdges = cardEdges;

      // Set inner edges with initial padding of 10px
      this.innerEdges = {
        left: this.cardEdges.left + 10,
        right: this.cardEdges.right - 10,
        top: this.cardEdges.top + 10,
        bottom: this.cardEdges.bottom - 10
      };

      // Measure borders
      this.lastMeasurements = this.measureCardBorders(cardEdges);
      
      // Create full image data
      const fullImageData = this.createImageData(imageElement);
      
      // Extract the card region
      const cardCanvas = this.extractCardRegion(imageElement, cardEdges);
      const cardImageData = this.createImageData(cardCanvas);
      
      // Create visualization overlay
      const overlay = this.createEdgeOverlay(imageElement, cardEdges, slabEdges, this.innerEdges);

      return {
        measurements: this.lastMeasurements,
        imageUrl: imageElement instanceof HTMLImageElement ? imageElement.src : undefined,
        cardImageData,
        fullImageData,
        edgeOverlayImageData: overlay,
        edgeOverlayUrl: this.createDataURL(overlay),
        potentialGrade: this.calculatePotentialGrade(this.lastMeasurements),
        detectionMethod: this.detectionMethod
      };
    } catch (error) {
      console.error("Error analyzing card:", error);
      return this.createDummyResult();
    }
  }

  private detectSlabEdges(contrastData: Float32Array, width: number, height: number): { 
    left: number; 
    right: number; 
    top: number; 
    bottom: number; 
  } | null {
    // Track contrast points for each edge
    const leftPoints: number[] = [];
    const rightPoints: number[] = [];
    const topPoints: number[] = [];
    const bottomPoints: number[] = [];

    // Scan for high contrast edges
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        if (contrastData[idx] > 0.5) {  // High contrast detected
          // Only consider points near the edges
          if (x < width * 0.2) leftPoints.push(x);
          if (x > width * 0.8) rightPoints.push(x);
          if (y < height * 0.2) topPoints.push(y);
          if (y > height * 0.8) bottomPoints.push(y);
        }
      }
    }

    // Helper function to get median value
    const getMedian = (arr: number[]): number => {
      if (arr.length === 0) return 0;
      arr.sort((a, b) => a - b);
      const mid = Math.floor(arr.length / 2);
      return arr.length % 2 === 0 ? (arr[mid - 1] + arr[mid]) / 2 : arr[mid];
    };

    // Get median values for each edge
    const edges = {
      left: getMedian(leftPoints),
      right: getMedian(rightPoints),
      top: getMedian(topPoints),
      bottom: getMedian(bottomPoints)
    };

    // Check if we found enough points for each edge
    if (leftPoints.length < 10 || rightPoints.length < 10 || 
        topPoints.length < 10 || bottomPoints.length < 10) {
      return null;
    }

    // Verify the aspect ratio matches a PSA slab
    const slabWidth = edges.right - edges.left;
    const slabHeight = edges.bottom - edges.top;
    const aspectRatio = slabHeight / slabWidth;

    // PSA slabs have aspect ratios around 1.4-1.6
    if (aspectRatio < 1.3 || aspectRatio > 1.7) {
      return null;
    }

    // Verify the slab size is reasonable (at least 60% of the image)
    const minSize = Math.min(width, height) * 0.6;
    if (slabWidth < minSize || slabHeight < minSize) {
      return null;
    }

    return edges;
  }

  private detectCardEdges(yellowData: Float32Array, contrastData: Float32Array, width: number, height: number): { 
    left: number; 
    right: number; 
    top: number; 
    bottom: number; 
  } {
    // First try to detect using yellow border
    const yellowEdges = {
      left: width,
      right: 0,
      top: height,
      bottom: 0
    };

    let yellowPixelCount = 0;

    // Scan for yellow pixels
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        if (yellowData[idx] > 0.5) {  // Yellow detected
          yellowEdges.left = Math.min(yellowEdges.left, x);
          yellowEdges.right = Math.max(yellowEdges.right, x);
          yellowEdges.top = Math.min(yellowEdges.top, y);
          yellowEdges.bottom = Math.max(yellowEdges.bottom, y);
          yellowPixelCount++;
        }
      }
    }

    // If we found enough yellow pixels, use those edges
    if (yellowPixelCount > 100) {
      // Adjust edges slightly inward to account for border thickness
      const borderThickness = 3;
      return {
        left: yellowEdges.left + borderThickness,
        right: yellowEdges.right - borderThickness,
        top: yellowEdges.top + borderThickness,
        bottom: yellowEdges.bottom - borderThickness
      };
    }

    // Fallback to contrast-based detection
    const contrastEdges = {
      left: width,
      right: 0,
      top: height,
      bottom: 0
    };

    // Track contrast points for each edge
    const leftPoints: number[] = [];
    const rightPoints: number[] = [];
    const topPoints: number[] = [];
    const bottomPoints: number[] = [];

    // Scan for high contrast edges
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        if (contrastData[idx] > 0.5) {  // High contrast detected
          // Only consider points within reasonable bounds
          if (x < width * 0.4) leftPoints.push(x);
          if (x > width * 0.6) rightPoints.push(x);
          if (y < height * 0.4) topPoints.push(y);
          if (y > height * 0.6) bottomPoints.push(y);
        }
      }
    }

    // Helper function to get median value
    const getMedian = (arr: number[]): number => {
      if (arr.length === 0) return 0;
      arr.sort((a, b) => a - b);
      const mid = Math.floor(arr.length / 2);
      return arr.length % 2 === 0 ? (arr[mid - 1] + arr[mid]) / 2 : arr[mid];
    };

    // Use median values for each edge if available
    if (leftPoints.length > 0) contrastEdges.left = getMedian(leftPoints);
    if (rightPoints.length > 0) contrastEdges.right = getMedian(rightPoints);
    if (topPoints.length > 0) contrastEdges.top = getMedian(topPoints);
    if (bottomPoints.length > 0) contrastEdges.bottom = getMedian(bottomPoints);

    // If we're missing any edges, estimate them based on card proportions
    const CARD_ASPECT_RATIO = 2.5 / 3.5;  // Standard Pokemon card ratio

    if (contrastEdges.left === width || contrastEdges.right === 0) {
      // Estimate horizontal edges based on vertical edges and aspect ratio
      const cardHeight = contrastEdges.bottom - contrastEdges.top;
      const expectedWidth = cardHeight * CARD_ASPECT_RATIO;
      const center = width / 2;
      contrastEdges.left = Math.max(0, Math.round(center - expectedWidth / 2));
      contrastEdges.right = Math.min(width, Math.round(center + expectedWidth / 2));
    }

    if (contrastEdges.top === height || contrastEdges.bottom === 0) {
      // Estimate vertical edges based on horizontal edges and aspect ratio
      const cardWidth = contrastEdges.right - contrastEdges.left;
      const expectedHeight = cardWidth / CARD_ASPECT_RATIO;
      const center = height / 2;
      contrastEdges.top = Math.max(0, Math.round(center - expectedHeight / 2));
      contrastEdges.bottom = Math.min(height, Math.round(center + expectedHeight / 2));
    }

    return contrastEdges;
  }

  private measureCardBorders(edges: { 
    left: number; 
    right: number; 
    top: number; 
    bottom: number; 
  }): CardMeasurements {
    // Get the image dimensions (these should be stored when the image is processed)
    const imageWidth = this.imageWidth || 0;
    const imageHeight = this.imageHeight || 0;

    // Calculate border measurements - distances from image edges to card edges
    const leftBorder = edges.left;
    const rightBorder = imageWidth > 0 ? imageWidth - edges.right : 0;
    const topBorder = edges.top;
    const bottomBorder = imageHeight > 0 ? imageHeight - edges.bottom : 0;

    // Log measurements for debugging
    console.log("Border measurements:", { 
      leftBorder, rightBorder, topBorder, bottomBorder,
      imageWidth, imageHeight,
      edges
    });

    // Calculate centering percentages
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

    const overallCentering = (horizontalCentering + verticalCentering) / 2;

    return {
      leftBorder,
      rightBorder,
      topBorder,
      bottomBorder,
      horizontalCentering,
      verticalCentering,
      overallCentering
    };
  }

  private createEdgeOverlay(
    image: HTMLImageElement | HTMLCanvasElement, 
    cardEdges: { left: number; right: number; top: number; bottom: number; },
    slabEdges: { left: number; right: number; top: number; bottom: number; } | null,
    innerEdges: { left: number; right: number; top: number; bottom: number; } | null = null
  ): ImageData {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get canvas context');

    // Set canvas dimensions to match the image
    canvas.width = image.width;
    canvas.height = image.height;

    // Clear the canvas and draw the original image
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

    // Calculate the actual dimensions for outer edges
    const cardWidth = cardEdges.right - cardEdges.left;
    const cardHeight = cardEdges.bottom - cardEdges.top;

    // Draw outer edges with red
    ctx.strokeStyle = 'rgba(255, 0, 0, 0.8)';  // Semi-transparent red
    ctx.lineWidth = 3;
    ctx.setLineDash([]); // Solid line
    ctx.strokeRect(
      cardEdges.left,
      cardEdges.top,
      cardWidth,
      cardHeight
    );

    // Draw inner edges with blue
    if (innerEdges) {
      const innerWidth = innerEdges.right - innerEdges.left;
      const innerHeight = innerEdges.bottom - innerEdges.top;
      
      ctx.strokeStyle = '#00BFFF';  // Deep sky blue - highly visible
      ctx.lineWidth = 3;
      ctx.setLineDash([8, 4]); // Dashed line pattern
      ctx.strokeRect(
        innerEdges.left,
        innerEdges.top,
        innerWidth,
        innerHeight
      );
      ctx.setLineDash([]); // Reset line dash
    }

    // Add measurements and guidelines
    if (this.lastMeasurements) {
      const { leftBorder, rightBorder, topBorder, bottomBorder, horizontalCentering, verticalCentering } = this.lastMeasurements;

      // Draw center lines
      ctx.setLineDash([5, 5]);
      ctx.strokeStyle = 'rgba(0, 255, 0, 0.5)';  // Semi-transparent green
      ctx.lineWidth = 1;

      // Calculate center points
      const centerX = cardEdges.left + cardWidth / 2;
      const centerY = cardEdges.top + cardHeight / 2;

      // Vertical center line
      ctx.beginPath();
      ctx.moveTo(centerX, cardEdges.top - 20);
      ctx.lineTo(centerX, cardEdges.bottom + 20);
      ctx.stroke();

      // Horizontal center line
      ctx.beginPath();
      ctx.moveTo(cardEdges.left - 20, centerY);
      ctx.lineTo(cardEdges.right + 20, centerY);
      ctx.stroke();

      // Reset line dash
      ctx.setLineDash([]);

      // Add measurements text
      ctx.font = '16px Arial';
      ctx.fillStyle = 'white';
      ctx.strokeStyle = 'black';
      ctx.lineWidth = 3;

      // Function to draw outlined text
      const drawOutlinedText = (text: string, x: number, y: number) => {
        ctx.strokeText(text, x, y);
        ctx.fillText(text, x, y);
      };

      // Create background for measurements
      const padding = 10;
      const metrics = ctx.measureText(`H: ${horizontalCentering.toFixed(1)}% V: ${verticalCentering.toFixed(1)}%`);
      const textWidth = metrics.width + padding * 2;
      const textHeight = 70;

      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(
        centerX - textWidth / 2,
        cardEdges.bottom + padding,
        textWidth,
        textHeight
      );

      // Draw measurements
      ctx.fillStyle = 'white';
      drawOutlinedText(
        `H: ${horizontalCentering.toFixed(1)}%`,
        centerX - textWidth / 2 + padding,
        cardEdges.bottom + padding + 20
      );
      drawOutlinedText(
        `V: ${verticalCentering.toFixed(1)}%`,
        centerX - textWidth / 2 + padding,
        cardEdges.bottom + padding + 40
      );
      drawOutlinedText(
        `L: ${leftBorder.toFixed(1)} R: ${rightBorder.toFixed(1)}`,
        centerX - textWidth / 2 + padding,
        cardEdges.bottom + padding + 60
      );

      // Add border measurements on each side
      ctx.font = '14px Arial';
      // Left border
      drawOutlinedText(
        `${leftBorder.toFixed(1)}px`,
        cardEdges.left + 5,
        centerY - 10
      );
      // Right border
      drawOutlinedText(
        `${rightBorder.toFixed(1)}px`,
        cardEdges.right - 50,
        centerY - 10
      );
      // Top border
      drawOutlinedText(
        `${topBorder.toFixed(1)}px`,
        centerX - 25,
        cardEdges.top + 20
      );
      // Bottom border
      drawOutlinedText(
        `${bottomBorder.toFixed(1)}px`,
        centerX - 25,
        cardEdges.bottom - 10
      );
    }

    return ctx.getImageData(0, 0, canvas.width, canvas.height);
  }

  // Public method to calculate potential grade
  public calculatePotentialGrade(measurements: CardMeasurements): string {
    const { overallCentering } = measurements;

    if (overallCentering >= 97) return 'PSA 10';
    if (overallCentering >= 90) return 'PSA 9';
    if (overallCentering >= 80) return 'PSA 8';
    if (overallCentering >= 70) return 'PSA 7';
    if (overallCentering >= 60) return 'PSA 6';
    return 'PSA 5 or lower';
  }

  private extractCardRegion(image: HTMLImageElement | HTMLCanvasElement, edges: { 
    left: number; 
    right: number; 
    top: number; 
    bottom: number; 
  }): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get canvas context');

    const width = edges.right - edges.left;
    const height = edges.bottom - edges.top;

    canvas.width = width;
    canvas.height = height;

    ctx.drawImage(image, edges.left, edges.top, width, height, 0, 0, width, height);

    return canvas;
  }

  private createImageData(image: HTMLImageElement | HTMLCanvasElement): ImageData {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get canvas context');

    canvas.width = image.width;
    canvas.height = image.height;
    ctx.drawImage(image, 0, 0);

    return ctx.getImageData(0, 0, canvas.width, canvas.height);
  }

  private createDataURL(imageData: ImageData): string {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get canvas context');

    canvas.width = imageData.width;
    canvas.height = imageData.height;
    ctx.putImageData(imageData, 0, 0);

    return canvas.toDataURL('image/png');
  }

  private createDummyResult(): CardAnalysisResult {
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
      cardImageData: dummyImageData,
      fullImageData: dummyImageData,
      edgeOverlayImageData: dummyImageData,
      edgeOverlayUrl: '',
      potentialGrade: 'N/A'
    };
  }

  // Public method to adjust measurements
  public adjustMeasurements(
    type: 'outer' | 'inner',
    direction: 'left' | 'right' | 'top' | 'bottom',
    amount: number
  ): CardMeasurements {
    if (!this.cardEdges || !this.lastMeasurements) {
      throw new Error('No card edges or measurements available');
    }
    
    if (!this.innerEdges) {
      // Initialize inner edges if they don't exist yet
      this.innerEdges = {
        left: this.cardEdges.left + 10,
        right: this.cardEdges.right - 10,
        top: this.cardEdges.top + 10,
        bottom: this.cardEdges.bottom - 10
      };
    }

    // Adjust the edge based on the direction and amount
    if (type === 'outer') {
      if (direction === 'left') {
        this.cardEdges.left += amount;
      } else if (direction === 'right') {
        this.cardEdges.right += amount;
      } else if (direction === 'top') {
        this.cardEdges.top += amount;
      } else if (direction === 'bottom') {
        this.cardEdges.bottom += amount;
      }
    } else if (type === 'inner') {
      if (direction === 'left') {
        this.innerEdges.left += amount;
      } else if (direction === 'right') {
        this.innerEdges.right += amount;
      } else if (direction === 'top') {
        this.innerEdges.top += amount;
      } else if (direction === 'bottom') {
        this.innerEdges.bottom += amount;
      }
    }

    // Verify we have valid image dimensions
    if (!this.imageWidth || !this.imageHeight) {
      console.warn('Image dimensions not available for accurate measurement calculations');
    }

    // Recalculate measurements based on outer edges
    this.lastMeasurements = this.measureCardBorders(this.cardEdges);
    return this.lastMeasurements;
  }

  // Public method to get current card edges
  public getCurrentEdges() {
    if (!this.cardEdges) return null;
    return {
      cardEdges: this.cardEdges,
      innerEdges: this.innerEdges || {
        left: this.cardEdges.left + 10,
        right: this.cardEdges.right - 10,
        top: this.cardEdges.top + 10,
        bottom: this.cardEdges.bottom - 10
      },
      slabEdges: null
    };
  }

  // Public method to create edge overlay
  public generateEdgeOverlay(
    image: HTMLImageElement | HTMLCanvasElement,
    edges: { 
      cardEdges: { left: number; right: number; top: number; bottom: number; };
      innerEdges?: { left: number; right: number; top: number; bottom: number; } | null;
      slabEdges: { left: number; right: number; top: number; bottom: number; } | null;
    } | null = null,
    slabEdges: { left: number; right: number; top: number; bottom: number; } | null = null
  ): ImageData {
    // Store image dimensions if not already stored
    if (!this.imageWidth || !this.imageHeight) {
      this.imageWidth = image.width;
      this.imageHeight = image.height;
    }
    
    // Continue with the existing logic...
    if (edges === null && this.cardEdges) {
      edges = {
        cardEdges: this.cardEdges,
        innerEdges: this.innerEdges,
        slabEdges: slabEdges || null
      };
    }
    
    const cardEdgesToUse = edges?.cardEdges || this.cardEdges;
    const innerEdgesToUse = edges?.innerEdges || this.innerEdges;
    const slabEdgesToUse = edges?.slabEdges || slabEdges;
    
    if (!cardEdgesToUse) {
      throw new Error('No card edges available for overlay generation');
    }
    
    return this.createEdgeOverlay(image, cardEdgesToUse, slabEdgesToUse, innerEdgesToUse);
  }

  // Public methods to get and set image dimensions
  public setImageDimensions(width: number, height: number): void {
    this.imageWidth = width;
    this.imageHeight = height;
  }
  
  public getImageDimensions(): { width: number | null; height: number | null } {
    return { width: this.imageWidth, height: this.imageHeight };
  }
}

// Singleton instance
export const cardAnalyzer = new CardAnalyzer();