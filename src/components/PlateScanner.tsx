import React, { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, X, Loader2, ScanLine } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface PlateResult {
  registration: string;
  confidence: string;
  make?: string | null;
  model?: string | null;
  color?: string | null;
}

interface PlateScannerProps {
  onResult: (result: PlateResult) => void;
}

const getIsMobile = () => /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

const PlateScanner = ({ onResult }: PlateScannerProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isMobile = getIsMobile();

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setCameraReady(false);
  }, []);

  // Attach stream to video element whenever stream or video ref changes
  const attachStream = useCallback(() => {
    if (streamRef.current && videoRef.current && !videoRef.current.srcObject) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.onloadedmetadata = () => {
        videoRef.current?.play().then(() => setCameraReady(true)).catch(() => {});
      };
    }
  }, []);

  // When modal opens and we have a pending stream, attach it once the video element renders
  useEffect(() => {
    if (isOpen && streamRef.current && !preview) {
      // Try immediately, and also retry after a short delay for slow renders
      attachStream();
      const timer = setTimeout(attachStream, 100);
      const timer2 = setTimeout(attachStream, 300);
      return () => { clearTimeout(timer); clearTimeout(timer2); };
    }
  }, [isOpen, preview, attachStream]);

  const resizeImage = (dataUrl: string, maxWidth = 800): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          const scale = Math.min(1, maxWidth / img.width);
          canvas.width = Math.round(img.width * scale);
          canvas.height = Math.round(img.height * scale);
          const ctx = canvas.getContext("2d")!;
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          // Use PNG — more reliable base64 encoding, no ICC profile issues
          const result = canvas.toDataURL("image/png");
          console.log("Resized image:", canvas.width, "x", canvas.height, "base64 length:", result.length);
          resolve(result);
        } catch (e) {
          reject(e);
        }
      };
      img.onerror = () => reject(new Error("Failed to load image for resize"));
      img.src = dataUrl;
    });
  };

  const processImage = async (imageData: string) => {
    setScanning(true);
    try {
      const resized = await resizeImage(imageData);

      const { data, error } = await supabase.functions.invoke("plate-scanner", {
        body: { image: resized },
      });

      if (error) throw error;

      if (data?.registration) {
        toast({ title: `Placa detectada: ${data.registration}`, description: `Confiança: ${data.confidence}` });
        onResult(data);
        handleClose();
      } else {
        toast({ title: "Não foi possível detectar a placa", description: "Tente uma foto mais nítida e próxima", variant: "destructive" });
      }
    } catch (err: any) {
      console.error("Scan error:", err);
      toast({ title: "Falha no scan", description: err.message || "Tente novamente", variant: "destructive" });
    } finally {
      setScanning(false);
    }
  };

  // Mobile: native camera app
  const handleMobileCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsOpen(true);
    setScanning(true);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      setPreview(dataUrl);
      processImage(dataUrl);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  // Desktop: getUserMedia directly in click handler (critical for Safari)
  const handleDesktopOpen = async () => {
    setPreview(null);
    setCameraReady(false);
    
    try {
      // Get stream FIRST (requires user gesture context)
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });
      streamRef.current = stream;
      
      // Open modal AFTER we have the stream - React will render the video element
      // and our useEffect will attach the stream
      setIsOpen(true);
    } catch (err: any) {
      console.error("Camera error:", err);
      toast({ title: "Câmera indisponível", description: "Verifique as permissões do navegador", variant: "destructive" });
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    
    // Guard: ensure the video is actually playing with real dimensions
    if (!video.videoWidth || !video.videoHeight || video.readyState < 2) {
      console.warn("Video not ready:", { w: video.videoWidth, h: video.videoHeight, state: video.readyState });
      toast({ title: "Câmera ainda não está pronta", description: "Aguarde a imagem aparecer e tente novamente", variant: "destructive" });
      return;
    }
    
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    
    // Guard: ensure captured image has meaningful data (> 5KB)
    if (dataUrl.length < 5000) {
      console.warn("Captured image too small:", dataUrl.length);
      toast({ title: "Imagem inválida", description: "A câmera não capturou uma imagem válida. Tente novamente.", variant: "destructive" });
      return;
    }
    
    setPreview(dataUrl);
    stopCamera();
    processImage(dataUrl);
  };

  const handleClose = () => {
    stopCamera();
    setIsOpen(false);
    setPreview(null);
    setScanning(false);
  };

  const handleRetake = () => {
    setPreview(null);
    setScanning(false);
    if (isMobile) {
      handleClose();
      setTimeout(() => fileInputRef.current?.click(), 100);
    } else {
      // Re-acquire camera stream for desktop
      handleDesktopOpen();
    }
  };

  // Video ref callback to attach stream as soon as video element mounts
  const videoRefCallback = useCallback((node: HTMLVideoElement | null) => {
    (videoRef as React.MutableRefObject<HTMLVideoElement | null>).current = node;
    if (node && streamRef.current && !node.srcObject) {
      node.srcObject = streamRef.current;
      node.onloadedmetadata = () => {
        node.play().then(() => setCameraReady(true)).catch(() => {});
      };
    }
  }, []);

  return (
    <>
      {isMobile && (
        <input ref={fileInputRef} type="file" accept="image/*" capture="environment" onChange={handleMobileCapture} className="hidden" />
      )}

      <button onClick={isMobile ? () => fileInputRef.current?.click() : handleDesktopOpen} type="button"
        className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2.5 min-h-[44px] text-sm font-medium text-primary hover:bg-primary/20 transition-colors">
        <Camera className="h-4 w-4" /> Scan Plate
      </button>

      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg mx-4 rounded-xl border border-border bg-card p-6">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                  <ScanLine className="h-5 w-5 text-primary" /> Plate Scanner
                </h2>
                <button onClick={handleClose}><X className="h-5 w-5 text-muted-foreground" /></button>
              </div>

              {scanning ? (
                <div className="flex flex-col items-center justify-center py-12">
                  {preview && <img src={preview} alt="Captured" className="w-full rounded-lg mb-4 opacity-50" />}
                  <Loader2 className="h-10 w-10 animate-spin text-primary mb-3" />
                  <p className="text-sm text-muted-foreground">Analisando placa...</p>
                </div>
              ) : preview ? (
                <div className="space-y-4">
                  <img src={preview} alt="Captured" className="w-full rounded-lg" />
                  <button onClick={handleRetake} className="w-full rounded-lg border border-border py-3 min-h-[44px] text-sm text-muted-foreground hover:bg-secondary">
                    Tentar Novamente
                  </button>
                </div>
              ) : !isMobile ? (
                <div className="space-y-4">
                  <div className="relative rounded-lg overflow-hidden bg-black" style={{ minHeight: 200 }}>
                    <video ref={videoRefCallback} autoPlay playsInline muted className="w-full" style={{ WebkitTransform: "translateZ(0)" }} />
                    {!cameraReady && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                      </div>
                    )}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="border-2 border-primary/60 rounded-lg w-3/4 h-16" />
                    </div>
                  </div>
                  <button onClick={capturePhoto} disabled={!cameraReady}
                    className="w-full rounded-lg bg-primary py-3 min-h-[44px] text-sm font-semibold text-primary-foreground hover:brightness-110 disabled:opacity-50">
                    {cameraReady ? "Capturar Foto" : "Iniciando câmera..."}
                  </button>
                </div>
              ) : null}

              <canvas ref={canvasRef} className="hidden" />
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};

export default PlateScanner;
