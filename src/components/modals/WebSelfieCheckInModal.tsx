import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, X, LogIn, LogOut, MapPin, Send } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../hooks/useAuth";
import { notifyAdmins, notifyProfile } from "../../lib/notify";
import type { CompanyLocation } from "../../types";

// A first GPS fix can be a stale/cached, low-accuracy reading even on the
// web Geolocation API — don't trust it until accuracy is within this radius.
// Mirrors the mobile app's SelfieCheckInModal.tsx threshold exactly.
const LOCATION_ACCURACY_THRESHOLD_METERS = 50;

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// RULE 1: Check-in before 11:00 AM -> Present. RULE 2: after -> Late.
// RULE 3: Late + worked 8+ hours -> Present (override). RULE 4: Late + 4-8h -> Half Day.
// RULE 5: Late + <4h -> Absent. Mirrors mobile's computeWorkStatus exactly.
function computeWorkStatus(checkInISO: string, checkOutISO: string) {
  const checkIn = new Date(checkInISO);
  const checkOut = new Date(checkOutISO);
  const totalHours = (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60);
  const roundedHours = Math.round(totalHours * 100) / 100;
  const isLate = checkIn.getHours() > 11 || (checkIn.getHours() === 11 && checkIn.getMinutes() > 0);

  let attendance_status: string;
  if (!isLate) attendance_status = "present";
  else if (roundedHours >= 8) attendance_status = "present";
  else if (roundedHours >= 4) attendance_status = "half_day";
  else attendance_status = "absent";

  return { attendance_status, total_hours: roundedHours };
}

interface TodayRecord {
  id: string;
  check_in: string;
  check_out: string | null;
  attendance_mode?: string | null;
}

type AttendanceState = "loading" | "no_record" | "checked_in" | "completed" | "error";
type RemoteStatus = "pending" | "rejected" | null;

interface Props {
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function WebSelfieCheckInModal({ visible, onClose, onSuccess }: Props) {
  const { user } = useAuth();
  const profile = user?.profile;

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [attendanceState, setAttendanceState] = useState<AttendanceState>("loading");
  const [todayRecord, setTodayRecord] = useState<TodayRecord | null>(null);
  const [officeLocation, setOfficeLocation] = useState<CompanyLocation | null>(null);

  const [insideOffice, setInsideOffice] = useState(false);
  const [distance, setDistance] = useState<number | null>(null);
  const [currentCoords, setCurrentCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locationReady, setLocationReady] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [uploadStep, setUploadStep] = useState("");

  const [remoteStatus, setRemoteStatus] = useState<RemoteStatus>(null);
  const [remoteRejectNote, setRemoteRejectNote] = useState<string | null>(null);

  const locationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const remotePollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Load today's attendance state + office location + camera + GPS ──────
  const loadTodayState = useCallback(async () => {
    if (!profile) return;
    const today = new Date().toISOString().split("T")[0];
    const { data, error } = await supabase
      .from("attendance")
      .select("id, check_in, check_out, attendance_mode")
      .eq("employee_id", profile.id)
      .eq("attendance_date", today)
      .maybeSingle();

    if (error) {
      setAttendanceState("error");
      return;
    }
    if (!data) {
      setTodayRecord(null);
      setAttendanceState("no_record");
    } else if (!data.check_out) {
      setTodayRecord(data);
      setAttendanceState("checked_in");
    } else {
      setTodayRecord(data);
      setAttendanceState("completed");
    }

    const { data: reqData } = await supabase
      .from("attenote_work_requests")
      .select("status, admin_note")
      .eq("employee_id", profile.id)
      .eq("from_date", today)
      .eq("is_attendance_request", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (reqData?.status === "pending") setRemoteStatus("pending");
    else if (reqData?.status === "rejected") {
      setRemoteStatus("rejected");
      setRemoteRejectNote(reqData.admin_note ?? null);
    } else {
      setRemoteStatus(null);
    }
  }, [profile]);

  const loadOfficeLocation = useCallback(async () => {
    if (!profile) return;
    const { data } = await supabase
      .from("company_locations")
      .select("*")
      .eq("company_id", profile.company_id)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();
    setOfficeLocation(data as CompanyLocation | null);
  }, [profile]);

  const checkLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationError("Your browser doesn't support location access.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocationError(null);
        const { latitude, longitude, accuracy } = pos.coords;
        setCurrentCoords({ lat: latitude, lng: longitude });
        if (officeLocation) {
          const dist = haversineDistance(officeLocation.latitude, officeLocation.longitude, latitude, longitude);
          setDistance(Math.round(dist));
          setInsideOffice(dist <= officeLocation.radius_in_meters);
          if (accuracy <= LOCATION_ACCURACY_THRESHOLD_METERS) setLocationReady(true);
        } else {
          setInsideOffice(true);
          setDistance(null);
          setLocationReady(true);
        }
      },
      (err) => {
        setLocationError(err.code === err.PERMISSION_DENIED
          ? "Location permission is required — enable it in your browser settings."
          : "Couldn't get your location. Retrying…");
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 },
    );
  }, [officeLocation]);

  // Start camera stream
  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraReady(true);
      setCameraError(null);
    } catch {
      setCameraError("Camera permission is required to clock in/out.");
    }
  }, []);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraReady(false);
  }, []);

  useEffect(() => {
    if (!visible) {
      if (locationIntervalRef.current) clearInterval(locationIntervalRef.current);
      if (remotePollRef.current) clearInterval(remotePollRef.current);
      Promise.resolve().then(() => {
        stopCamera();
        setLocationReady(false);
        setLocationError(null);
        setAttendanceState("loading");
      });
      return;
    }
    Promise.resolve().then(() => {
      loadOfficeLocation();
      loadTodayState();
      checkLocation();
      startCamera();
    });
    locationIntervalRef.current = setInterval(checkLocation, 6000);
    return () => {
      if (locationIntervalRef.current) clearInterval(locationIntervalRef.current);
      stopCamera();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // Poll for admin decision while a remote-work request is pending
  useEffect(() => {
    if (!visible || remoteStatus !== "pending") return;
    remotePollRef.current = setInterval(() => loadTodayState(), 8000);
    return () => { if (remotePollRef.current) clearInterval(remotePollRef.current); };
  }, [visible, remoteStatus, loadTodayState]);

  const uploadSelfie = async (blob: Blob, suffix: "checkin" | "checkout"): Promise<string> => {
    setUploadStep("Uploading selfie…");
    const today = new Date().toISOString().split("T")[0];
    const fileName = `${today}_${suffix}_${Date.now()}.jpg`;
    const filePath = `${profile!.id}/${fileName}`;
    const { error: uploadError } = await supabase.storage.from("selfies").upload(filePath, blob, {
      contentType: "image/jpeg",
      upsert: false,
    });
    if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);
    const { data: urlData } = supabase.storage.from("selfies").getPublicUrl(filePath);
    return urlData.publicUrl;
  };

  const captureFrame = (): Promise<Blob> =>
    new Promise((resolve, reject) => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas) { reject(new Error("Camera not ready.")); return; }
      const width = 600;
      const height = Math.round((video.videoHeight / video.videoWidth) * width) || 450;
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) { reject(new Error("Canvas not supported.")); return; }
      ctx.translate(width, 0);
      ctx.scale(-1, 1); // mirror, since the preview is a front-facing camera
      ctx.drawImage(video, 0, 0, width, height);
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Capture failed."))), "image/jpeg", 0.6);
    });

  const finalizeAttendance = async (selfieUrl: string) => {
    try {
      const now = new Date();
      const today = now.toISOString().split("T")[0];

      if (attendanceState === "no_record") {
        const { data: existing } = await supabase
          .from("attendance").select("id").eq("employee_id", profile!.id).eq("attendance_date", today).maybeSingle();
        if (existing) { alert("You have already clocked in today."); await loadTodayState(); return; }

        const isLate = now.getHours() > 11 || (now.getHours() === 11 && now.getMinutes() > 0);
        const { error: insertError } = await supabase.from("attendance").insert({
          employee_id: profile!.id,
          attendance_date: today,
          check_in: now.toISOString(),
          check_in_selfie: selfieUrl,
          attendance_status: isLate ? "late_login" : "present",
          attendance_mode: insideOffice ? "office" : "remote",
          check_in_location: currentCoords ? `POINT(${currentCoords.lng} ${currentCoords.lat})` : null,
        });
        if (insertError) {
          if (insertError.code === "23505") { alert("You have already clocked in today."); await loadTodayState(); return; }
          throw new Error(insertError.message);
        }

        onSuccess?.();
        onClose();
        notifyProfile(profile!.id, "Clocked In ✅", `Recorded at ${now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}.`, "attendance");
        if (isLate && profile?.company_id) {
          notifyAdmins(profile.company_id, "Late Clock-In", `${profile.full_name} clocked in late at ${now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}.`, "attendance");
        }
      } else if (attendanceState === "checked_in" && todayRecord) {
        if (todayRecord.check_out) { alert("You have already clocked out today."); await loadTodayState(); return; }
        const { attendance_status: finalStatus, total_hours } = computeWorkStatus(todayRecord.check_in, now.toISOString());
        const { error: updateError } = await supabase.from("attendance").update({
          check_out: now.toISOString(),
          check_out_selfie: selfieUrl,
          attendance_status: finalStatus,
          check_out_location: currentCoords ? `POINT(${currentCoords.lng} ${currentCoords.lat})` : null,
        }).eq("id", todayRecord.id).is("check_out", null);
        if (updateError) throw new Error(updateError.message);

        onSuccess?.();
        onClose();
        notifyProfile(profile!.id, "Clocked Out ✅", `Work hours: ${total_hours.toFixed(1)}h.`, "attendance");
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
      setUploadStep("");
    }
  };

  const handleCapture = async () => {
    if (submitting || !insideOffice || !cameraReady || attendanceState === "completed") return;
    setSubmitting(true);
    setUploadStep("Capturing photo…");
    try {
      const blob = await captureFrame();
      const selfieUrl = await uploadSelfie(blob, attendanceState === "no_record" ? "checkin" : "checkout");
      await finalizeAttendance(selfieUrl);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Something went wrong.");
      setSubmitting(false);
      setUploadStep("");
    }
  };

  const requestRemoteWork = async () => {
    if (submitting || !cameraReady || !profile) return;
    setSubmitting(true);
    setUploadStep("Capturing photo…");
    try {
      const blob = await captureFrame();
      const selfieUrl = await uploadSelfie(blob, "checkin");
      const today = new Date().toISOString().split("T")[0];
      setUploadStep("Sending request…");
      const { error: insertError } = await supabase.from("attenote_work_requests").insert({
        employee_id: profile.id,
        request_type: "remote_work",
        from_date: today,
        to_date: today,
        reason: `Outside office geofence (${distance ?? "?"}m away)`,
        selfie_url: selfieUrl,
        request_latitude: currentCoords?.lat ?? null,
        request_longitude: currentCoords?.lng ?? null,
        is_attendance_request: true,
      });
      if (insertError) throw new Error(insertError.message);
      if (profile.company_id) {
        notifyAdmins(profile.company_id, "Remote Clock-In Request", `${profile.full_name} requested remote clock-in (${distance ?? "?"}m from office).`, "attendance");
      }
      setRemoteStatus("pending");
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to send request.");
    } finally {
      setSubmitting(false);
      setUploadStep("");
    }
  };

  if (!visible) return null;

  const isCheckIn = attendanceState === "no_record";
  const isCheckOut = attendanceState === "checked_in";
  const officeRequired = isCheckIn || todayRecord?.attendance_mode !== "remote";
  const showRemoteRequest = isCheckIn && !insideOffice;
  const blocked = submitting || !cameraReady || !locationReady || (!showRemoteRequest && officeRequired && !insideOffice);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="relative w-full max-w-sm glass-card rounded-3xl overflow-hidden">
        <button onClick={onClose} className="absolute top-3 right-3 z-10 p-2 bg-black/40 rounded-full text-white hover:bg-black/60 transition-colors">
          <X size={18} />
        </button>

        {attendanceState === "loading" ? (
          <div className="flex flex-col items-center justify-center h-96 gap-3">
            <div className="w-8 h-8 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
            <p className="text-sm text-gray-400">Checking attendance…</p>
          </div>
        ) : attendanceState === "completed" ? (
          <div className="p-8 text-center">
            <div className="w-16 h-16 rounded-2xl bg-green-500/15 flex items-center justify-center mx-auto mb-4">
              <LogOut size={28} className="text-green-400" />
            </div>
            <h2 className="text-lg font-bold text-gray-100 mb-1">Attendance Complete</h2>
            <p className="text-sm text-gray-400 mb-5">Your attendance for today is fully recorded.</p>
            <div className="flex justify-around text-sm mb-6">
              <div>
                <p className="text-xs text-gray-500">Clock-In</p>
                <p className="font-semibold text-gray-100">{todayRecord?.check_in ? new Date(todayRecord.check_in).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Clock-Out</p>
                <p className="font-semibold text-gray-100">{todayRecord?.check_out ? new Date(todayRecord.check_out).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}</p>
              </div>
            </div>
            <button onClick={onClose} className="w-full bg-white/10 hover:bg-white/15 text-gray-100 rounded-xl py-2.5 text-sm font-medium transition-colors">Close</button>
          </div>
        ) : remoteStatus === "pending" ? (
          <div className="p-8 text-center">
            <div className="w-8 h-8 border-2 border-yellow-500/30 border-t-yellow-500 rounded-full animate-spin mx-auto mb-4" />
            <h2 className="text-lg font-bold text-gray-100 mb-1">Awaiting Approval</h2>
            <p className="text-sm text-gray-400 mb-5">Your remote clock-in request has been sent to the admin with your selfie and location. You'll be clocked in automatically once approved.</p>
            <button onClick={onClose} className="w-full bg-white/10 hover:bg-white/15 text-gray-100 rounded-xl py-2.5 text-sm font-medium transition-colors">Close</button>
          </div>
        ) : remoteStatus === "rejected" ? (
          <div className="p-8 text-center">
            <div className="w-16 h-16 rounded-2xl bg-red-500/15 flex items-center justify-center mx-auto mb-4">
              <X size={28} className="text-red-400" />
            </div>
            <h2 className="text-lg font-bold text-gray-100 mb-1">Request Rejected</h2>
            <p className="text-sm text-gray-400 mb-5">{remoteRejectNote || "Your remote clock-in request was not approved. Please clock in from the office."}</p>
            <button onClick={() => { setRemoteStatus(null); loadTodayState(); }} className="w-full bg-white/10 hover:bg-white/15 text-gray-100 rounded-xl py-2.5 text-sm font-medium transition-colors">Try Again</button>
          </div>
        ) : (
          <>
            <div className="relative bg-black aspect-[3/4]">
              <video ref={videoRef} muted playsInline className="w-full h-full object-cover scale-x-[-1]" />
              <canvas ref={canvasRef} className="hidden" />
              {!cameraReady && !cameraError && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                </div>
              )}
              {cameraError && (
                <div className="absolute inset-0 flex items-center justify-center p-6 text-center">
                  <p className="text-sm text-red-300">{cameraError}</p>
                </div>
              )}
              {/* Top badges */}
              <div className="absolute top-3 left-3 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold"
                style={{ backgroundColor: insideOffice ? "rgba(74,222,128,0.18)" : "rgba(248,113,113,0.18)", color: insideOffice ? "#4ade80" : "#f87171" }}>
                <MapPin size={12} />
                {insideOffice ? "In Office" : `${distance ?? "…"}m away`}
              </div>
              <div className="absolute top-3 right-12 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold"
                style={{ backgroundColor: isCheckOut ? "rgba(220,38,38,0.25)" : "rgba(37,99,235,0.25)", color: isCheckOut ? "#f87171" : "#60a5fa" }}>
                {isCheckOut ? <LogOut size={12} /> : <LogIn size={12} />}
                {isCheckOut ? "Clock Out" : "Clock In"}
              </div>
            </div>

            <div className="p-5">
              {locationError ? (
                <p className="text-xs text-yellow-400 mb-3 text-center">{locationError}</p>
              ) : !locationReady ? (
                <p className="text-xs text-yellow-400 mb-3 text-center">Fetching your location…</p>
              ) : !insideOffice && (
                <p className="text-xs text-yellow-400 mb-3 text-center">
                  {showRemoteRequest
                    ? `You're ${distance ?? "?"}m from office — request remote clock-in below`
                    : `Must be within ${officeLocation?.radius_in_meters ?? 100}m of office`}
                </p>
              )}

              <button
                onClick={showRemoteRequest ? requestRemoteWork : handleCapture}
                disabled={blocked}
                className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-colors ${
                  blocked ? "bg-white/5 text-gray-500" : showRemoteRequest ? "bg-amber-600 hover:bg-amber-500 text-white" : isCheckOut ? "bg-red-600 hover:bg-red-500 text-white" : "bg-indigo-600 hover:bg-indigo-500 text-white"
                }`}
              >
                {submitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    {uploadStep || "Processing…"}
                  </>
                ) : showRemoteRequest ? (
                  <><Send size={16} /> Request Remote Work</>
                ) : (
                  <><Camera size={16} /> {isCheckOut ? "Capture Clock-Out Selfie" : "Capture Clock-In Selfie"}</>
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
