'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

export default function VisitorPage() {
  // State
  const [frames, setFrames] = useState([]);
  const [selectedFrame, setSelectedFrame] = useState(null);
  const [selectedFrameImg, setSelectedFrameImg] = useState(null);
  const [framePoints, setFramePoints] = useState([]);
  const [showFrameSelector, setShowFrameSelector] = useState(false);
  const [faceDetected, setFaceDetected] = useState(false);
  const [useFrontCamera, setUseFrontCamera] = useState(true);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showFlash, setShowFlash] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [showPointPopup, setShowPointPopup] = useState(null);
  const [faceDetectorReady, setFaceDetectorReady] = useState(false);

  // Refs
  const videoRef = useRef(null);
  const frameCanvasRef = useRef(null);
  const captureCanvasRef = useRef(null);
  const viewportRef = useRef(null);
  const streamRef = useRef(null);
  const faceDetectorRef = useRef(null);
  const animFrameRef = useRef(null);
  const faceBoxRef = useRef(null);
  const smoothFaceRef = useRef(null);
  // Track frame draw position so points can follow it
  const frameDrawRef = useRef(null);

  // Show toast
  const showToast = useCallback((msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 2500);
  }, []);

  // Fetch frames
  useEffect(() => {
    fetch('/api/frames')
      .then(r => r.json())
      .then(data => {
        setFrames(data.frames || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // Load MediaPipe via script tag (Turbopack can't handle external dynamic imports)
  useEffect(() => {
    let cancelled = false;

    function loadScript(src) {
      return new Promise((resolve, reject) => {
        // Check if already loaded
        if (document.querySelector(`script[src="${src}"]`)) {
          resolve();
          return;
        }
        const script = document.createElement('script');
        script.src = src;
        script.type = 'module';
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
      });
    }

    async function initFaceDetector() {
      try {
        // Load the MediaPipe vision bundle via a dynamic module import in a script element
        // We use a different approach: create a module script that exports to window
        const initScript = document.createElement('script');
        initScript.type = 'module';
        initScript.textContent = `
          import { FaceDetector, FilesetResolver } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/vision_bundle.mjs";
          window.__MediaPipeFaceDetector = FaceDetector;
          window.__MediaPipeFilesetResolver = FilesetResolver;
          window.dispatchEvent(new Event('mediapipe-loaded'));
        `;
        document.head.appendChild(initScript);

        // Wait for the module to load
        await new Promise((resolve, reject) => {
          if (window.__MediaPipeFaceDetector) {
            resolve();
            return;
          }
          const timeout = setTimeout(() => reject(new Error('MediaPipe load timeout')), 30000);
          window.addEventListener('mediapipe-loaded', () => {
            clearTimeout(timeout);
            resolve();
          }, { once: true });
        });

        if (cancelled) return;

        const FaceDetector = window.__MediaPipeFaceDetector;
        const FilesetResolver = window.__MediaPipeFilesetResolver;

        const filesetResolver = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm'
        );

        let detector;
        try {
          detector = await FaceDetector.createFromOptions(filesetResolver, {
            baseOptions: {
              modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite',
              delegate: 'GPU'
            },
            runningMode: 'VIDEO',
            minDetectionConfidence: 0.5
          });
        } catch {
          // Fallback without GPU
          detector = await FaceDetector.createFromOptions(filesetResolver, {
            baseOptions: {
              modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite',
            },
            runningMode: 'VIDEO',
            minDetectionConfidence: 0.5
          });
        }

        if (!cancelled) {
          faceDetectorRef.current = detector;
          setFaceDetectorReady(true);
          console.log('✅ Face detector ready');
        }
      } catch (err) {
        console.error('Face detector init error:', err);
      }
    }

    initFaceDetector();
    return () => { cancelled = true; };
  }, []);

  // Start camera
  const startCamera = useCallback(async (front) => {
    // Stop existing stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
    }

    try {
      const constraints = {
        video: {
          facingMode: front ? 'user' : 'environment',
          width: { ideal: 720 },
          height: { ideal: 960 },
        },
        audio: false
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current.play();
          setCameraReady(true);
          setCameraError(null);
        };
      }
    } catch (err) {
      console.error('Camera error:', err);
      setCameraError(err.name === 'NotAllowedError'
        ? 'Izin kamera ditolak. Silakan izinkan akses kamera di pengaturan browser.'
        : 'Tidak dapat mengakses kamera. Pastikan perangkat memiliki kamera.'
      );
    }
  }, []);

  // Init camera on mount
  useEffect(() => {
    startCamera(useFrontCamera);
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, []);

  // Flip camera
  const flipCamera = useCallback(() => {
    setUseFrontCamera(prev => {
      const next = !prev;
      startCamera(next);
      return next;
    });
  }, [startCamera]);

  // Load frame image when selected
  useEffect(() => {
    if (!selectedFrame) {
      setSelectedFrameImg(null);
      setFramePoints([]);
      return;
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => setSelectedFrameImg(img);
    img.src = selectedFrame.image_path;

    // Fetch points for this frame
    fetch(`/api/points?frame_id=${selectedFrame.id}`)
      .then(r => r.json())
      .then(data => setFramePoints(data.points || []))
      .catch(() => setFramePoints([]));
  }, [selectedFrame]);

  // Face detection + frame rendering loop
  useEffect(() => {
    if (!cameraReady || !videoRef.current) return;

    let lastTimestamp = 0;

    function detectAndRender(timestamp) {
      const video = videoRef.current;
      const canvas = frameCanvasRef.current;
      if (!video || !canvas || video.readyState < 2) {
        animFrameRef.current = requestAnimationFrame(detectAndRender);
        return;
      }

      // Set canvas size to match video
      if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
      }

      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Run face detection (throttle to ~15fps for performance)
      if (faceDetectorRef.current && timestamp - lastTimestamp > 66) {
        lastTimestamp = timestamp;
        try {
          const results = faceDetectorRef.current.detectForVideo(video, timestamp);
          if (results.detections && results.detections.length > 0) {
            const detection = results.detections[0];
            const bbox = detection.boundingBox;

            // Store raw face bounding box
            faceBoxRef.current = {
              x: bbox.originX,
              y: bbox.originY,
              width: bbox.width,
              height: bbox.height,
              videoWidth: video.videoWidth,
              videoHeight: video.videoHeight
            };
            setFaceDetected(true);
          } else {
            faceBoxRef.current = null;
            setFaceDetected(false);
          }
        } catch (e) {
          // Ignore detection errors
        }
      }

      // Render frame overlay
      if (selectedFrameImg && faceBoxRef.current) {
        const face = faceBoxRef.current;

        // Smooth face tracking
        if (!smoothFaceRef.current) {
          smoothFaceRef.current = { ...face };
        } else {
          const lerp = 0.3;
          smoothFaceRef.current.x += (face.x - smoothFaceRef.current.x) * lerp;
          smoothFaceRef.current.y += (face.y - smoothFaceRef.current.y) * lerp;
          smoothFaceRef.current.width += (face.width - smoothFaceRef.current.width) * lerp;
          smoothFaceRef.current.height += (face.height - smoothFaceRef.current.height) * lerp;
        }

        const sf = smoothFaceRef.current;
        const frameImg = selectedFrameImg;

        // The face center
        let faceCenterX = sf.x + sf.width / 2;
        let faceCenterY = sf.y + sf.height / 2;

        // Mirror for front camera
        if (useFrontCamera) {
          faceCenterX = video.videoWidth - faceCenterX;
        }

        // Scale frame based on face size - frame should be about 3.5x the face width
        const frameScale = (sf.width * 3.5) / frameImg.naturalWidth;
        const drawWidth = frameImg.naturalWidth * frameScale;
        const drawHeight = frameImg.naturalHeight * frameScale;

        // Use admin-configured face center point (percentage of frame image)
        // face_center_x: where in the frame (horizontally) the face should appear
        // face_center_y: where in the frame (vertically) the face should appear
        const centerX = selectedFrame?.face_center_x != null ? parseFloat(selectedFrame.face_center_x) / 100 : 0.5;
        const centerY = selectedFrame?.face_center_y != null ? parseFloat(selectedFrame.face_center_y) / 100 : 0.42;

        const drawX = faceCenterX - drawWidth * centerX;
        const drawY = faceCenterY - drawHeight * centerY;

        ctx.drawImage(frameImg, drawX, drawY, drawWidth, drawHeight);

        // Store frame draw coordinates for point positioning
        frameDrawRef.current = {
          drawX, drawY, drawWidth, drawHeight,
          canvasWidth: canvas.width, canvasHeight: canvas.height
        };
      } else if (selectedFrameImg && !faceBoxRef.current) {
        // No face detected - show frame centered and full size
        const frameImg = selectedFrameImg;
        const canvasAspect = canvas.width / canvas.height;
        const frameAspect = frameImg.naturalWidth / frameImg.naturalHeight;

        let drawWidth, drawHeight;
        if (frameAspect > canvasAspect) {
          drawWidth = canvas.width;
          drawHeight = drawWidth / frameAspect;
        } else {
          drawHeight = canvas.height;
          drawWidth = drawHeight * frameAspect;
        }

        const drawX = (canvas.width - drawWidth) / 2;
        const drawY = (canvas.height - drawHeight) / 2;
        ctx.globalAlpha = 0.5;
        ctx.drawImage(frameImg, drawX, drawY, drawWidth, drawHeight);
        ctx.globalAlpha = 1.0;

        // Store frame draw coordinates for point positioning
        frameDrawRef.current = {
          drawX, drawY, drawWidth, drawHeight,
          canvasWidth: canvas.width, canvasHeight: canvas.height
        };
      } else {
        frameDrawRef.current = null;
      }

      animFrameRef.current = requestAnimationFrame(detectAndRender);
    }

    animFrameRef.current = requestAnimationFrame(detectAndRender);

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [cameraReady, selectedFrame, selectedFrameImg, useFrontCamera, faceDetectorReady]);

  // Capture photo
  const capturePhoto = useCallback(() => {
    const video = videoRef.current;
    const frameCanvas = frameCanvasRef.current;
    const viewport = viewportRef.current;
    if (!video || !frameCanvas || !viewport) return;

    // Flash effect
    setShowFlash(true);
    setTimeout(() => setShowFlash(false), 300);

    // Calculate the visible crop region to match object-fit: cover
    // The viewport has aspect-ratio 3:4, video may have different ratio
    const vpRect = viewport.getBoundingClientRect();
    const vpAspect = vpRect.width / vpRect.height; // 3:4 = 0.75
    const vidAspect = video.videoWidth / video.videoHeight;

    let srcX, srcY, srcW, srcH;
    if (vidAspect > vpAspect) {
      // Video is wider than viewport — crop sides
      srcH = video.videoHeight;
      srcW = srcH * vpAspect;
      srcX = (video.videoWidth - srcW) / 2;
      srcY = 0;
    } else {
      // Video is taller than viewport — crop top/bottom
      srcW = video.videoWidth;
      srcH = srcW / vpAspect;
      srcX = 0;
      srcY = (video.videoHeight - srcH) / 2;
    }

    // Output canvas at the cropped size
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(srcW);
    canvas.height = Math.round(srcH);
    const ctx = canvas.getContext('2d');

    // Draw the cropped video region (mirror if front camera)
    if (useFrontCamera) {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, srcX, srcY, srcW, srcH, 0, 0, canvas.width, canvas.height);

    // Reset transform
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    // Draw frame overlay — also crop the same region from the frame canvas
    // frameCanvas has the same internal resolution as video (videoWidth x videoHeight)
    ctx.drawImage(frameCanvas, srcX, srcY, srcW, srcH, 0, 0, canvas.width, canvas.height);

    // Download
    canvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `AR_PhotoBooth_${new Date().toISOString().slice(0, 19).replace(/[:-]/g, '')}.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('📸 Foto berhasil disimpan!');
    }, 'image/jpeg', 0.92);
  }, [useFrontCamera, showToast]);

  // Select frame
  const selectFrame = useCallback((frame) => {
    setSelectedFrame(frame);
    setShowFrameSelector(false);
    smoothFaceRef.current = null;
    showToast(`🖼️ Frame "${frame.name}" dipilih`);
  }, [showToast]);

  // Calculate point position relative to the frame's current drawn position
  // Points are stored as percentages of the frame image
  // We convert them to CSS viewport percentages based on where the frame is drawn on the canvas
  const getPointStyle = (point) => {
    const fd = frameDrawRef.current;
    const viewport = viewportRef.current;
    if (!fd || !viewport) {
      return { display: 'none' };
    }

    // Point position on the canvas (in canvas pixel coords)
    const canvasX = fd.drawX + (parseFloat(point.x_percent) / 100) * fd.drawWidth;
    const canvasY = fd.drawY + (parseFloat(point.y_percent) / 100) * fd.drawHeight;

    // Convert canvas coords to viewport CSS percentage
    // The canvas is displayed to fill the viewport via object-fit: cover
    const vpRect = viewport.getBoundingClientRect();
    const vpAspect = vpRect.width / vpRect.height;
    const canvasAspect = fd.canvasWidth / fd.canvasHeight;

    let scale, offsetX, offsetY;
    if (canvasAspect > vpAspect) {
      // Canvas is wider: height fills, width is clipped
      scale = vpRect.height / fd.canvasHeight;
      offsetX = (vpRect.width - fd.canvasWidth * scale) / 2;
      offsetY = 0;
    } else {
      // Canvas is taller: width fills, height is clipped
      scale = vpRect.width / fd.canvasWidth;
      offsetX = 0;
      offsetY = (vpRect.height - fd.canvasHeight * scale) / 2;
    }

    const cssX = offsetX + canvasX * scale;
    const cssY = offsetY + canvasY * scale;

    // Convert to percentage of viewport
    const leftPercent = (cssX / vpRect.width) * 100;
    const topPercent = (cssY / vpRect.height) * 100;

    return {
      left: `${leftPercent}%`,
      top: `${topPercent}%`,
    };
  };

  return (
    <div className="visitor-container">
      {/* Header */}
      <header className="visitor-header">
        <span className="logo-icon">
          <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
        </span>
        <h1>AR Photo Booth</h1>
      </header>

      {/* Camera Area */}
      <div className="camera-area">
        <div className="camera-viewport" ref={viewportRef}>
          {/* Video */}
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={useFrontCamera ? 'mirror' : ''}
          />

          {/* Frame Canvas Overlay */}
          <canvas ref={frameCanvasRef} id="frameCanvas" />

          {/* Point Markers - invisible tap areas that follow frame position */}
          {selectedFrame && framePoints.length > 0 && frameDrawRef.current && (
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 5, pointerEvents: 'none' }}>
              {framePoints.map((point) => (
                <div
                  key={point.id}
                  className="point-marker-invisible"
                  style={getPointStyle(point)}
                  onClick={(e) => { e.stopPropagation(); setShowPointPopup(point); }}
                />
              ))}
            </div>
          )}

          {/* Face Detection Indicator */}
          <div className={`face-indicator ${faceDetected ? 'detected' : ''}`}>
            <span className="dot" />
            {faceDetected ? 'Wajah Terdeteksi' : 'Mencari Wajah...'}
          </div>

          {/* No Frame Selected Overlay */}
          <div className={`no-frame-overlay ${selectedFrame ? 'hidden' : ''}`}>
            <div className="icon">
              <svg viewBox="0 0 24 24"><path d="M21 3H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H3V5h18v14zm-10-7l-3 4h10l-4-5-3 3.5z"/></svg>
            </div>
            <p>Tap tombol frame untuk<br/>memilih bingkai</p>
          </div>

          {/* Camera Error */}
          {cameraError && (
            <div className="camera-error">
              <svg viewBox="0 0 24 24"><path d="M18 10.48V6c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2v-4.48l4 3.98v-11l-4 3.98zm-2-.79V18H4V6h12v3.69zM10 8H5.09C6.47 10.64 8.58 12.77 10 14c1.42-1.23 3.53-3.36 4.91-6H10z"/></svg>
              <h3>Kamera Tidak Tersedia</h3>
              <p>{cameraError}</p>
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div className="loading-overlay">
              <div className="loading-spinner" />
              <p>Memuat...</p>
            </div>
          )}
        </div>
      </div>

      {/* Controls Bar */}
      <div className="controls-bar">
        {/* Frame Selector Button */}
        <button
          className="control-btn btn-secondary"
          onClick={() => setShowFrameSelector(true)}
          title="Pilih Frame"
          id="btn-frame-select"
        >
          <svg viewBox="0 0 24 24"><path d="M21 3H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H3V5h18v14zm-10-7l-3 4h10l-4-5-3 3.5z"/></svg>
        </button>

        {/* Capture Button */}
        <button
          className="control-btn btn-capture"
          onClick={capturePhoto}
          title="Ambil Foto"
          id="btn-capture"
        >
          <div className="inner" />
        </button>

        {/* Flip Camera Button */}
        <button
          className="control-btn btn-secondary"
          onClick={flipCamera}
          title="Ganti Kamera"
          id="btn-flip-camera"
        >
          <svg viewBox="0 0 24 24"><path d="M20 5h-3.17L15 3H9L7.17 5H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm-8 13c-2.76 0-5-2.24-5-5h1.5c0 1.93 1.57 3.5 3.5 3.5s3.5-1.57 3.5-3.5H17c0 2.76-2.24 5-5 5zm-3.5-6C8.5 10.07 10.07 8.5 12 8.5s3.5 1.57 3.5 3.5H17c0-2.76-2.24-5-5-5s-5 2.24-5 5h1.5z"/></svg>
        </button>
      </div>

      {/* Frame Selector Bottom Sheet */}
      <div
        className={`frame-selector-backdrop ${showFrameSelector ? 'visible' : ''}`}
        onClick={() => setShowFrameSelector(false)}
      />
      <div className={`frame-selector ${showFrameSelector ? 'visible' : ''}`}>
        <div className="frame-selector-content">
          <div className="frame-selector-handle" />
          <h3 className="frame-selector-title">🖼️ Pilih Frame</h3>
          <div className="frame-grid">
            {frames.map(frame => (
              <div
                key={frame.id}
                className={`frame-card ${selectedFrame?.id === frame.id ? 'selected' : ''}`}
                onClick={() => selectFrame(frame)}
              >
                <img src={frame.image_path} alt={frame.name} loading="lazy" />
                <div className="frame-name">{frame.name}</div>
                <div className="check-badge">
                  <svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
                </div>
              </div>
            ))}
          </div>
          {selectedFrame && (
            <button
              className="frame-remove-btn"
              onClick={() => { setSelectedFrame(null); setShowFrameSelector(false); }}
            >
              Hapus Frame
            </button>
          )}
        </div>
      </div>

      {/* Flash Overlay */}
      <div className={`flash-overlay ${showFlash ? 'flash' : ''}`} />

      {/* Point Description Popup */}
      <div
        className={`point-popup-backdrop ${showPointPopup ? 'visible' : ''}`}
        onClick={() => setShowPointPopup(null)}
      />
      <div className={`point-popup ${showPointPopup ? 'visible' : ''}`}>
        <div className="point-popup-content">
          <div className="point-popup-handle" />
          {showPointPopup && (
            <>
              <h3 className="point-popup-title">📍 {showPointPopup.title}</h3>
              <p className="point-popup-description">{showPointPopup.description}</p>
            </>
          )}
        </div>
      </div>

      {/* Toast */}
      <div className={`toast success ${toastMsg ? 'visible' : ''}`}>
        {toastMsg}
      </div>
    </div>
  );
}
