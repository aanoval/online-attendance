import { useEffect, useState } from "react";
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import { auth } from "./firebase";
import { initGoogleDrive } from "./services/googleDrive";
import Login from "./components/Login";
import Dashboard from "./components/Dashboard";

function App() {
  const [user, setUser] = useState(null);
  const [gapiReady, setGapiReady] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    auth.onAuthStateChanged(async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        try {
          console.log("Memulai inisialisasi Google Drive untuk:", firebaseUser.email);
          await initGoogleDrive(firebaseUser.email);
          console.log("Inisialisasi Google Drive berhasil");
          setGapiReady(true);
        } catch (err) {
          console.error("Error menginisialisasi Google Drive:", err);
          let errorMessage = "Gagal menginisialisasi Google Drive.";
          if (err.message === "ACCOUNT_MISMATCH") {
            errorMessage = "Akun Google Drive tidak cocok dengan akun login. Silakan gunakan akun yang sama.";
          } else if (err.error && err.error.errors) {
            errorMessage += ` ${err.error.errors[0].message}`;
          } else if (err.message) {
            errorMessage += ` ${err.message}`;
          }
          setError(errorMessage);
        }
      } else {
        setGapiReady(false);
      }
    });
  }, []);

  if (error) {
    return (
      <div style={{ padding: "20px", textAlign: "center" }}>
        <h2>Error</h2>
        <p>{error}</p>
        <button onClick={() => window.location.reload()}>Coba Lagi</button>
      </div>
    );
  }

  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />
        {user && gapiReady && <Route path="/dashboard" element={<Dashboard />} />}
      </Routes>
    </Router>
  );
}

export default App;