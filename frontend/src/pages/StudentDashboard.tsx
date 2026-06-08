import React, { useEffect, useRef, useState } from 'react';
import './StudentDashboard.css';

const isMobileOrTablet = () => {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(pointer: coarse)').matches || /Mobi|Android|Tablet|iPad|iPhone/i.test(navigator.userAgent);
};

const StudentDashboard = () => {
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const supported = 'mediaDevices' in navigator && 'getUserMedia' in navigator.mediaDevices;
    setIsSupported(supported);

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsScanning(false);
  };

  const handleScanSuccess = (code: string) => {
    setScanResult(code);
    setScanError(null);
    stopCamera();
  };

  const scanFrame = async (barcodeDetector: { detect: (el: HTMLVideoElement) => Promise<{ rawValue: string }[]> }) => {
    if (!videoRef.current) return;
    try {
      const detections = await barcodeDetector.detect(videoRef.current);
      if (detections.length > 0) {
        handleScanSuccess(detections[0].rawValue || detections[0].rawValue);
        return;
      }
    } catch {
      setScanError('Unable to read QR code. Please try again.');
      stopCamera();
      return;
    }

    if (isScanning) {
      requestAnimationFrame(() => scanFrame(barcodeDetector));
    }
  };

  const startScanner = async () => {
    if (!isSupported) {
      setScanError('Camera access is not supported in this browser.');
      return;
    }

    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = mediaStream;
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        await videoRef.current.play();
      }

      const BarcodeDetector = (window as Window & { BarcodeDetector?: new (options: { formats: string[] }) => { detect: (el: HTMLVideoElement) => Promise<{ rawValue: string }[]> } }).BarcodeDetector;
      if (!BarcodeDetector) {
        setScanError('This device does not support barcode scanning. Use a modern mobile browser.');
        stopCamera();
        return;
      }

      const detector = new BarcodeDetector({ formats: ['qr_code'] });
      setIsScanning(true);
      setScanResult(null);
      setScanError(null);
      requestAnimationFrame(() => scanFrame(detector));
    } catch {
      setScanError('Camera access denied or unavailable. Please allow camera access on your device.');
      setIsScanning(false);
    }
  };

  return (
    <div className="student-dashboard page-container">
      <div className="student-dashboard__header">
        <h1>Student Dashboard</h1>
        <p>Scan your attendance QR from your phone or tablet.</p>
      </div>

      <section className="scan-section">
        <div className="scan-card">
          <div className="scan-card__header">
            <h2>Attendance Scan Lens</h2>
            <span className="scan-card__badge">Mobile / Tablet only</span>
          </div>

          {isMobileOrTablet() ? (
            <>
              <p className="scan-card__subtitle">
                Use the camera on your phone or tablet to scan the generated attendance QR code.
              </p>
              <button className="scan-card__button" onClick={startScanner} disabled={!isSupported || isScanning}>
                {isScanning ? 'Scanning...' : 'Open Scan Lens'}
              </button>

              {isSupported && isScanning && (
                <div className="scan-preview">
                  <video ref={videoRef} className="scan-preview__video" muted playsInline />
                </div>
              )}

              {scanResult && <div className="scan-result success">Scanned attendance code: {scanResult}</div>}
              {scanError && <div className="scan-result error">{scanError}</div>}

              {isScanning && (
                <button className="scan-card__button scan-card__button--secondary" onClick={stopCamera}>
                  Stop Scanner
                </button>
              )}
            </>
          ) : (
            <div className="scan-card__desktop-note">
              The scan lens is visible here, but the mobile camera scanner only works on phones and tablets.
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default StudentDashboard;
