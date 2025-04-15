import { useState, useEffect } from "react";
import { gapi } from "gapi-script";
import { findOrCreateFolder, saveAttendanceData, getAttendanceData } from "../services/googleDrive";
import { auth } from "../firebase";
import { useNavigate } from "react-router-dom";

const Dashboard = () => {
  const [workers, setWorkers] = useState([]);
  const [newWorker, setNewWorker] = useState("");
  const [attendance, setAttendance] = useState([]);
  const [fileId, setFileId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const today = new Date().toISOString().split("T")[0];

  // Fungsi untuk memuat data dari localStorage
  const loadLocalData = () => {
    console.log("Mencoba memuat data dari localStorage...");
    const savedData = localStorage.getItem("attendanceData");
    if (savedData) {
      try {
        const parsed = JSON.parse(savedData);
        if (Array.isArray(parsed.workers) && Array.isArray(parsed.attendance)) {
          console.log("Data localStorage valid:", parsed);
          return {
            workers: parsed.workers,
            attendance: parsed.attendance,
          };
        } else {
          console.warn("Data localStorage tidak valid, mengembalikan null");
          return null;
        }
      } catch (err) {
        console.error("Gagal parse data localStorage:", err);
        return null;
      }
    }
    console.log("Tidak ada data di localStorage");
    return null;
  };

  // Fungsi untuk menyimpan data ke localStorage
  const saveLocalData = (workersData, attendanceData) => {
    try {
      const data = { workers: workersData, attendance: attendanceData };
      localStorage.setItem("attendanceData", JSON.stringify(data));
      console.log("Data disimpan ke localStorage:", data);
    } catch (err) {
      console.error("Gagal menyimpan data lokal:", err);
      setError("Gagal menyimpan data lokal. Silakan coba lagi.");
    }
  };

  useEffect(() => {
    const initData = async () => {
      try {
        setLoading(true);
        console.log("Memulai inisialisasi data...");

        // Coba muat data dari localStorage terlebih dahulu
        const localData = loadLocalData();
        if (localData) {
          console.log("Memuat data dari localStorage:", localData);
          setWorkers(localData.workers);
          setAttendance(localData.attendance);
          const storedFileId = localStorage.getItem("fileId");
          if (storedFileId) {
            console.log("File ID dari localStorage:", storedFileId);
            setFileId(storedFileId);
          }
          setLoading(false);
          return;
        }

        // Jika tidak ada data lokal, muat dari Google Drive
        console.log("Tidak ada data lokal, memuat dari Google Drive...");
        const folderId = await findOrCreateFolder("AbsensiApp");
        console.log("Folder ID:", folderId);

        console.log("Mencari file attendance.json...");
        const response = await gapi.client.drive.files.list({
          q: `'${folderId}' in parents and name='attendance.json' and trashed=false`,
          fields: "files(id, name)",
        });
        console.log("Hasil pencarian file:", response.result);

        let fileId;
        if (response.result.files.length > 0) {
          console.log("File ditemukan, mengambil data...");
          fileId = response.result.files[0].id;
          const data = await getAttendanceData(fileId);
          console.log("Data dari file:", data);
          setWorkers(data.workers || []);
          setAttendance(data.attendance || []);
          saveLocalData(data.workers || [], data.attendance || []);
        } else {
          console.log("File tidak ditemukan, membuat file baru...");
          fileId = await saveAttendanceData(null, "attendance.json", {
            workers: [],
            attendance: [],
            parents: [folderId],
          });
          console.log("File baru dibuat dengan ID:", fileId);
          saveLocalData([], []);
        }
        setFileId(fileId);
        localStorage.setItem("fileId", fileId);
      } catch (err) {
        console.error("Error inisialisasi data:", err);
        let errorMessage = "Gagal memuat data.";
        if (err.message === "ACCOUNT_MISMATCH") {
          errorMessage = "Akun Google Drive tidak cocok dengan akun login. Silakan gunakan akun yang sama.";
        } else if (err.error && err.error.errors) {
          errorMessage += ` ${err.error.errors[0].message}`;
        } else if (err.message) {
          errorMessage += ` ${err.message}`;
        } else {
          errorMessage += " Silakan coba lagi.";
        }
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    };
    initData();
  }, []);

  const addWorker = () => {
    if (!newWorker) {
      setError("Nama pekerja tidak boleh kosong.");
      return;
    }
    try {
      console.log("Menambahkan pekerja:", newWorker);
      const updatedWorkers = [...workers, newWorker];
      setWorkers(updatedWorkers);
      saveLocalData(updatedWorkers, attendance);
      setNewWorker("");
      setError(null);
      console.log("Pekerja berhasil ditambahkan ke lokal");
    } catch (err) {
      console.error("Error menambah pekerja:", err);
      setError(`Gagal menambah pekerja: ${err.message || "Unknown error"}`);
    }
  };

  const markAttendance = (worker) => {
    try {
      console.log("Menandai absensi untuk:", worker);
      const updatedAttendance = [...attendance, { worker, date: today, status: "Hadir" }];
      setAttendance(updatedAttendance);
      saveLocalData(workers, updatedAttendance);
      setError(null);
      console.log("Absensi berhasil ditambahkan ke lokal");
    } catch (err) {
      console.error("Error menandai absensi:", err);
      setError(`Gagal menandai absensi: ${err.message || "Unknown error"}`);
    }
  };

  const getAnalytics = () => {
    const result = {};
    workers.forEach((worker) => {
      result[worker] = attendance.filter((a) => a.worker === worker && a.status === "Hadir").length;
    });
    return result;
  };

  const signOut = async () => {
    try {
      console.log("Melakukan logout...");
      if (fileId) {
        console.log("Menyinkronkan data ke Google Drive sebelum logout...");
        await saveAttendanceData(fileId, "attendance.json", { workers, attendance });
        console.log("Data berhasil disimpan ke Google Drive");
      } else {
        console.warn("File ID tidak tersedia, data tidak disimpan ke Google Drive");
      }
      localStorage.removeItem("attendanceData");
      localStorage.removeItem("fileId");
      await auth.signOut();
      navigate("/");
      console.log("Logout berhasil");
    } catch (err) {
      console.error("Error logout:", err);
      setError(`Gagal logout: ${err.message || "Unknown error"}`);
    }
  };

  if (loading) {
    return <div style={{ padding: "20px" }}>Memuat...</div>;
  }

  if (error) {
    return (
      <div style={{ padding: "20px" }}>
        <h2>Error</h2>
        <p>{error}</p>
        <button onClick={() => window.location.reload()}>Coba Lagi</button>
      </div>
    );
  }

  return (
    <div style={{ padding: "20px" }}>
      <h2>Dashboard Absensi</h2>
      <button onClick={signOut}>Logout</button>
      <div>
        <h3>Tambah Pekerja</h3>
        <input
          type="text"
          value={newWorker}
          onChange={(e) => setNewWorker(e.target.value)}
          placeholder="Nama pekerja"
        />
        <button onClick={addWorker}>Tambah</button>
      </div>
      <div>
        <h3>Absensi Harian ({today})</h3>
        <ul>
          {workers.map((worker, index) => (
            <li key={index}>
              {worker}{" "}
              <button
                onClick={() => markAttendance(worker)}
                disabled={attendance.some((a) => a.worker === worker && a.date === today)}
              >
                Hadir
              </button>
            </li>
          ))}
        </ul>
      </div>
      <div>
        <h3>Analitik</h3>
        <ul>
          {Object.entries(getAnalytics()).map(([worker, days]) => (
            <li key={worker}>
              {worker}: {days} hari
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default Dashboard;