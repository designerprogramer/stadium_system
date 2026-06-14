import { useCallback, useEffect, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { useRef } from "react";
import { QrCode } from "lucide-react";
import API from "../../lib/api";
import DashboardPageHeader from "../../components/DashboardPageHeader";

export default function TicketChecking() {
  const [scanResult, setScanResult] = useState(null);
  const [scanHistory, setScanHistory] = useState([]);
  const [scanning, setScanning] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [scanHint, setScanHint] = useState("");
  const [scanAccess, setScanAccess] = useState({ loading: true, allowed: false, message: "" });
  const cameraRef = useRef(null);
  const processingRef = useRef(false);

  const loadScanHistory = useCallback(async () => {
    try {
      const response = await API.get("/events/recent-ticket-scans/");
      setScanHistory(response.data.map((scan) => ({
        scanId: scan.id,
        id: scan.ticket_id || "N/A",
        status: scan.status,
        message: scan.message,
        holder: scan.holder,
        event: scan.event,
        scannedAt: scan.scanned_at,
        time: new Date(scan.scanned_at).toLocaleTimeString(),
      })));
    } catch (error) {
      console.error("Failed to load recent ticket scans", error);
    }
  }, []);

  const loadScanAccess = useCallback(async () => {
    try {
      const response = await API.get("/events/ticket-scan-access/");
      setScanAccess({
        loading: false,
        allowed: Boolean(response.data.allowed),
        message: response.data.message || "",
      });
    } catch (error) {
      setScanAccess({
        loading: false,
        allowed: false,
        message: error.response?.data?.detail || "Unable to check ticket-scanning access.",
      });
    }
  }, []);

  useEffect(() => {
    loadScanAccess();
    loadScanHistory();
    const intervalId = setInterval(loadScanAccess, 5000);
    window.addEventListener("focus", loadScanAccess);
    return () => {
      clearInterval(intervalId);
      window.removeEventListener("focus", loadScanAccess);
    };
  }, [loadScanAccess, loadScanHistory]);

  const verifyTicket = useCallback(async (qrData) => {
    try {
      const response = await API.post("/events/verify-ticket/", { qr_code_hash: qrData });
      const result = {
        id: response.data.ticket.id,
        status: response.data.status,
        message: response.data.message,
        holder: response.data.ticket.user_details?.username || "Unknown",
        event: response.data.ticket.event_details?.title || "Unknown",
        time: new Date().toLocaleTimeString()
      };
      setScanResult(result);
      await loadScanHistory();
    } catch (error) {
      const errorData = error.response?.data;
      const accessDenied = error.response?.status === 403;
      const result = {
        id: errorData?.ticket?.id || "N/A",
        status: errorData?.status || (accessDenied ? "Access denied" : "Error"),
        message: errorData?.message || errorData?.detail || "Verification failed.",
        holder: errorData?.ticket?.user_details?.username || "Unknown",
        event: errorData?.ticket?.event_details?.title || "Unknown",
        time: new Date().toLocaleTimeString()
      };
      setScanResult(result);
      if (error.response) {
        await loadScanHistory();
      } else {
        setScanHistory(prev => [result, ...prev].slice(0, 20));
      }
    }
  }, [loadScanHistory]);

  useEffect(() => () => {
    if (cameraRef.current?.isScanning) {
      cameraRef.current.stop().catch(() => {});
    }
    cameraRef.current?.clear();
  }, []);

  const stopCamera = useCallback(async () => {
    const camera = cameraRef.current;
    if (camera?.isScanning) await camera.stop();
    camera?.clear();
    cameraRef.current = null;
    processingRef.current = false;
    setScanning(false);
    setScanHint("");
  }, []);

  const startCamera = useCallback(async () => {
    setCameraError("");
    setScanHint("Move closer until the QR code fills about half of the camera view.");
    setScanning(true);
    try {
      if (!window.isSecureContext) {
        throw new Error(`Chrome blocked camera access on ${window.location.origin}. Open this page with HTTPS or localhost.`);
      }
      await new Promise((resolve) => {
        window.requestAnimationFrame(() => window.requestAnimationFrame(resolve));
      });
      const cameras = await Html5Qrcode.getCameras();
      if (!cameras.length) {
        throw new Error("No camera was found on this device.");
      }
      const preferredCamera = cameras.find((camera) => /back|rear|environment/i.test(camera.label)) || cameras[0];
      const camera = new Html5Qrcode("reader", {
        verbose: false,
        useBarCodeDetectorIfSupported: false,
      });
      cameraRef.current = camera;
      await camera.start(
        preferredCamera.id,
        {
          fps: 15,
          disableFlip: false,
        },
        async (decodedText) => {
          if (processingRef.current) return;
          processingRef.current = true;
          setScanHint("QR detected. Verifying ticket...");
          camera.pause(true);
          await verifyTicket(decodedText);
          window.setTimeout(() => {
            if (camera.isScanning) camera.resume();
            processingRef.current = false;
            setScanHint("Ready for the next ticket.");
          }, 1800);
        },
        () => {}
      );
      try {
        await camera.applyVideoConstraints({
          advanced: [{ focusMode: "continuous" }],
        });
      } catch {
        // Some desktop webcams do not expose focus controls.
      }
      try {
        const zoom = camera.getRunningTrackCameraCapabilities().zoomFeature();
        if (zoom.isSupported()) {
          await zoom.apply(Math.min(zoom.max(), Math.max(zoom.min(), 1.5)));
        }
      } catch {
        // Zoom is optional and unavailable on many webcams.
      }
    } catch (error) {
      cameraRef.current?.clear();
      cameraRef.current = null;
      setScanning(false);
      setScanHint("");
      setCameraError(getCameraErrorMessage(error));
    }
  }, [verifyTicket]);

  const toggleCamera = async () => {
    if (scanning) await stopCamera();
    else await startCamera();
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const html5QrCode = new Html5Qrcode("reader-hidden");
      const decodedText = await html5QrCode.scanFile(file, true);
      await verifyTicket(decodedText);
    } catch {
      setScanResult({
        status: "Error",
        message: "Could not read QR code from image. Please try a clearer image.",
        time: new Date().toLocaleTimeString()
      });
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-10">
      <DashboardPageHeader
        eyebrow="Gate scanner"
        title="Ticket Checking"
        description="Scan or upload QR passes to verify stadium entry."
        icon={QrCode}
      />

      {!scanAccess.loading && !scanAccess.allowed && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm font-semibold text-amber-800">
          {scanAccess.message}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="bg-gray-50 border-b border-gray-100 p-4 flex justify-between items-center">
              <h3 className="font-bold text-gray-900">QR Scanner</h3>
              <button
                onClick={toggleCamera}
                disabled={scanAccess.loading || !scanAccess.allowed}
                className={`px-4 py-2 rounded-xl text-sm font-bold text-white transition-colors ${
                  scanning ? "bg-red-500 hover:bg-red-600" : "bg-blue-600 hover:bg-blue-700"
                } disabled:cursor-not-allowed disabled:bg-slate-400`}
              >
                {scanning ? "Stop Camera" : "Start Camera"}
              </button>
            </div>
            
            <div className="p-4">
              <div id="reader" className={`${scanning ? "block" : "hidden"} w-full overflow-hidden rounded-xl border-2 border-gray-100`}></div>
              {!scanning && (
                <div className="aspect-square bg-gray-50 rounded-xl flex items-center justify-center border-2 border-dashed border-gray-200">
                  <p className="text-gray-400 font-medium">Camera is disabled</p>
                </div>
              )}
              {cameraError && <p className="mt-3 text-sm font-semibold text-red-700">{cameraError}</p>}
              {scanning && scanHint && <p className="mt-3 text-sm font-semibold text-blue-700">{scanHint}</p>}
            </div>
            
            <div className="p-4 border-t border-gray-100 bg-gray-50">
              <label className="block text-sm font-bold text-gray-700 mb-2">Or Upload Image</label>
              <input 
                type="file" 
                accept="image/*"
                disabled={scanAccess.loading || !scanAccess.allowed}
                onChange={handleFileUpload}
                className="w-full text-sm text-gray-500 disabled:cursor-not-allowed disabled:opacity-50 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-bold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
              <div id="reader-hidden" style={{ display: "none" }}></div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {scanResult && (
            <div className={`p-6 rounded-2xl border-2 ${
              scanResult.status === 'Valid' ? 'bg-green-50 border-green-200' :
              scanResult.status === 'Duplicate' ? 'bg-orange-50 border-orange-200' :
              'bg-red-50 border-red-200'
            }`}>
              <h3 className={`text-2xl font-black mb-2 ${
                scanResult.status === 'Valid' ? 'text-green-700' :
                scanResult.status === 'Duplicate' ? 'text-orange-700' :
                'text-red-700'
              }`}>
                {scanResult.status.toUpperCase()}
              </h3>
              <p className="text-gray-600 font-medium mb-4">{scanResult.message}</p>
              
              {scanResult.id !== "N/A" && (
                <div className="space-y-2 bg-white/50 p-4 rounded-xl">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500 font-bold">Ticket ID:</span>
                    <span className="text-gray-900 font-black">{scanResult.id}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500 font-bold">Holder:</span>
                    <span className="text-gray-900 font-black">{scanResult.holder}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500 font-bold">Event:</span>
                    <span className="text-gray-900 font-black truncate max-w-[150px]">{scanResult.event}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="bg-gray-50 border-b border-gray-100 p-4">
              <h3 className="font-bold text-gray-900">Recent Scans</h3>
            </div>
            {scanHistory.length === 0 ? (
              <div className="p-6 text-center text-gray-500 font-medium">No recent scans.</div>
            ) : (
              <div className="divide-y divide-gray-100">
                {scanHistory.slice(0, 10).map((scan, index) => (
                  <div key={scan.scanId || index} className="p-4 flex justify-between items-center hover:bg-gray-50 transition-colors">
                    <div>
                      <p className="font-bold text-gray-900 text-sm">
                        {scan.id === "N/A" ? scan.status : `Ticket ${scan.id}`}
                      </p>
                      <p className="text-xs text-gray-500 font-medium">{scan.time}{scan.holder !== "Unknown" ? ` | ${scan.holder}` : ""}</p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                      scan.status === 'Valid' ? 'bg-green-100 text-green-700' :
                      scan.status === 'Duplicate' ? 'bg-orange-100 text-orange-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {scan.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <section className="dashboard-panel overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Scan History</h2>
            <p className="mt-1 text-xs text-slate-500">Latest 50 scans for this staff account</p>
          </div>
          <span className="text-xs font-semibold text-slate-500">{scanHistory.length} records</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-xs">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-5 py-3">Ticket</th>
                <th className="px-5 py-3">Holder</th>
                <th className="px-5 py-3">Event</th>
                <th className="px-5 py-3">Result</th>
                <th className="px-5 py-3">Message</th>
                <th className="px-5 py-3">Scanned at</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {scanHistory.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-5 py-8 text-center text-sm text-slate-400">No scan history yet.</td>
                </tr>
              ) : scanHistory.map((scan, index) => (
                <tr key={scan.scanId || index} className="hover:bg-slate-50">
                  <td className="px-5 py-3 font-semibold text-slate-900">{scan.id === "N/A" ? "Unknown" : `#${scan.id}`}</td>
                  <td className="px-5 py-3 text-slate-600">{scan.holder}</td>
                  <td className="max-w-48 truncate px-5 py-3 text-slate-600">{scan.event}</td>
                  <td className="px-5 py-3"><ScanStatus status={scan.status} /></td>
                  <td className="max-w-64 truncate px-5 py-3 text-slate-500" title={scan.message}>{scan.message}</td>
                  <td className="whitespace-nowrap px-5 py-3 text-slate-500">{scan.scannedAt ? new Date(scan.scannedAt).toLocaleString() : scan.time}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function ScanStatus({ status }) {
  const className = status === "Valid"
    ? "bg-green-100 text-green-700"
    : status === "Duplicate"
      ? "bg-orange-100 text-orange-700"
      : "bg-red-100 text-red-700";
  return <span className={`inline-flex rounded-full px-2.5 py-1 font-bold ${className}`}>{status}</span>;
}

function getCameraErrorMessage(error) {
  const detail = typeof error === "string" ? error : error?.message;
  if (/notallowed|permission|denied/i.test(detail || "")) {
    return "Chrome denied camera permission. Click the camera icon in the address bar, allow camera access, then try again.";
  }
  if (/notfound|no camera|devicesnotfound/i.test(detail || "")) {
    return "No available camera was found. Close other apps using the camera, then try again.";
  }
  if (/notreadable|trackstart|could not start video/i.test(detail || "")) {
    return "The camera is busy in another tab or application. Close it there, then try again.";
  }
  return detail || "Camera could not start. Allow camera permission and use HTTPS or localhost.";
}

