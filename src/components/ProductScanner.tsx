import React, { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, X, Loader2, ScanLine, Package } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export interface ProductScanResult {
  product_name: string | null;
  barcode: string | null;
  brand: string | null;
  category: string;
  sku: string | null;
  confidence: string;
  details: string | null;
}

interface ProductScannerProps {
  onResult: (result: ProductScanResult) => void;
  buttonLabel?: string;
}

const getIsMobile = () => /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || ('ontouchstart' in window);

const ProductScanner = ({ onResult, buttonLabel = "Scan Product" }: ProductScannerProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [result, setResult] = useState<ProductScanResult | null>(null);
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

  const attachStream = useCallback(() => {
    if (streamRef.current && videoRef.current && !videoRef.current.srcObject) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.onloadedmetadata = () => {
        videoRef.current?.play().then(() => setCameraReady(true)).catch(() => {});
      };
    }
  }, []);

  useEffect(() => {
    if (isOpen && streamRef.current && !preview) {
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
          resolve(canvas.toDataURL("image/png"));
        } catch (e) { reject(e); }
      };
      img.onerror = () => reject(new Error("Failed to load image"));
      img.src = dataUrl;
    });
  };

  const processImage = async (imageData: string) => {
    setScanning(true);
    setResult(null);
    try {
      const resized = await resizeImage(imageData);
      const { data, error } = await supabase.functions.invoke("product-scanner", {
        body: { image: resized },
      });

      if (error) throw error;

      if (data?.product_name || data?.barcode || data?.sku) {
        setResult(data);
        toast({ title: "Produto identificado!", description: data.product_name || data.barcode || data.sku });
      } else {
        toast({ title: "Não foi possível identificar o produto", description: "Tente uma foto mais nítida", variant: "destructive" });
      }
    } catch (err: any) {
      console.error("Product scan error:", err);
      toast({ title: "Falha no scan", description: err.message || "Tente novamente", variant: "destructive" });
    } finally {
      setScanning(false);
    }
  };

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

  const handleDesktopOpen = async () => {
    setPreview(null);
    setCameraReady(false);
    setResult(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      setIsOpen(true);
    } catch {
      toast({ title: "Câmera indisponível", description: "Verifique as permissões", variant: "destructive" });
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    if (!video.videoWidth || !video.videoHeight || video.readyState < 2) {
      toast({ title: "Câmera ainda não está pronta", variant: "destructive" });
      return;
    }
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    if (dataUrl.length < 5000) {
      toast({ title: "Imagem inválida", variant: "destructive" });
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
    setResult(null);
  };

  const handleUseResult = () => {
    if (result) {
      onResult(result);
      handleClose();
    }
  };

  const handleRetake = () => {
    setPreview(null);
    setScanning(false);
    setResult(null);
    if (isMobile) {
      handleClose();
      setTimeout(() => fileInputRef.current?.click(), 100);
    } else {
      handleDesktopOpen();
    }
  };

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
        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleMobileCapture} className="hidden" />
      )}

      <button onClick={isMobile ? () => fileInputRef.current?.click() : handleDesktopOpen} type="button"
        className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2.5 min-h-[44px] text-sm font-medium text-primary hover:bg-primary/20 transition-colors">
        <Camera className="h-4 w-4" /> {buttonLabel}
      </button>

      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg mx-4 rounded-xl border border-border bg-card p-6">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                  <ScanLine className="h-5 w-5 text-primary" /> Product Scanner
                </h2>
                <button onClick={handleClose}><X className="h-5 w-5 text-muted-foreground" /></button>
              </div>

              {scanning ? (
                <div className="flex flex-col items-center justify-center py-12">
                  {preview && <img src={preview} alt="Captured" className="w-full rounded-lg mb-4 opacity-50" />}
                  <Loader2 className="h-10 w-10 animate-spin text-primary mb-3" />
                  <p className="text-sm text-muted-foreground">Analisando produto...</p>
                </div>
              ) : result ? (
                <div className="space-y-4">
                  {preview && <img src={preview} alt="Captured" className="w-full rounded-lg" />}
                  <div className="rounded-lg border border-border bg-secondary p-4 space-y-2">
                    <div className="flex items-center gap-2 mb-2">
                      <Package className="h-4 w-4 text-primary" />
                      <span className="text-sm font-semibold text-foreground">Resultado</span>
                      <span className={`ml-auto text-xs px-2 py-0.5 rounded-full ${result.confidence === "high" ? "bg-green-500/20 text-green-400" : result.confidence === "medium" ? "bg-yellow-500/20 text-yellow-400" : "bg-red-500/20 text-red-400"}`}>
                        {result.confidence}
                      </span>
                    </div>
                    {result.product_name && <p className="text-sm text-foreground"><span className="text-muted-foreground">Nome:</span> {result.product_name}</p>}
                    {result.barcode && <p className="text-sm text-foreground"><span className="text-muted-foreground">Código:</span> {result.barcode}</p>}
                    {result.brand && <p className="text-sm text-foreground"><span className="text-muted-foreground">Marca:</span> {result.brand}</p>}
                    {result.sku && <p className="text-sm text-foreground"><span className="text-muted-foreground">SKU:</span> {result.sku}</p>}
                    <p className="text-sm text-foreground"><span className="text-muted-foreground">Categoria:</span> {result.category}</p>
                    {result.details && <p className="text-xs text-muted-foreground">{result.details}</p>}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={handleRetake} className="flex-1 rounded-lg border border-border py-3 min-h-[44px] text-sm text-muted-foreground hover:bg-secondary">
                      Tentar Novamente
                    </button>
                    <button onClick={handleUseResult} className="flex-1 rounded-lg bg-primary py-3 min-h-[44px] text-sm font-semibold text-primary-foreground hover:brightness-110">
                      Usar Resultado
                    </button>
                  </div>
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
                      <div className="border-2 border-primary/60 rounded-lg w-3/4 h-24" />
                    </div>
                  </div>
                  <p className="text-xs text-center text-muted-foreground">Aponte para o código de barras, QR code ou etiqueta do produto</p>
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

export default ProductScanner;
