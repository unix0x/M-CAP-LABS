/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Layers, 
  Save, 
  Type,
  Eye,
  EyeOff,
  Recycle,
  Play,
  Pause,
  X,
  Lock,
  Unlock,
  Sliders,
  CheckSquare,
  Square,
  Palette,
  Sun,
  Moon,
  Zap,
  ZapOff,
  FileDown,
  Download,
  Sparkles,
  Upload,
  Image as ImageIcon,
  Smile,
  ChevronRight,
  ChevronLeft,
  Plus,
  FlipHorizontal,
  Activity,
  Trash2
} from 'lucide-react';
import * as faceapi from '@vladmandic/face-api';

// --- Types ---

type LayerType = 'image' | 'text';

interface LayerState {
  id: string;
  groupId?: string;
  name: string;
  type: LayerType;
  url: string | null;
  text: string;
  fontSize: number;
  scale: number;
  rotation: number;
  x: number;
  y: number;
  color: string;
  hue: number;
  noise: number;
  noiseMode: 'chrome' | 'color';
  visible: boolean;
  opacity: number;
  isLocked: boolean;
  isSelected: boolean;
  useOriginalColor?: boolean;
  flipX?: boolean;
}

// --- Constants ---

const PRESET_IMAGES = [
  '/Cap_outline.png',
  '/M.png',
  '/Cap.png'
];

const LAYER_NAMES = ['Outline', 'M Logo', 'Cap'];

const darkenColor = (hex: string, factor: number) => {
  if (!hex || hex === 'transparent') return hex;
  const cleanHex = hex.startsWith('#') ? hex.slice(1) : hex;
  if (cleanHex.length !== 6) return hex;
  
  let r = parseInt(cleanHex.slice(0, 2), 16);
  let g = parseInt(cleanHex.slice(2, 4), 16);
  let b = parseInt(cleanHex.slice(4, 6), 16);
  
  r = Math.max(0, Math.min(255, Math.round(r * factor)));
  g = Math.max(0, Math.min(255, Math.round(g * factor)));
  b = Math.max(0, Math.min(255, Math.round(b * factor)));
  
  const toHex = (n: number) => n.toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

const DEFAULT_COLORS = [
  '#FF007F', // Neon Pink
  '#00E5FF', // Electric Blue
  '#9D00FF', // Cyber Purple
  '#39FF14', // Acid Green
  '#FFF000', // Laser Yellow
  '#FF5E00', // Neon Orange
  '#FF00FF', // Magenta
  '#00FFFF', // Cyan
  '#8F00FF', // Violet
  '#00FF9F', // Spring Green
  '#FF3131', // Neon Red
  '#FFFFFF'  // Pure White
];

const INITIAL_COLORS = ['#FF007F', '#0077B6', '#9D00FF'];

const getCapPalette = () => {
  const theme = THEMES[Math.floor(Math.random() * THEMES.length)];
  return [...theme.colors];
};

const THEMES = [
  { name: 'SYNTHWAVE', colors: ['#FF007F', '#9D00FF', '#00FFFF'] },
  { name: 'CYBERPUNK', colors: ['#FFF000', '#00E5FF', '#FF3131'] },
  { name: 'NEON PUNK', colors: ['#39FF14', '#FF5E00', '#FF00FF'] }
];

const PRESET_CAPS = [
  { name: 'Unix', url: '/Unix_Cap.png', icon: '/Unix_Cap.png', scaleAdj: 1.0, yAdj: 0, iconScale: 1.0 },
  { name: 'Classic', url: '/Classic_Cap.png', icon: '/Classic_Cap.png', scaleAdj: 1.0, yAdj: 0, iconScale: 1.0 },
  { name: 'Classic Dark', url: '/Classic_Dark.png', icon: '/Classic_Dark.png', scaleAdj: 1.0, yAdj: 0, iconScale: 1.0 }
];

const PRESET_CAPS_MEME = [
  ...PRESET_CAPS,
  { name: 'M Logo', url: '/M.png', icon: '/M.png', scaleAdj: 0.5, yAdj: 0, iconScale: 1.4, color: '#2E004B', useOriginalColor: false }
];

const CapIcon = ({ colors, size = 24 }: { colors: string[], size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Bottom/Brim */}
    <path d="M4 16C4 16 6 14 12 14C18 14 20 16 20 16L21 18H3L4 16Z" fill={colors[0]} />
    {/* Mid/Body */}
    <path d="M6 14C6 10 8 7 12 7C16 7 18 10 18 14H6Z" fill={colors[1]} />
    {/* Top/Button */}
    <circle cx="12" cy="7" r="1.5" fill={colors[2]} />
  </svg>
);

// --- Components ---

export default function App() {
  const [layers, setLayers] = useState<LayerState[]>(
    [2, 1, 0].map((presetIdx, i) => ({
      id: `layer-${presetIdx}`,
      name: LAYER_NAMES[presetIdx],
      type: 'image',
      url: PRESET_IMAGES[presetIdx],
      text: '',
      fontSize: 160,
      scale: 1,
      rotation: 0,
      x: 512,
      y: 512,
      color: INITIAL_COLORS[i % INITIAL_COLORS.length],
      hue: 0,
      noise: 0.15,
      noiseMode: 'chrome',
      visible: true,
      opacity: 1,
      isLocked: false,
      isSelected: true,
    }))
  );
  const [activeLayerIdx, setActiveLayerIdx] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isAnimating, setIsAnimating] = useState(true);
  const [noiseSeed, setNoiseSeed] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [currentThemeIdx, setCurrentThemeIdx] = useState(0);
  const [bgEnabled, setBgEnabled] = useState(false);
  const [bgColor, setBgColor] = useState('#333333'); // Default Dark Grey
  const [maxNoiseEnabled, setMaxNoiseEnabled] = useState(false);
  const [isLightMode, setIsLightMode] = useState(false);
  const [randomizePalettes, setRandomizePalettes] = useState(false);
  const [mode, setMode] = useState<'labs' | 'memes'>('labs');
  const labsLayersRef = useRef<LayerState[]>([]);
  const [memeImage, setMemeImage] = useState<string | null>(null);
  const [memeAspectRatio, setMemeAspectRatio] = useState(1);
  const memeImgRef = useRef<HTMLImageElement | null>(null);
  const [isProcessingFaces, setIsProcessingFaces] = useState(false);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [interactionMode, setInteractionMode] = useState<'drag' | 'resize' | 'rotate' | null>(null);
  const [initialMousePos, setInitialMousePos] = useState({ x: 0, y: 0 });
  const [initialLayerState, setInitialLayerState] = useState<LayerState | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageCache = useRef<Map<string, CanvasImageSource>>(new Map());
  const offCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const requestRef = useRef<number | null>(null);

  useEffect(() => {
    if (mode === 'memes') {
      labsLayersRef.current = layers;
      setLayers([]);
      setActiveLayerIdx(null);
    } else {
      if (labsLayersRef.current.length > 0) {
        setLayers(labsLayersRef.current);
      } else {
        // Reset to default if no previous state
        setLayers([2, 1, 0].map((presetIdx, i) => ({
          id: `layer-${presetIdx}`,
          name: LAYER_NAMES[presetIdx],
          type: 'image',
          url: PRESET_IMAGES[presetIdx],
          text: '',
          fontSize: 160,
          scale: 1,
          rotation: 0,
          x: 512,
          y: 512,
          color: INITIAL_COLORS[i % INITIAL_COLORS.length],
          hue: 0,
          noise: 0.15,
          noiseMode: 'chrome',
          visible: true,
          opacity: 1,
          isLocked: false,
          isSelected: true,
        })));
      }
      setMemeImage(null);
      memeImgRef.current = null;
    }
  }, [mode]);

  // Update text colors when switching between light and dark mode to maintain visibility
  useEffect(() => {
    setLayers(prev => prev.map(layer => {
      if (layer.type === 'text') {
        // If switching to light mode and text is white, make it black
        if (isLightMode && layer.color.toUpperCase() === '#FFFFFF') {
          return { ...layer, color: '#000000' };
        } 
        // If switching to dark mode and text is black, make it white
        else if (!isLightMode && layer.color.toUpperCase() === '#000000') {
          return { ...layer, color: '#FFFFFF' };
        }
      }
      return layer;
    }));
  }, [isLightMode]);

  // Load face-api models
  useEffect(() => {
    const loadModels = async () => {
      try {
        const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model';
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        ]);
        setModelsLoaded(true);
      } catch (err) {
        console.error('Failed to load face-api models:', err);
      }
    };
    loadModels();
  }, []);

  // Animation Loop
  const animate = useCallback(() => {
    if (isAnimating) {
      setNoiseSeed(prev => (prev + 1) % 1000);
    }
    requestRef.current = requestAnimationFrame(animate);
  }, [isAnimating]);

  useEffect(() => {
    requestRef.current = requestAnimationFrame(animate);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [animate]);

  // Preload and process images
  useEffect(() => {
    const loadAndProcessImages = async () => {
      setIsLoading(true);
      setLoadError(null);
      const promises = PRESET_IMAGES.map(async (url) => {
        if (imageCache.current.has(url)) return;
        
        try {
          const img = new Image();
          await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = () => reject(new Error(`Failed to load ${url}`));
            img.src = url;
          });
          const canvas = document.createElement('canvas');
          canvas.width = 512; canvas.height = 512;
          const ctx = canvas.getContext('2d')!;
          ctx.drawImage(img, 0, 0, 512, 512);
          imageCache.current.set(url, canvas);
        } catch (err) {
          console.error(`Error loading ${url}:`, err);
          setLoadError(prev => prev ? `${prev}, ${url}` : `Failed to load: ${url}`);
        }
      });
      await Promise.all(promises);
      setIsLoading(false);
    };
    loadAndProcessImages();
  }, []);

  const updateLayer = (index: number | null, updates: Partial<LayerState>) => {
    if (index === null) return;
    setLayers(prev => {
      if (index < 0 || index >= prev.length) return prev;
      const next = [...prev];
      next[index] = { ...next[index], ...updates };
      return next;
    });
  };

  const addTextLayer = () => {
    const newLayer: LayerState = {
      id: `layer-${Date.now()}`,
      name: 'Text Layer',
      type: 'text',
      url: null,
      text: 'NEW TEXT',
      fontSize: 80,
      scale: 1,
      rotation: 0,
      x: 256,
      y: 256,
      color: isLightMode ? '#000000' : '#FFFFFF',
      hue: 0,
      noise: 0.15,
      noiseMode: 'chrome',
      visible: true,
      opacity: 1,
      isLocked: false,
      isSelected: true,
    };
    setLayers(prev => [...prev, newLayer]);
    setActiveLayerIdx(layers.length);
  };

  useEffect(() => {
    PRESET_IMAGES.forEach(url => {
      if (!imageCache.current.has(url)) {
        const img = new Image();
        img.src = url;
        img.onload = () => imageCache.current.set(url, img);
      }
    });
    PRESET_CAPS_MEME.forEach(preset => {
      if (!imageCache.current.has(preset.url)) {
        const img = new Image();
        img.src = preset.url;
        img.onload = () => imageCache.current.set(preset.url, img);
      }
    });
  }, []);

  const addCap = async (presetColors?: string[], initialPos?: { x: number, y: number }, initialScale?: number, initialRotation?: number, presetUrl?: string, forceGenerate?: boolean) => {
    const baseId = `cap-${Date.now()}`;
    
    // Replacement logic: if a cap is selected, replace it
    let replaceGroupId: string | null = null;
    let inheritedProps = {
      x: initialPos?.x || 512,
      y: initialPos?.y || 512,
      scale: initialScale || 0.5,
      rotation: initialRotation || 0
    };

    if (!forceGenerate && activeLayerIdx !== null && layers[activeLayerIdx]) {
      const activeLayer = layers[activeLayerIdx];
      if (activeLayer.groupId) {
        replaceGroupId = activeLayer.groupId;
        
        // Find if the active layer was a preset and get its adjustments to normalize
        const currentPresets = mode === 'memes' ? PRESET_CAPS_MEME : PRESET_CAPS;
        const activePreset = currentPresets.find(p => p.url === activeLayer.url);
        const activeScaleAdj = activePreset?.scaleAdj || 1.0;
        const activeYAdj = activePreset?.yAdj || 0;

        // Inherit properties from the layer being replaced, but normalize them first
        inheritedProps = {
          x: activeLayer.x,
          y: activeLayer.y - (activeYAdj * (activeLayer.scale / activeScaleAdj)),
          scale: activeLayer.scale / activeScaleAdj,
          rotation: activeLayer.rotation
        };
      }
    }

    if (presetUrl) {
      const currentPresets = mode === 'memes' ? PRESET_CAPS_MEME : PRESET_CAPS;
      const preset = currentPresets.find(p => p.url === presetUrl);
      const scaleAdj = preset?.scaleAdj || 1.0;
      const yAdj = preset?.yAdj || 0;

      // Ensure image is in cache
      if (!imageCache.current.has(presetUrl)) {
        try {
          const img = new Image();
          img.src = presetUrl;
          await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
          });
          imageCache.current.set(presetUrl, img);
        } catch (err) {
          console.error("Failed to load preset image:", err);
        }
      }

      const newLayer: LayerState = {
        id: `${baseId}-single`,
        groupId: baseId,
        name: `Cap ${layers.length + 1}`,
        type: 'image',
        url: presetUrl,
        text: '',
        fontSize: 160,
        scale: inheritedProps.scale * scaleAdj,
        rotation: inheritedProps.rotation,
        x: inheritedProps.x,
        y: inheritedProps.y + (yAdj * inheritedProps.scale),
        color: (preset as any)?.color || '#FFFFFF',
        hue: 0,
        noise: 0.15,
        noiseMode: 'chrome',
        visible: true,
        opacity: 1,
        isLocked: false,
        isSelected: true,
        useOriginalColor: (preset as any)?.useOriginalColor !== undefined ? (preset as any).useOriginalColor : true,
      };

      if (replaceGroupId) {
        setLayers(prev => {
          const filtered = prev.filter(l => l.groupId !== replaceGroupId);
          return [...filtered, newLayer];
        });
        setActiveLayerIdx(layers.filter(l => l.groupId !== replaceGroupId).length);
      } else {
        setLayers(prev => [...prev, newLayer]);
        setActiveLayerIdx(layers.length);
      }
      return;
    }

    // Pre-load PRESET_IMAGES if not in cache
    for (const url of PRESET_IMAGES) {
      if (!imageCache.current.has(url)) {
        try {
          const img = new Image();
          img.src = url;
          await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
          });
          imageCache.current.set(url, img);
        } catch (err) {
          console.error("Failed to load preset part:", err);
        }
      }
    }

    const palette = presetColors || getCapPalette();
    // Order: Cap (2) -> Logo (1) -> Outline (0)
    // We store them in this order, and draw them in reverse (Outline first)
    const newLayers: LayerState[] = [2, 1, 0].map((presetIdx, i) => ({
      id: `${baseId}-${presetIdx}`,
      groupId: baseId,
      name: `${LAYER_NAMES[presetIdx]} ${layers.length / 3 + 1}`,
      type: 'image',
      url: PRESET_IMAGES[presetIdx],
      text: '',
      fontSize: 160,
      scale: inheritedProps.scale,
      rotation: inheritedProps.rotation,
      x: inheritedProps.x,
      y: inheritedProps.y,
      color: palette[i % palette.length],
      hue: 0,
      noise: 0.15,
      noiseMode: 'chrome',
      visible: true,
      opacity: 1,
      isLocked: false,
      isSelected: true,
      useOriginalColor: false,
    }));

    if (replaceGroupId) {
      setLayers(prev => {
        const filtered = prev.filter(l => l.groupId !== replaceGroupId);
        return [...filtered, ...newLayers];
      });
      setActiveLayerIdx(layers.filter(l => l.groupId !== replaceGroupId).length + 2);
    } else {
      setLayers(prev => [...prev, ...newLayers]);
      setActiveLayerIdx(layers.length + 2);
    }
  };

  const deleteLayer = (index: number) => {
    if (!layers[index]) return;
    if (layers[index].type === 'image') return; // Don't delete preset images
    setLayers(prev => prev.filter((_, i) => i !== index));
    setActiveLayerIdx(null);
  };

  const handleFileUpload = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 512;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, 512, 512);
        imageCache.current.set(url, canvas);
        updateLayer(index, { url });
      };
      img.src = url;
    }
  };

  const selectAll = (selected: boolean) => {
    setLayers(prev => prev.map(l => ({ ...l, isSelected: selected })));
  };

  const randomizeAll = () => {
    let availableColors: string[] = [];
    
    if (randomizePalettes) {
      // Collect all colors from all themes
      const allThemeColors = THEMES.flatMap(t => t.colors);
      availableColors = Array.from(new Set([...allThemeColors, ...DEFAULT_COLORS]));
    } else {
      // Get unique colors from the default list
      availableColors = Array.from(new Set(DEFAULT_COLORS));
    }
    
    // Shuffle
    for (let i = availableColors.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [availableColors[i], availableColors[j]] = [availableColors[j], availableColors[i]];
    }

    setLayers(prev => {
      let colorIdx = 0;
      return prev.map((layer) => {
        if (!layer.isSelected || layer.isLocked) return layer;
        
        // Pick a unique color if possible
        const newColor = availableColors[colorIdx % availableColors.length];
        colorIdx++;
        
        return {
          ...layer,
          color: newColor,
          hue: Math.floor(Math.random() * 360),
          noise: maxNoiseEnabled ? Math.random() * 2.0 : 0.05 + Math.random() * 0.3,
          noiseMode: Math.random() > 0.5 ? 'color' : 'chrome',
        };
      });
    });
  };

  const applyTheme = () => {
    const theme = THEMES[currentThemeIdx];
    setLayers(prev => {
      let colorIdx = 0;
      return prev.map((layer) => {
        if (!layer.isSelected || layer.isLocked) return layer;
        const newColor = theme.colors[colorIdx % theme.colors.length];
        colorIdx++;
        return { ...layer, color: newColor };
      });
    });
    setCurrentThemeIdx(prev => (prev + 1) % THEMES.length);
  };

  const handleMemeUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !modelsLoaded) return;

    setIsProcessingFaces(true);
    const url = URL.createObjectURL(file);
    setMemeImage(url);

    const img = new Image();
    img.src = url;
    await new Promise((resolve) => (img.onload = resolve));
    memeImgRef.current = img;
    setMemeAspectRatio(img.width / img.height);

    // Detect faces
    const detections = await faceapi.detectAllFaces(img, new faceapi.TinyFaceDetectorOptions({ inputSize: 512, scoreThreshold: 0.3 })).withFaceLandmarks();

    const canvasSize = 1024;
    const canvasRatio = 1;
    const imgRatio = img.width / img.height;
    
    let drawW, drawH, drawX, drawY;
    if (imgRatio > canvasRatio) {
      drawW = canvasSize;
      drawH = canvasSize / imgRatio;
      drawX = 0;
      drawY = (canvasSize - drawH) / 2;
    } else {
      drawH = canvasSize;
      drawW = canvasSize * imgRatio;
      drawX = (canvasSize - drawW) / 2;
      drawY = 0;
    }

    const newLayers: LayerState[] = [];
    
    detections.forEach((det, i) => {
      const box = det.detection.box;
      const landmarks = det.landmarks;
      
      // Calculate rotation from eyes
      const leftEye = landmarks.getLeftEye();
      const rightEye = landmarks.getRightEye();
      
      const leftEyeCenter = leftEye.reduce((acc, p) => ({ x: acc.x + p.x / 6, y: acc.y + p.y / 6 }), { x: 0, y: 0 });
      const rightEyeCenter = rightEye.reduce((acc, p) => ({ x: acc.x + p.x / 6, y: acc.y + p.y / 6 }), { x: 0, y: 0 });
      
      const angle = Math.atan2(rightEyeCenter.y - leftEyeCenter.y, rightEyeCenter.x - leftEyeCenter.x) * (180 / Math.PI);

      // Map image coordinates to canvas coordinates
      const centerX = drawX + ((box.x + box.width / 2) / img.width) * drawW;
      const centerY = drawY + ((box.y - (box.height * 0.15)) / img.height) * drawH;
      
      const faceWidthOnCanvas = (box.width / img.width) * drawW;

      // Create a cap for this face
      const palette = getCapPalette();
      const baseId = `meme-cap-${Date.now()}-${i}`;
      
          // Add the 3 layers for this cap
          [2, 1, 0].forEach((presetIdx, paletteIdx) => {
            newLayers.push({
              id: `${baseId}-${presetIdx}`,
              groupId: baseId,
              name: `${LAYER_NAMES[presetIdx]} ${i + 1}`,
              type: 'image',
              url: PRESET_IMAGES[presetIdx],
              text: '',
              fontSize: 160,
              scale: (faceWidthOnCanvas / 1024) * 1.1, // Reduced scale as requested
              rotation: angle, 
              x: centerX,
              y: centerY,
              color: palette[paletteIdx % palette.length],
              hue: 0,
              noise: 0.15,
              noiseMode: 'chrome',
              visible: true,
              opacity: 1,
              isLocked: false,
              isSelected: true,
            });
          });
    });

    if (newLayers.length === 0 && window.innerWidth >= 1024) {
    
    }

    setLayers(newLayers);
    setIsProcessingFaces(false);
  };

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || isLoading) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    if (!offCanvasRef.current) {
      offCanvasRef.current = document.createElement('canvas');
      offCanvasRef.current.width = canvas.width;
      offCanvasRef.current.height = canvas.height;
    }
    const offCanvas = offCanvasRef.current;
    const offCtx = offCanvas.getContext('2d')!;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (mode === 'memes' && memeImgRef.current) {
      const img = memeImgRef.current;
      const canvasRatio = canvas.width / canvas.height;
      const imgRatio = img.width / img.height;
      
      let drawW, drawH, drawX, drawY;
      
      if (imgRatio > canvasRatio) {
        drawW = canvas.width;
        drawH = canvas.width / imgRatio;
        drawX = 0;
        drawY = (canvas.height - drawH) / 2;
      } else {
        drawH = canvas.height;
        drawW = canvas.height * imgRatio;
        drawX = (canvas.width - drawW) / 2;
        drawY = 0;
      }
      
      ctx.drawImage(img, drawX, drawY, drawW, drawH);
    } else if (bgEnabled) {
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // Draw Image Layers first (bottom to top based on array order)
    const imageLayers = layers.filter(l => l.type === 'image');
    const textLayers = layers.filter(l => l.type === 'text');

    const renderLayer = (layer: LayerState) => {
      if (!layer.visible) return;

      offCtx.clearRect(0, 0, offCanvas.width, offCanvas.height);

      if (layer.type === 'image' && layer.url) {
        const img = imageCache.current.get(layer.url);
        if (!img) return;
        
        offCtx.save();
        offCtx.translate(layer.x, layer.y);
        offCtx.rotate((layer.rotation * Math.PI) / 180);
        if (layer.flipX) {
          offCtx.scale(-1, 1);
        }

        if (layer.hue !== 0) {
          offCtx.filter = `hue-rotate(${layer.hue}deg)`;
        }
        
        const w = offCanvas.width * layer.scale;
        const h = offCanvas.height * layer.scale;
        
        offCtx.drawImage(img, -w / 2, -h / 2, w, h);
        offCtx.filter = 'none';

        if (!layer.useOriginalColor) {
          offCtx.globalCompositeOperation = 'source-in';
          offCtx.fillStyle = layer.color;
          offCtx.fillRect(-w / 2, -h / 2, w, h);
          offCtx.globalCompositeOperation = 'source-over';
        }
        
        offCtx.restore();
      } else if (layer.type === 'text') {
        offCtx.save();
        offCtx.translate(layer.x, layer.y);
        offCtx.rotate((layer.rotation * Math.PI) / 180);
        if (layer.flipX) {
          offCtx.scale(-1, 1);
        }
        offCtx.scale(layer.scale, layer.scale);
        offCtx.fillStyle = layer.color;
        offCtx.font = `bold ${layer.fontSize}px sans-serif`;
        offCtx.textAlign = 'center';
        offCtx.textBaseline = 'middle';
        
        const lines = layer.text.split('\n');
        const lineHeight = layer.fontSize * 1.2;
        
        lines.forEach((line, i) => {
          const yOffset = (i - (lines.length - 1) / 2) * lineHeight;
          offCtx.fillText(line, 0, yOffset);
        });
        
        offCtx.restore();
      }

      if (layer.noise > 0) {
        const noiseData = offCtx.getImageData(0, 0, offCanvas.width, offCanvas.height);
        const d = noiseData.data;
        
        for (let j = 0; j < d.length; j += 4) {
          if (d[j+3] > 0) {
            if (layer.noiseMode === 'color') {
              const r = (Math.random() - 0.5) * layer.noise * 255;
              const g = (Math.random() - 0.5) * layer.noise * 255;
              const b = (Math.random() - 0.5) * layer.noise * 255;
              d[j] = Math.max(0, Math.min(255, d[j] + r));
              d[j+1] = Math.max(0, Math.min(255, d[j+1] + g));
              d[j+2] = Math.max(0, Math.min(255, d[j+2] + b));
            } else {
              const n = (Math.random() - 0.5) * layer.noise * 255;
              d[j] = Math.max(0, Math.min(255, d[j] + n));
              d[j+1] = Math.max(0, Math.min(255, d[j+1] + n));
              d[j+2] = Math.max(0, Math.min(255, d[j+2] + n));
            }
          }
        }
        offCtx.putImageData(noiseData, 0, 0);
      }

      ctx.globalAlpha = layer.opacity;
      ctx.drawImage(offCanvas, 0, 0);
      ctx.globalAlpha = 1.0;
    };

    // Draw images from back to front (Outline -> Logo -> Cap)
    [...imageLayers].reverse().forEach(renderLayer);
    
    // Draw text on top
    textLayers.forEach(renderLayer);

    // Draw selection box and handles for active layer
    if (activeLayerIdx !== null && layers[activeLayerIdx]) {
      const layer = layers[activeLayerIdx];
      if (layer.visible) {
        ctx.save();
        ctx.translate(layer.x, layer.y);
        ctx.rotate((layer.rotation * Math.PI) / 180);
        
        let w, h;
        if (layer.type === 'text') {
          ctx.font = `bold ${layer.fontSize}px sans-serif`;
          const lines = layer.text.split('\n');
          const maxLineWidth = Math.max(...lines.map(line => ctx.measureText(line).width));
          const lineHeight = layer.fontSize * 1.2;
          w = (maxLineWidth + 40) * layer.scale;
          h = (lines.length * lineHeight + 40) * layer.scale;
        } else {
          const size = 1024;
          w = size * layer.scale;
          h = size * layer.scale;
        }
        
        ctx.strokeStyle = '#39FF14';
        ctx.lineWidth = 2;
        ctx.setLineDash([8, 8]);
        ctx.strokeRect(-w / 2, -h / 2, w, h);
        
        ctx.setLineDash([]);
        
        // Resize handles (all 4 corners)
        const corners = [
          { x: w / 2, y: h / 2 },
          { x: -w / 2, y: -h / 2 },
          { x: w / 2, y: -h / 2 },
          { x: -w / 2, y: h / 2 }
        ];

        ctx.fillStyle = '#39FF14';
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2;

        corners.forEach(corner => {
          ctx.beginPath();
          ctx.arc(corner.x, corner.y, 12, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        });
        
        // Rotate handle
        let handlePos = -h / 2 - 60;
        if (layer.y + handlePos < 60) {
          handlePos = h / 2 + 60;
        }
        if (layer.y + handlePos > 964) {
          handlePos = -h / 2 - 60;
        }

        ctx.beginPath();
        ctx.moveTo(0, handlePos > 0 ? h / 2 : -h / 2);
        ctx.lineTo(0, handlePos);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, handlePos, 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        
        ctx.restore();
      }
    }
  }, [layers, isLoading, noiseSeed, activeLayerIdx, mode, memeImage, bgEnabled, bgColor, isAnimating, isLightMode]);

  useEffect(() => {
    draw();
  }, [draw]);

  const downloadImage = (scale: number = 1) => {
    const size = 1024 * scale;
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = size;
    exportCanvas.height = size;
    const ctx = exportCanvas.getContext('2d')!;
    
    const offCanvas = document.createElement('canvas');
    offCanvas.width = size;
    offCanvas.height = size;
    const offCtx = offCanvas.getContext('2d')!;

    if (mode === 'memes' && memeImgRef.current) {
      const img = memeImgRef.current;
      const canvasRatio = 1;
      const imgRatio = img.width / img.height;
      
      let drawW, drawH, drawX, drawY;
      if (imgRatio > canvasRatio) {
        drawW = size;
        drawH = size / imgRatio;
        drawX = 0;
        drawY = (size - drawH) / 2;
      } else {
        drawH = size;
        drawW = size * imgRatio;
        drawX = (size - drawW) / 2;
        drawY = 0;
      }
      ctx.drawImage(img, drawX, drawY, drawW, drawH);
    } else if (bgEnabled) {
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, size, size);
    }

    const imageLayers = layers.filter(l => l.type === 'image');
    const textLayers = layers.filter(l => l.type === 'text');

    const renderLayer = (layer: LayerState) => {
      if (!layer.visible) return;

      offCtx.clearRect(0, 0, size, size);

      if (layer.type === 'image' && layer.url) {
        const img = imageCache.current.get(layer.url);
        if (!img) return;
        
        offCtx.save();
        offCtx.translate(layer.x * scale, layer.y * scale);
        offCtx.rotate((layer.rotation * Math.PI) / 180);
        if (layer.flipX) {
          offCtx.scale(-1, 1);
        }

        if (layer.hue !== 0) {
          offCtx.filter = `hue-rotate(${layer.hue}deg)`;
        }
        
        const w = size * layer.scale;
        const h = size * layer.scale;
        
        offCtx.drawImage(img, -w / 2, -h / 2, w, h);
        offCtx.filter = 'none';

        if (!layer.useOriginalColor) {
          offCtx.globalCompositeOperation = 'source-in';
          offCtx.fillStyle = layer.color;
          offCtx.fillRect(-w / 2, -h / 2, w, h);
          offCtx.globalCompositeOperation = 'source-over';
        }

        offCtx.restore();
      } else if (layer.type === 'text') {
        offCtx.save();
        offCtx.translate(layer.x * scale, layer.y * scale);
        offCtx.rotate((layer.rotation * Math.PI) / 180);
        if (layer.flipX) {
          offCtx.scale(-1, 1);
        }
        offCtx.scale(layer.scale, layer.scale);
        offCtx.fillStyle = layer.color;
        offCtx.font = `bold ${layer.fontSize * scale}px sans-serif`;
        offCtx.textAlign = 'center';
        offCtx.textBaseline = 'middle';
        offCtx.fillText(layer.text, 0, 0);
        offCtx.restore();
      }

      if (layer.noise > 0) {
        const noiseData = offCtx.getImageData(0, 0, size, size);
        const d = noiseData.data;
        for (let j = 0; j < d.length; j += 4) {
          if (d[j+3] > 0) {
            const n = (Math.random() - 0.5) * layer.noise * 255;
            d[j] = Math.max(0, Math.min(255, d[j] + n));
            d[j+1] = Math.max(0, Math.min(255, d[j+1] + n));
            d[j+2] = Math.max(0, Math.min(255, d[j+2] + n));
          }
        }
        offCtx.putImageData(noiseData, 0, 0);
      }

      ctx.globalAlpha = layer.opacity;
      ctx.drawImage(offCanvas, 0, 0);
      ctx.globalAlpha = 1.0;
    };

    [...imageLayers].reverse().forEach(renderLayer);
    textLayers.forEach(renderLayer);

    const link = document.createElement('a');
    link.download = `m-cap-${scale > 1 ? 'hd-' : ''}export-${Date.now()}.png`;
    link.href = exportCanvas.toDataURL('image/png', 1.0);
    link.click();
  };

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const mouseX = (e.clientX - rect.left) * scaleX;
    const mouseY = (e.clientY - rect.top) * scaleY;

    // Check if we clicked on a handle of the active layer
    if (activeLayerIdx !== null && layers[activeLayerIdx]) {
      const layer = layers[activeLayerIdx];
      
      let w, h;
      if (layer.type === 'text') {
        const canvas = canvasRef.current!;
        const ctx = canvas.getContext('2d')!;
        ctx.font = `bold ${layer.fontSize}px sans-serif`;
        const lines = layer.text.split('\n');
        const maxLineWidth = Math.max(...lines.map(line => ctx.measureText(line).width));
        const lineHeight = layer.fontSize * 1.2;
        w = (maxLineWidth + 40) * layer.scale;
        h = (lines.length * lineHeight + 40) * layer.scale;
      } else {
        const size = 1024;
        w = size * layer.scale;
        h = size * layer.scale;
      }
      
      // Calculate handle positions
      const cos = Math.cos((layer.rotation * Math.PI) / 180);
      const sin = Math.sin((layer.rotation * Math.PI) / 180);
      
      // Resize handles (all 4 corners)
      const corners = [
        { x: w / 2, y: h / 2 },
        { x: -w / 2, y: -h / 2 },
        { x: w / 2, y: -h / 2 },
        { x: -w / 2, y: h / 2 }
      ];

      let isResizing = false;
      for (const corner of corners) {
        const rx = layer.x + corner.x * cos - corner.y * sin;
        const ry = layer.y + corner.x * sin + corner.y * cos;
        const dist = Math.sqrt((mouseX - rx) ** 2 + (mouseY - ry) ** 2);
        if (dist < 40) {
          isResizing = true;
          break;
        }
      }
      
      if (isResizing) {
        setInteractionMode('resize');
        setInitialMousePos({ x: mouseX, y: mouseY });
        setInitialLayerState({ ...layer });
        setIsDragging(true);
        return;
      }
      
      // Rotate handle
      let handlePos = -h / 2 - 60;
      if (layer.y + handlePos < 60) {
        handlePos = h / 2 + 60;
      }
      if (layer.y + handlePos > 964) {
        handlePos = -h / 2 - 60;
      }
      
      const dist = Math.abs(handlePos);
      const tx = layer.x + dist * (handlePos > 0 ? -sin : sin);
      const ty = layer.y + dist * (handlePos > 0 ? cos : -cos);
      const distRotate = Math.sqrt((mouseX - tx) ** 2 + (mouseY - ty) ** 2);
      
      if (distRotate < 40) {
        setInteractionMode('rotate');
        setInitialMousePos({ x: mouseX, y: mouseY });
        setInitialLayerState({ ...layer });
        setIsDragging(true);
        return;
      }
    }

    // Find the topmost layer that was clicked (iterate backwards)
    let foundIdx = -1;
    for (let i = layers.length - 1; i >= 0; i--) {
      const layer = layers[i];
      if (!layer.visible || layer.isLocked) continue;

      if (layer.type === 'text') {
        const canvas = canvasRef.current!;
        const ctx = canvas.getContext('2d')!;
        ctx.font = `bold ${layer.fontSize}px sans-serif`;
        const lines = layer.text.split('\n');
        const maxLineWidth = Math.max(...lines.map(line => ctx.measureText(line).width));
        const lineHeight = layer.fontSize * 1.2;
        const w = (maxLineWidth + 40) * layer.scale;
        const h = (lines.length * lineHeight + 40) * layer.scale;
        
        const dx = mouseX - layer.x;
        const dy = mouseY - layer.y;
        const cos = Math.cos((-layer.rotation * Math.PI) / 180);
        const sin = Math.sin((-layer.rotation * Math.PI) / 180);
        const localX = dx * cos - dy * sin;
        const localY = dx * sin + dy * cos;
        
        if (Math.abs(localX) < w / 2 && Math.abs(localY) < h / 2) {
          foundIdx = i;
          break;
        }
      } else if (layer.type === 'image') {
        const dist = Math.sqrt((mouseX - layer.x) ** 2 + (mouseY - layer.y) ** 2);
        // Approximate hit area for image layers
        if (dist < 200 * layer.scale) {
          foundIdx = i;
          break;
        }
      }
    }

    if (foundIdx !== -1) {
      setActiveLayerIdx(foundIdx);
      setIsDragging(true);
      setInteractionMode('drag');
      setDragOffset({ x: mouseX - layers[foundIdx].x, y: mouseY - layers[foundIdx].y });
    } else {
      setActiveLayerIdx(null);
      setInteractionMode(null);
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging || activeLayerIdx === null) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const mouseX = (e.clientX - rect.left) * scaleX;
    const mouseY = (e.clientY - rect.top) * scaleY;

    if (interactionMode === 'drag' && activeLayerIdx !== null && layers[activeLayerIdx]) {
      const newX = mouseX - dragOffset.x;
      const newY = mouseY - dragOffset.y;
      const layer = layers[activeLayerIdx];
      if (layer.groupId) {
        setLayers(prev => prev.map(l => l.groupId === layer.groupId ? { ...l, x: newX, y: newY } : l));
      } else {
        updateLayer(activeLayerIdx, { x: newX, y: newY });
      }
    } else if (interactionMode === 'resize' && initialLayerState) {
      const dx = mouseX - initialLayerState.x;
      const dy = mouseY - initialLayerState.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const initialDist = Math.sqrt((initialMousePos.x - initialLayerState.x) ** 2 + (initialMousePos.y - initialLayerState.y) ** 2);
      const scaleFactor = dist / initialDist;
      const newScale = Math.max(0.01, Math.min(5, initialLayerState.scale * scaleFactor));
      
      if (initialLayerState.groupId) {
        setLayers(prev => prev.map(l => l.groupId === initialLayerState.groupId ? { ...l, scale: newScale } : l));
      } else {
        updateLayer(activeLayerIdx, { scale: newScale });
      }
    } else if (interactionMode === 'rotate' && initialLayerState) {
      const angle = Math.atan2(mouseY - initialLayerState.y, mouseX - initialLayerState.x) * (180 / Math.PI);
      const initialAngle = Math.atan2(initialMousePos.y - initialLayerState.y, initialMousePos.x - initialLayerState.x) * (180 / Math.PI);
      const deltaAngle = angle - initialAngle;
      let newRotation = initialLayerState.rotation + deltaAngle;
      
      while (newRotation > 180) newRotation -= 360;
      while (newRotation < -180) newRotation += 360;

      if (initialLayerState.groupId) {
        setLayers(prev => prev.map(l => l.groupId === initialLayerState.groupId ? { ...l, rotation: newRotation } : l));
      } else {
        updateLayer(activeLayerIdx, { rotation: newRotation });
      }
    }
  };

  const handleCanvasMouseUp = () => {
    setIsDragging(false);
    setInteractionMode(null);
    setInitialLayerState(null);
  };

  const handleCanvasWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    // Wheel resizing disabled as requested, replaced by size bar
  };

  return (
    <div className={`min-h-screen font-sans flex flex-col items-center selection:bg-neon-green selection:text-black transition-colors duration-500 ${isLightMode ? 'bg-[#F0F0F2] text-black' : 'bg-[#050505] text-white'}`}>
      
      {/* Header Bar */}
      <div className={`w-full max-w-6xl mt-8 flex items-center justify-between backdrop-blur-md px-8 py-4 rounded-2xl border ${isLightMode ? 'bg-white/80 border-black/5' : 'bg-black/40 border-white/5'}`}>
        <div className="flex flex-col">
          <h1 className={`text-[12px] lg:text-[14px] font-black tracking-[0.4em] uppercase transition-all duration-300 ${isLightMode ? 'text-black' : 'text-neon-green'}`}>
            M CAP LABS
          </h1>
          <div className="flex items-center gap-3 mt-1">
            <button 
              onClick={() => setMode('labs')}
              className={`text-[8px] lg:text-[6px] tracking-widest uppercase transition-all ${mode === 'labs' ? (isLightMode ? 'text-black opacity-100' : 'text-white opacity-100') : (isLightMode ? 'text-black/40' : 'text-white/20')}`}
            >
              CAP ENGINE
            </button>
            <div className={`h-2 w-[1px] ${isLightMode ? 'bg-black/10' : 'bg-white/10'}`} />
            <button 
              onClick={() => setMode('memes')}
              className={`text-[8px] lg:text-[6px] tracking-widest uppercase transition-all ${mode === 'memes' ? (isLightMode ? 'text-black opacity-100' : 'text-white opacity-100') : (isLightMode ? 'text-black/40' : 'text-white/20')}`}
            >
              MEME ENGINE
            </button>
          </div>
        </div>
        
        {/* Desktop Controls */}
        <div className="hidden lg:flex items-center gap-2">
          {mode === 'memes' && (
            <button 
              onClick={addCap}
              className={`p-2 rounded-full transition-all border ${isLightMode ? 'bg-black/5 text-black border-black/10 hover:bg-black/20' : 'bg-white/5 text-[#A855F7] border-[#A855F7]/20 hover:bg-[#A855F7]/20'}`}
              title="Add Cap"
            >
              <ImageIcon size={16} />
            </button>
          )}
          <button 
            onClick={addTextLayer}
            className={`p-2 rounded-full transition-all border ${isLightMode ? 'bg-black/5 text-black border-black/10 hover:bg-black/20' : 'bg-white/5 text-neon-green border-neon-green/20 hover:bg-neon-green/20'}`}
            title="Add Text"
          >
            <Type size={16} />
          </button>
          <button 
            onClick={applyTheme}
            className={`p-2 rounded-full transition-all border ${isLightMode ? 'bg-black/5 text-black border-black/10 hover:bg-black/20' : 'bg-white/5 text-neon-green border-neon-green/20 hover:bg-neon-green/20'}`}
            title={`Apply ${THEMES[currentThemeIdx].name} Palette`}
          >
            <span className="w-4 h-4 flex items-center justify-center text-[10px] font-black leading-none">{THEMES[currentThemeIdx].name.charAt(0)}</span>
          </button>
          <button 
            onClick={() => setMaxNoiseEnabled(!maxNoiseEnabled)}
            className={`p-2 rounded-full transition-all border ${maxNoiseEnabled ? (isLightMode ? 'bg-black text-white border-black' : 'bg-neon-green/20 text-neon-green border-neon-green/40') : (isLightMode ? 'bg-black/5 text-black border-black/10 hover:bg-black/20' : 'bg-white/5 text-white/40 border-white/10')}`}
            title="Toggle Max Noise Randomization"
          >
            <Activity size={16} />
          </button>
          <button 
            onClick={() => setRandomizePalettes(!randomizePalettes)}
            className={`p-2 rounded-full transition-all border ${randomizePalettes ? (isLightMode ? 'bg-black text-white border-black' : 'bg-neon-green/20 text-neon-green border-neon-green/40') : (isLightMode ? 'bg-black/5 text-black border-black/10 hover:bg-black/20' : 'bg-white/5 text-white/40 border-white/10')}`}
            title="Include All Palettes in Randomization"
          >
            <Palette size={16} />
          </button>
          <button 
            onClick={randomizeAll} 
            className={`p-2 rounded-full transition-all border ${isLightMode ? 'bg-black/5 text-black border-black/10 hover:bg-black/20' : 'bg-white/5 text-neon-green border-neon-green/20 hover:bg-neon-green/20'}`}
            title="Randomize"
          >
            <Recycle size={16} />
          </button>
          <button 
            onClick={() => setIsLightMode(!isLightMode)}
            className={`p-2 rounded-full transition-all border ${isLightMode ? 'bg-black/5 text-black border-black/10 hover:bg-black/20' : 'bg-white/5 text-neon-green border-neon-green/20 hover:bg-neon-green/20'}`}
            title={isLightMode ? "Dark Mode" : "Light Mode"}
          >
            {isLightMode ? <Moon size={16} /> : <Sun size={16} />}
          </button>
          <button 
            onClick={() => downloadImage(1)} 
            className={`p-2 rounded-lg transition-all border ${isLightMode ? 'bg-black text-white hover:bg-black/80 border-black' : 'bg-white text-black hover:bg-white/80 border-white'}`}
            title="Save PNG (512px)"
          >
            <FileDown size={16} />
          </button>
          <button 
            onClick={() => downloadImage(4)} 
            className={`p-2 rounded-lg transition-all border ${isLightMode ? 'bg-black text-white hover:bg-black/80 border-black' : 'bg-white text-black hover:bg-white/80 border-white'}`}
            title="Save HD PNG (2048px)"
          >
            <Sparkles size={16} />
          </button>
        </div>

        {/* Mobile Quick Actions */}
        <div className="lg:hidden flex items-center gap-2">
          <button 
            onClick={() => setIsLightMode(!isLightMode)}
            className={`p-2 rounded-full transition-all border ${isLightMode ? 'bg-black/5 text-black border-black/10' : 'bg-white/5 text-neon-green border-neon-green/20'}`}
          >
            {isLightMode ? <Moon size={14} /> : <Sun size={14} />}
          </button>
          <button 
            onClick={() => downloadImage(1)} 
            className={`p-2 rounded-lg transition-all border ${isLightMode ? 'bg-black text-white border-black' : 'bg-white text-black border-white'}`}
          >
            <FileDown size={14} />
          </button>
        </div>
      </div>

      {/* Main Layout */}
      <main className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-12 gap-8 p-4 lg:p-8">
        
        {/* Left: Controls Area */}
        <div className="lg:col-span-5 space-y-4 overflow-y-auto max-h-[70vh] pr-2 custom-scrollbar order-2 lg:order-1">
          <div className="flex items-center justify-between mb-4">
            <div className="flex flex-col">
              <span className={`text-[12px] font-black tracking-[0.3em] uppercase ${isLightMode ? 'text-black' : 'text-neon-green'}`}>Layer Control</span>
              <div className="flex items-center gap-2 mt-2">
                <button 
                  onClick={() => {
                    const allSelected = layers.length > 0 && layers.every(l => l.isSelected);
                    selectAll(!allSelected);
                  }}
                  className={`p-1.5 rounded transition-all border ${isLightMode ? 'bg-black/5 text-black border-black/10 hover:bg-black/10' : 'bg-white/5 text-white/40 border-white/10 hover:text-neon-green'}`}
                  title="Select / Deselect All"
                >
                  {layers.length > 0 && layers.every(l => l.isSelected) ? <CheckSquare size={12} /> : <Square size={12} />}
                </button>
                <button 
                  onClick={() => {
                    const selectedCount = layers.filter(l => l.isSelected).length;
                    if (selectedCount > 0) {
                      setLayers(prev => prev.map(l => l.isSelected ? { ...l, flipX: !l.flipX } : l));
                    } else if (activeLayerIdx !== null && layers[activeLayerIdx]) {
                      const layer = layers[activeLayerIdx];
                      if (layer.groupId) {
                        setLayers(prev => prev.map(l => l.groupId === layer.groupId ? { ...l, flipX: !l.flipX } : l));
                      } else {
                        updateLayer(activeLayerIdx, { flipX: !layer.flipX });
                      }
                    }
                  }}
                  className={`p-1.5 rounded transition-all border ${isLightMode ? 'bg-black/5 text-black border-black/10 hover:bg-black/10' : 'bg-white/5 text-white/40 border-white/10 hover:text-neon-green'}`}
                  title="Flip Selected"
                >
                  <FlipHorizontal size={12} />
                </button>
                <button 
                  onClick={() => {
                    const selectedLayers = layers.filter(l => l.isSelected);
                    let targetNoise = 0.15;
                    
                    const isNoiseActive = selectedLayers.length > 0 
                      ? selectedLayers.some(l => l.noise > 0)
                      : (activeLayerIdx !== null && layers[activeLayerIdx] 
                          ? (layers[activeLayerIdx].groupId 
                              ? layers.filter(l => l.groupId === layers[activeLayerIdx].groupId).some(l => l.noise > 0)
                              : layers[activeLayerIdx].noise > 0)
                          : false);
                    
                    if (isNoiseActive) targetNoise = 0;

                    if (selectedLayers.length > 0) {
                      setLayers(prev => prev.map(l => l.isSelected ? { ...l, noise: targetNoise } : l));
                    } else if (activeLayerIdx !== null && layers[activeLayerIdx]) {
                      const layer = layers[activeLayerIdx];
                      if (layer.groupId) {
                        setLayers(prev => prev.map(l => l.groupId === layer.groupId ? { ...l, noise: targetNoise } : l));
                      } else {
                        updateLayer(activeLayerIdx, { noise: targetNoise });
                      }
                    }
                  }}
                  className={`p-1.5 rounded transition-all border ${isLightMode ? 'bg-black/5 text-black border-black/10 hover:bg-black/10' : 'bg-white/5 text-white/40 border-white/10 hover:text-neon-green'}`}
                  title="Toggle Noise"
                >
                  {(() => {
                    const selectedLayers = layers.filter(l => l.isSelected);
                    const isNoiseActive = selectedLayers.length > 0 
                      ? selectedLayers.some(l => l.noise > 0)
                      : (activeLayerIdx !== null && layers[activeLayerIdx] 
                          ? (layers[activeLayerIdx].groupId 
                              ? layers.filter(l => l.groupId === layers[activeLayerIdx].groupId).some(l => l.noise > 0)
                              : layers[activeLayerIdx].noise > 0)
                          : false);
                    return isNoiseActive ? <Zap size={12} /> : <ZapOff size={12} />;
                  })()}
                </button>
              </div>
            </div>
            <span className={`text-[8px] tracking-widest ${isLightMode ? 'text-black' : 'text-white/20'}`}>ADJUST PARAMETERS</span>
          </div>

          {layers.reduce((acc, layer, idx) => {
            // Grouping logic: if it's a cap layer, only show the group header once
            if (layer.groupId) {
              const existingGroup = acc.find(item => item.type === 'group' && item.groupId === layer.groupId);
              if (existingGroup) return acc;
              
              // Find all layers in this group
              const groupLayers = layers.filter(l => l.groupId === layer.groupId);
              const topLayerIdx = layers.findIndex(l => l.id === groupLayers[0].id);
              
              acc.push({
                type: 'group',
                groupId: layer.groupId,
                name: `CAP GROUP ${Math.floor(idx / 3) + 1}`,
                layers: groupLayers,
                topIdx: topLayerIdx
              });
            } else {
              acc.push({
                type: 'single',
                layer,
                idx
              });
            }
            return acc;
          }, [] as any[]).map((item, displayIdx) => {
            if (item.type === 'group') {
              const group = item;
              const isGroupActive = activeLayerIdx !== null && layers[activeLayerIdx] && layers[activeLayerIdx].groupId === group.groupId;
              const mainLayer = group.layers[0]; // Use the first layer for color/icon
              
              return (
                <div 
                  key={group.groupId} 
                  className={`p-4 rounded-xl border transition-all cursor-pointer ${isGroupActive ? (isLightMode ? 'bg-black/5 border-black/20' : 'bg-white/5 border-white/20') : (isLightMode ? 'bg-white border-black/5 hover:border-black/10' : 'bg-black/20 border-white/5 hover:border-white/10')}`}
                  onClick={() => setActiveLayerIdx(isGroupActive ? null : group.topIdx)}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg border overflow-hidden flex items-center justify-center ${isLightMode ? 'bg-black/5 border-black/10' : 'bg-black/40 border-white/10'}`}>
                        <div className="relative w-full h-full flex items-center justify-center">
                          <CapIcon colors={group.layers.map((l: any) => l.color)} size={24} />
                          <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full border border-white/20 flex items-center justify-center bg-black text-[6px] font-bold text-white">
                            3
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold uppercase tracking-widest">{group.name}</span>
                        <div className="flex gap-1 mt-1">
                          {group.layers.map((l: any, i: number) => (
                            <div key={l.id} className="w-2 h-2 rounded-full border border-white/10" style={{ backgroundColor: l.color }} />
                          ))}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                      <button 
                        onClick={() => {
                          const locked = !group.layers[0].isLocked;
                          setLayers(prev => prev.map(l => l.groupId === group.groupId ? { ...l, isLocked: locked } : l));
                        }}
                        className={`transition-colors ${group.layers[0].isLocked ? 'text-neon-green' : (isLightMode ? 'text-black/20 hover:text-black' : 'text-white/20 hover:text-white')}`}
                      >
                        {group.layers[0].isLocked ? <Lock size={14} /> : <Unlock size={14} />}
                      </button>
                      <button 
                        onClick={() => {
                          const visible = !group.layers[0].visible;
                          setLayers(prev => prev.map(l => l.groupId === group.groupId ? { ...l, visible: visible } : l));
                        }}
                        className={`transition-colors ${group.layers[0].visible ? 'text-neon-green' : (isLightMode ? 'text-black/20 hover:text-black' : 'text-white/20 hover:text-white')}`}
                      >
                        {group.layers[0].visible ? <Eye size={14} /> : <EyeOff size={14} />}
                      </button>
                      <button 
                        onClick={() => {
                          setLayers(prev => prev.filter(l => l.groupId !== group.groupId));
                          setActiveLayerIdx(null);
                        }}
                        className={`transition-colors ${isLightMode ? 'text-black/20 hover:text-red-500' : 'text-white/20 hover:text-red-500'}`}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>

                  {isGroupActive && (
                    <div 
                      className={`mt-4 pt-4 border-t space-y-4 animate-in fade-in slide-in-from-top-1 duration-200 ${isLightMode ? 'border-black/5' : 'border-white/5'}`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="space-y-4">
                        <CompactSlider 
                          label="SIZE" 
                          value={mainLayer.scale} 
                          min={0.01} 
                          max={3} 
                          step={0.01} 
                          onChange={(v) => {
                            setLayers(prev => prev.map(l => l.groupId === group.groupId ? { ...l, scale: v } : l));
                          }} 
                          isLightMode={isLightMode} 
                        />
                        <CompactSlider 
                          label="ROT" 
                          value={mainLayer.rotation} 
                          min={-180} 
                          max={180} 
                          step={1} 
                          onChange={(v) => {
                            setLayers(prev => prev.map(l => l.groupId === group.groupId ? { ...l, rotation: v } : l));
                          }} 
                          isLightMode={isLightMode} 
                        />
                        <div className="grid grid-cols-2 gap-4">
                          <CompactSlider 
                            label="X POS" 
                            value={mainLayer.x} 
                            min={0} 
                            max={512} 
                            step={1} 
                            onChange={(v) => {
                              setLayers(prev => prev.map(l => l.groupId === group.groupId ? { ...l, x: v } : l));
                            }} 
                            isLightMode={isLightMode} 
                          />
                          <CompactSlider 
                            label="Y POS" 
                            value={mainLayer.y} 
                            min={0} 
                            max={512} 
                            step={1} 
                            onChange={(v) => {
                              setLayers(prev => prev.map(l => l.groupId === group.groupId ? { ...l, y: v } : l));
                            }} 
                            isLightMode={isLightMode} 
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <span className={`text-[8px] tracking-widest uppercase ${isLightMode ? 'text-black' : 'text-white/20'}`}>Layer Colors</span>
                        <div className="flex gap-4">
                          {group.layers.map((l: any) => (
                            <div key={l.id} className="flex flex-col items-center gap-1">
                              <input 
                                type="color" 
                                value={l.color}
                                onChange={(e) => {
                                  const idx = layers.findIndex(layer => layer.id === l.id);
                                  updateLayer(idx, { color: e.target.value });
                                }}
                                className="w-6 h-6 bg-transparent border-none cursor-pointer rounded-full overflow-hidden"
                              />
                              <span className="text-[6px] opacity-40 uppercase">{l.name.split(' ')[0]}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-4">
                        <CompactSlider 
                          label="OPACITY" 
                          value={mainLayer.opacity} 
                          min={0} 
                          max={1} 
                          onChange={(v) => {
                            setLayers(prev => prev.map(l => l.groupId === group.groupId ? { ...l, opacity: v } : l));
                          }} 
                          isLightMode={isLightMode} 
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            }

            const layer = item.layer;
            const idx = item.idx;
            
            return (
              <div 
                key={layer.id} 
                className={`p-4 rounded-xl border transition-all cursor-pointer ${activeLayerIdx === idx ? (isLightMode ? 'bg-black/5 border-black/20' : 'bg-white/5 border-white/20') : (isLightMode ? 'bg-white border-black/5 hover:border-black/10' : 'bg-black/20 border-white/5 hover:border-white/10')}`}
                onClick={() => setActiveLayerIdx(activeLayerIdx === idx ? null : idx)}
              >
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <input 
                    type="checkbox" 
                    checked={layer.isSelected}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => updateLayer(idx, { isSelected: e.target.checked })}
                    className="w-3 h-3 accent-neon-green"
                  />
                  <div className={`w-10 h-10 rounded-lg border overflow-hidden flex items-center justify-center ${isLightMode ? 'bg-black/5 border-black/10' : 'bg-black/40 border-white/10'}`}>
                    {layer.type === 'image' && layer.url ? (
                      <img 
                        src={layer.url} 
                        alt="" 
                        className="w-full h-full object-contain image-pixelated"
                        style={{ filter: `drop-shadow(0 0 2px ${layer.color})` }}
                      />
                    ) : (
                      <span className={`text-[10px] font-bold ${isLightMode ? 'text-black' : 'text-neon-green'}`}>T</span>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                  <button 
                    onClick={() => updateLayer(idx, { isLocked: !layer.isLocked })}
                    className={`transition-colors ${layer.isLocked ? 'text-neon-green' : (isLightMode ? 'text-black/20 hover:text-black' : 'text-white/20 hover:text-white')}`}
                  >
                    {layer.isLocked ? <Lock size={14} /> : <Unlock size={14} />}
                  </button>
                  <button 
                    onClick={() => updateLayer(idx, { visible: !layer.visible })}
                    className={`transition-colors ${layer.visible ? 'text-neon-green' : (isLightMode ? 'text-black/20 hover:text-black' : 'text-white/20 hover:text-white')}`}
                  >
                    {layer.visible ? <Eye size={14} /> : <EyeOff size={14} />}
                  </button>
                  {layer.type === 'text' && (
                    <button 
                      onClick={() => deleteLayer(idx)}
                      className={`transition-colors ${isLightMode ? 'text-black/20 hover:text-red-500' : 'text-white/20 hover:text-red-500'}`}
                    >
                      <X size={14} />
                    </button>
                  )}
                  {mode === 'memes' && layer.type === 'image' && (
                    <button 
                      onClick={() => {
                        const baseId = layer.id.split('-').slice(0, -1).join('-');
                        setLayers(prev => prev.filter(l => !l.id.startsWith(baseId)));
                        setActiveLayerIdx(null);
                      }}
                      className={`transition-colors ${isLightMode ? 'text-black/20 hover:text-red-500' : 'text-white/20 hover:text-red-500'}`}
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>

              {activeLayerIdx === idx && (
                <div 
                  className={`mt-4 pt-4 border-t space-y-4 animate-in fade-in slide-in-from-top-1 duration-200 ${isLightMode ? 'border-black/5' : 'border-white/5'}`}
                  onClick={(e) => e.stopPropagation()}
                >
                  {layer.type === 'text' && (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <span className={`text-[8px] tracking-widest uppercase ${isLightMode ? 'text-black' : 'text-white/20'}`}>Text Content</span>
                        <textarea 
                          value={layer.text}
                          onChange={(e) => updateLayer(idx, { text: e.target.value })}
                          className={`w-full border rounded px-2 py-1 text-[10px] focus:outline-none focus:border-neon-green resize-none min-h-[60px] ${isLightMode ? 'bg-black/5 border-black/10 text-black' : 'bg-black/40 border-white/10 text-white'}`}
                          placeholder="Enter text... (Shift+Enter for new line)"
                        />
                      </div>
                      <CompactSlider label="SIZE" value={layer.fontSize} min={10} max={200} step={1} onChange={(v) => updateLayer(idx, { fontSize: v })} isLightMode={isLightMode} />
                      <CompactSlider label="ROT" value={layer.rotation} min={-180} max={180} step={1} onChange={(v) => updateLayer(idx, { rotation: v })} isLightMode={isLightMode} />
                      <div className="grid grid-cols-2 gap-4">
                        <CompactSlider label="X POS" value={layer.x} min={0} max={512} step={1} onChange={(v) => updateLayer(idx, { x: v })} isLightMode={isLightMode} />
                        <CompactSlider label="Y POS" value={layer.y} min={0} max={512} step={1} onChange={(v) => updateLayer(idx, { y: v })} isLightMode={isLightMode} />
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <span className={`text-[8px] tracking-widest uppercase ${isLightMode ? 'text-black' : 'text-white/20'}`}>Color</span>
                    <input 
                      type="color" 
                      value={layer.color}
                      onChange={(e) => updateLayer(idx, { color: e.target.value })}
                      className="w-6 h-6 bg-transparent border-none cursor-pointer rounded-full overflow-hidden"
                    />
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className={`text-[8px] tracking-widest uppercase ${isLightMode ? 'text-black' : 'text-white/20'}`}>Noise Mode</span>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => updateLayer(idx, { noiseMode: 'chrome' })}
                          className={`px-2 py-1 rounded text-[8px] font-bold transition-all ${layer.noiseMode === 'chrome' ? 'bg-neon-green text-black' : (isLightMode ? 'bg-black/5 text-black/40' : 'bg-white/5 text-white/40')}`}
                        >
                          CHROME
                        </button>
                        <button 
                          onClick={() => updateLayer(idx, { noiseMode: 'color' })}
                          className={`px-2 py-1 rounded text-[8px] font-bold transition-all ${layer.noiseMode === 'color' ? 'bg-neon-green text-black' : (isLightMode ? 'bg-black/5 text-black/40' : 'bg-white/5 text-white/40')}`}
                        >
                          COLOR
                        </button>
                      </div>
                    </div>
                    {layer.type === 'image' && (
                      <>
                        <CompactSlider label="SIZE" value={layer.scale} min={0.01} max={3} step={0.01} onChange={(v) => updateLayer(idx, { scale: v })} isLightMode={isLightMode} />
                        <CompactSlider label="HUE" value={layer.hue} min={0} max={360} step={1} onChange={(v) => updateLayer(idx, { hue: v })} isLightMode={isLightMode} />
                      </>
                    )}
                    <CompactSlider label="NOISE" value={layer.noise} min={0} max={2} step={0.01} onChange={(v) => updateLayer(idx, { noise: v })} isLightMode={isLightMode} />
                    <CompactSlider label="OPACITY" value={layer.opacity} min={0} max={1} onChange={(v) => updateLayer(idx, { opacity: v })} isLightMode={isLightMode} />
                  </div>
                </div>
              )}
            </div>
          )})}

          <div className={`p-4 rounded-xl border space-y-4 ${isLightMode ? 'bg-white border-black/5' : 'bg-black/20 border-white/5'}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => setBgEnabled(!bgEnabled)}
                  className={`transition-colors ${bgEnabled ? 'text-neon-green' : (isLightMode ? 'text-black hover:opacity-70' : 'text-white/20 hover:text-white')}`}
                >
                  {bgEnabled ? <CheckSquare size={14} /> : <Square size={14} />}
                </button>
                <span className="text-[10px] font-bold uppercase tracking-widest">Background</span>
              </div>
              {bgEnabled && (
                <input 
                  type="color" 
                  value={bgColor}
                  onChange={(e) => setBgColor(e.target.value)}
                  className="w-6 h-6 bg-transparent border-none cursor-pointer rounded-full overflow-hidden"
                />
              )}
            </div>
          </div>

          {mode === 'memes' && (
            <div className="space-y-4 pt-4">
              <div className="flex items-center justify-between">
                <span className={`text-[8px] tracking-widest uppercase ${isLightMode ? 'text-black' : 'text-white/20'}`}>Preset Caps</span>
                <span className={`text-[6px] tracking-widest ${isLightMode ? 'text-black/40' : 'text-white/20'}`}>CLICK TO PLACE ON HEADS // + TO ADD CENTER</span>
              </div>
              <div className="grid grid-cols-4 gap-1">
                {PRESET_CAPS_MEME.map((preset) => (
                  <div key={preset.name} className="relative group">
                    <button
                      onClick={async () => {
                        if (memeImgRef.current && modelsLoaded) {
                          setIsProcessingFaces(true);
                          const detections = await faceapi.detectAllFaces(memeImgRef.current, new faceapi.TinyFaceDetectorOptions({ inputSize: 512, scoreThreshold: 0.3 })).withFaceLandmarks();
                          
                          if (detections.length === 0) {
                            setIsProcessingFaces(false);
                            if (window.innerWidth >= 1024) {
                              alert("No faces detected. Try placing manually!");
                            }
                            return;
                          }

                          const canvasSize = 1024;
                          const canvasRatio = 1;
                          const imgRatio = memeImgRef.current.width / memeImgRef.current.height;
                          
                          let drawW, drawH, drawX, drawY;
                          if (imgRatio > canvasRatio) {
                            drawW = canvasSize;
                            drawH = canvasSize / imgRatio;
                            drawX = 0;
                            drawY = (canvasSize - drawH) / 2;
                          } else {
                            drawH = canvasSize;
                            drawW = canvasSize * imgRatio;
                            drawX = (canvasSize - drawW) / 2;
                            drawY = 0;
                          }

                          // If we are placing presets on heads, we should clear existing meme caps first
                          const filteredLayers = layers.filter(l => !l.groupId?.startsWith('meme-cap-'));

                          // Ensure preset image is in cache
                          if (!imageCache.current.has(preset.url)) {
                            try {
                              const img = new Image();
                              img.src = preset.url;
                              await new Promise((resolve, reject) => {
                                img.onload = resolve;
                                img.onerror = reject;
                              });
                              imageCache.current.set(preset.url, img);
                            } catch (err) {
                              console.error("Failed to load preset image:", err);
                            }
                          }

                          const newMemeLayers: LayerState[] = detections.map((det, i) => {
                            const box = det.detection.box;
                            const landmarks = det.landmarks;
                            const leftEye = landmarks.getLeftEye();
                            const rightEye = landmarks.getRightEye();
                            const leftEyeCenter = leftEye.reduce((acc, p) => ({ x: acc.x + p.x / 6, y: acc.y + p.y / 6 }), { x: 0, y: 0 });
                            const rightEyeCenter = rightEye.reduce((acc, p) => ({ x: acc.x + p.x / 6, y: acc.y + p.y / 6 }), { x: 0, y: 0 });
                            const angle = Math.atan2(rightEyeCenter.y - leftEyeCenter.y, rightEyeCenter.x - leftEyeCenter.x) * (180 / Math.PI);
                            const centerX = drawX + ((box.x + box.width / 2) / memeImgRef.current!.width) * drawW;
                            const centerY = drawY + ((box.y - (box.height * 0.15)) / memeImgRef.current!.height) * drawH;
                            const faceWidthOnCanvas = (box.width / memeImgRef.current!.width) * drawW;
                            
                            const baseId = `meme-cap-${Date.now()}-${i}`;
                            return {
                              id: `${baseId}-single`,
                              groupId: baseId,
                              name: `Cap ${i + 1}`,
                              type: 'image',
                              url: preset.url,
                              text: '',
                              fontSize: 160,
                              scale: (faceWidthOnCanvas / 1024) * 1.1 * (preset.scaleAdj || 1.0),
                              rotation: angle,
                              x: centerX,
                              y: centerY,
                              color: (preset as any).color || '#FFFFFF',
                              hue: 0,
                              noise: 0.15,
                              noiseMode: 'chrome',
                              visible: true,
                              opacity: 1,
                              isLocked: false,
                              isSelected: true,
                              useOriginalColor: (preset as any).useOriginalColor !== undefined ? (preset as any).useOriginalColor : true,
                            };
                          });

                          setLayers([...filteredLayers, ...newMemeLayers]);
                          setIsProcessingFaces(false);
                        } else {
                          await addCap(undefined, undefined, undefined, undefined, preset.url, true);
                        }
                      }}
                      className={`w-full flex flex-col items-center gap-1.5 p-1 transition-all ${isLightMode ? 'hover:opacity-70' : 'hover:opacity-70'}`}
                    >
                      <div className="w-10 h-10 flex items-center justify-center relative bg-black/5 rounded-lg overflow-hidden">
                        <img 
                          src={preset.icon} 
                          alt={preset.name} 
                          className="w-full h-full object-contain image-pixelated p-0.5" 
                          style={{ 
                            transform: `scale(${preset.iconScale || 1})`,
                            filter: (preset as any).useOriginalColor === false ? `drop-shadow(0 0 0 ${(preset as any).color})` : 'none'
                          }}
                        />
                      </div>
                      <span className="text-[6px] font-bold uppercase tracking-tighter text-center leading-tight">{preset.name}</span>
                    </button>
                    
                    <div className="absolute top-1 right-1 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={async (e) => {
                          e.stopPropagation();
                          await addCap(undefined, undefined, undefined, undefined, preset.url, false);
                        }}
                        className="p-1.5 rounded-full bg-neon-green text-black shadow-lg hover:scale-110 transition-transform"
                        title="Replace Selected"
                      >
                        <Recycle size={10} />
                      </button>
                      <button 
                        onClick={async (e) => {
                          e.stopPropagation();
                          await addCap(undefined, undefined, undefined, undefined, preset.url, true);
                        }}
                        className="p-1.5 rounded-full bg-neon-green text-black shadow-lg hover:scale-110 transition-transform"
                        title="Generate New"
                      >
                        <Plus size={10} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: Canvas Area */}
        <div className="lg:col-span-7 flex flex-col items-center order-1 lg:order-2">
          <div className={`relative group p-4 rounded-3xl border backdrop-blur-sm ${isLightMode ? 'bg-white/40 border-black/5' : 'bg-black/40 border-white/5'}`}>
            <div className={`absolute inset-0 blur-[100px] rounded-full pointer-events-none ${isLightMode ? 'bg-black/5' : 'bg-neon-green/5'}`} />
            
            {/* Mobile Vertical Toolbar (Left) */}
            {!(mode === 'memes' && !memeImage) && (
              <div className="lg:hidden absolute left-2 top-1/2 -translate-y-1/2 flex flex-col gap-3 z-30">
                {mode === 'memes' && (
                  <button 
                    onClick={addCap}
                    className={`p-3 rounded-full shadow-lg border backdrop-blur-md ${isLightMode ? 'bg-white/80 text-black border-black/10' : 'bg-black/80 text-[#A855F7] border-[#A855F7]/20'}`}
                  >
                    <ImageIcon size={18} />
                  </button>
                )}
                <button 
                  onClick={addTextLayer}
                  className={`p-3 rounded-full shadow-lg border backdrop-blur-md ${isLightMode ? 'bg-white/80 text-black border-black/10' : 'bg-black/80 text-neon-green border-neon-green/20'}`}
                >
                  <Type size={18} />
                </button>
                <button 
                  onClick={applyTheme}
                  className={`p-3 rounded-full shadow-lg border backdrop-blur-md ${isLightMode ? 'bg-white/80 text-black border-black/10' : 'bg-black/80 text-neon-green border-neon-green/20'}`}
                >
                  <span className="w-4 h-4 flex items-center justify-center text-[10px] font-black leading-none">{THEMES[currentThemeIdx].name.charAt(0)}</span>
                </button>
                <button 
                  onClick={() => setMaxNoiseEnabled(!maxNoiseEnabled)}
                  className={`p-3 rounded-full shadow-lg border backdrop-blur-md ${maxNoiseEnabled ? (isLightMode ? 'bg-black text-white border-black' : 'bg-neon-green/20 text-neon-green border-neon-green/40') : (isLightMode ? 'bg-white/80 text-black/40 border-black/10' : 'bg-black/80 text-white/40 border-white/10')}`}
                >
                  <Activity size={18} />
                </button>
                <button 
                  onClick={() => setRandomizePalettes(!randomizePalettes)}
                  className={`p-3 rounded-full shadow-lg border backdrop-blur-md ${randomizePalettes ? (isLightMode ? 'bg-black text-white border-black' : 'bg-neon-green/20 text-neon-green border-neon-green/40') : (isLightMode ? 'bg-white/80 text-black/40 border-black/10' : 'bg-black/80 text-white/40 border-white/10')}`}
                >
                  <Palette size={18} />
                </button>
              </div>
            )}

            {/* Mobile Randomizer (Right) */}
            {!(mode === 'memes' && !memeImage) && (
              <button 
                onClick={randomizeAll}
                className={`lg:hidden absolute right-2 bottom-4 p-2.5 rounded-full shadow-2xl z-30 transition-all active:scale-95 ${isLightMode ? 'bg-black text-white' : 'bg-neon-green text-black'}`}
              >
                <Recycle size={18} />
              </button>
            )}

            <canvas
              ref={canvasRef}
              width={1024}
              height={1024}
              onMouseDown={handleCanvasMouseDown}
              onMouseMove={handleCanvasMouseMove}
              onMouseUp={handleCanvasMouseUp}
              onMouseLeave={handleCanvasMouseUp}
              onWheel={handleCanvasWheel}
              className={`w-full max-w-[340px] lg:max-w-[512px] aspect-square transition-all duration-500 group-hover:shadow-[0_0_50px_rgba(57,255,20,0.1)] ${isDragging ? 'cursor-grabbing' : 'cursor-crosshair'} ${mode === 'memes' && !memeImage ? 'hidden' : 'block'}`}
            />

            {/* In-canvas controls for active layer (Cap only) */}
            {activeLayerIdx !== null && layers[activeLayerIdx] && layers[activeLayerIdx].type === 'image' && layers[activeLayerIdx].visible && (
              <div 
                className="absolute pointer-events-none z-10"
                style={{
                  left: 16 + (layers[activeLayerIdx].x / 1024) * (canvasRef.current?.clientWidth || 512),
                  top: 16 + (layers[activeLayerIdx].y / 1024) * (canvasRef.current?.clientHeight || 512),
                  transform: `translate(-50%, -50%) rotate(${layers[activeLayerIdx].rotation}deg)`,
                }}
              >
                <div 
                  className="flex flex-col items-center gap-2 p-1 rounded-full bg-black/80 backdrop-blur-md border border-white/20 pointer-events-auto shadow-xl"
                  style={{
                    transform: `translateX(${((layers[activeLayerIdx].type === 'text' ? (layers[activeLayerIdx].fontSize * 2) : 1024) * layers[activeLayerIdx].scale / 1024 * (canvasRef.current?.clientWidth || 512) / 2) + 40}px) rotate(${-layers[activeLayerIdx].rotation}deg)`
                  }}
                >
                  <button 
                    onClick={() => {
                      const activeLayer = layers[activeLayerIdx];
                      if (activeLayer.groupId) {
                        setLayers(layers.map(l => l.groupId === activeLayer.groupId ? { ...l, flipX: !l.flipX } : l));
                      } else {
                        setLayers(layers.map((l, i) => i === activeLayerIdx ? { ...l, flipX: !l.flipX } : l));
                      }
                    }}
                    className="p-2 rounded-full hover:bg-white/10 text-white transition-colors"
                    title="Flip Layer"
                  >
                    <FlipHorizontal size={14} />
                  </button>
                  <button 
                    onClick={() => {
                      const activeLayer = layers[activeLayerIdx];
                      if (activeLayer.groupId) {
                        setLayers(layers.filter(l => l.groupId !== activeLayer.groupId));
                      } else {
                        setLayers(layers.filter((_, i) => i !== activeLayerIdx));
                      }
                      setActiveLayerIdx(null);
                    }}
                    className="p-2 rounded-full hover:bg-red-500/20 text-red-500 transition-colors"
                    title="Delete Layer"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            )}

            {mode === 'memes' && !memeImage && (
              <div className={`w-full max-w-[340px] lg:w-[512px] aspect-square flex flex-col items-center justify-center border-2 border-dashed rounded-2xl transition-all ${isLightMode ? 'bg-black lg:bg-black/5 border-black/10 hover:bg-black/10' : 'bg-black lg:bg-white/5 border-white/10 hover:bg-white/10'}`}>
                <input 
                  type="file" 
                  id="meme-upload" 
                  accept="image/*" 
                  className="hidden" 
                  onChange={handleMemeUpload}
                />
                <label 
                  htmlFor="meme-upload" 
                  className="flex flex-col items-center gap-4 cursor-pointer group"
                >
                  <div className={`p-6 rounded-full transition-all ${isLightMode ? 'bg-white/10 group-hover:bg-white/20' : 'bg-white/5 group-hover:bg-white/10'}`}>
                    <Upload size={32} className={isLightMode ? 'text-white' : 'text-neon-green'} />
                  </div>
                  <div className="flex flex-col items-center">
                    <span className={`text-[12px] font-black tracking-widest uppercase ${isLightMode ? 'text-white' : 'text-white'}`}>Upload Meme</span>
                    <span className={`text-[8px] tracking-widest mt-1 ${isLightMode ? 'text-white/60' : 'text-white/40'}`}>AUTO-CAP ENGINE READY</span>
                  </div>
                </label>
              </div>
            )}
            
            {/* Minimal Play/Stop Button Overlay */}
            {!(mode === 'memes' && !memeImage) && (
              <button 
                onClick={() => setIsAnimating(!isAnimating)}
                className={`absolute bottom-8 right-8 p-3 rounded-full backdrop-blur-md border hover:bg-neon-green hover:text-black transition-all group-hover:scale-110 ${isLightMode ? 'bg-white/60 text-black border-black/10' : 'bg-black/60 text-neon-green border-white/10'}`}
              >
                {isAnimating ? <Pause size={14} /> : <Play size={14} />}
              </button>
            )}

            {mode === 'memes' && memeImage && (
              <button 
                onClick={() => {
                  setMemeImage(null);
                  memeImgRef.current = null;
                  setLayers([]);
                }}
                className={`absolute top-8 right-8 p-3 rounded-full backdrop-blur-md border hover:bg-red-500 hover:text-white transition-all group-hover:scale-110 ${isLightMode ? 'bg-white/60 text-black border-black/10' : 'bg-black/60 text-white/40 border-white/10'}`}
                title="Clear Meme"
              >
                <X size={14} />
              </button>
            )}

            {isLoading && (
              <div className={`absolute inset-0 flex items-center justify-center rounded-3xl ${isLightMode ? 'bg-white/80' : 'bg-black/60'}`}>
                <div className="flex flex-col items-center gap-4 px-8 text-center">
                  {loadError ? (
                    <>
                      <X className="text-red-500" size={32} />
                      <span className="text-[10px] font-bold tracking-widest text-red-500 uppercase">
                        LOAD ERROR: {loadError}
                      </span>
                      <button 
                        onClick={() => window.location.reload()}
                        className={`mt-4 px-4 py-2 rounded-lg text-[10px] font-bold transition-colors ${isLightMode ? 'bg-black/10 hover:bg-black/20 text-black' : 'bg-white/10 hover:bg-white/20 text-white'}`}
                      >
                        RETRY SYSTEM
                      </button>
                    </>
                  ) : (
                    <>
                      <div className={`w-8 h-8 border-2 border-t-transparent rounded-full animate-spin ${isLightMode ? 'border-black' : 'border-neon-green'}`} />
                      <span className={`text-[10px] font-bold tracking-widest animate-pulse ${isLightMode ? 'text-black' : 'text-neon-green'}`}>LOADING ASSETS...</span>
                    </>
                  )}
                </div>
              </div>
            )}

            {isProcessingFaces && (
              <div className={`absolute inset-0 flex items-center justify-center rounded-3xl ${isLightMode ? 'bg-white/80' : 'bg-black/60'}`}>
                <div className="flex flex-col items-center gap-4 px-8 text-center">
                  <div className={`w-8 h-8 border-2 border-t-transparent rounded-full animate-spin border-[#A855F7]`} />
                  <span className={`text-[10px] font-bold tracking-widest animate-pulse text-[#A855F7]`}>SCANNING FOR HEADS...</span>
                </div>
              </div>
            )}
          </div>
          
          <div className="mt-8 flex flex-col gap-4 w-full max-w-[512px] hidden lg:flex">
            <div className="flex items-center gap-4">
              <div className="w-2 h-2 bg-neon-green rounded-full animate-pulse shadow-[0_0_10px_#39FF14]" />
              <div className={`text-[9px] font-bold uppercase tracking-[0.4em] ${isLightMode ? 'text-black' : 'text-white/20'}`}>
                Engine Active // 1024px // HD Export Ready
              </div>
            </div>
          </div>
        </div>
      </main>

      <style>{`
        .image-pixelated { image-rendering: pixelated; }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: ${isLightMode ? 'rgba(0,0,0,0.02)' : 'rgba(255,255,255,0.02)'}; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(57,255,20,0.2); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(57,255,20,0.4); }
        input[type="range"] { -webkit-appearance: none; background: transparent; width: 100%; }
        input[type="range"]::-webkit-slider-runnable-track { height: 2px; background: ${isLightMode ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)'}; border-radius: 2px; }
        input[type="range"]::-webkit-slider-thumb { -webkit-appearance: none; height: 10px; width: 10px; border-radius: 50%; background: #39FF14; cursor: pointer; margin-top: -4px; box-shadow: 0 0 10px rgba(57,255,20,0.5); }
      `}</style>
    </div>
  );
}


function CompactSlider({ label, value, min, max, step = 0.1, onChange, isLightMode = false }: { 
  label: string, value: number, min: number, max: number, step?: number, onChange: (v: number) => void, isLightMode?: boolean
}) {
  return (
    <div className="flex items-center gap-4">
      <span className={`text-[7px] w-8 tracking-widest ${isLightMode ? 'text-black' : 'text-white/10'}`}>{label}</span>
      <input 
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="flex-1"
      />
    </div>
  );
}
