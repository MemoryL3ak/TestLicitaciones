import { useState } from "react";
import { supabase } from "../lib/supabase";
import Toast from "../components/Toast";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [toast, setToast] = useState(null);

  async function handleLogin(e) {
    e.preventDefault();

    if (!email || !password) {
      setToast({
        type: "error",
        message: "Debes ingresar correo y contraseña.",
      });
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setToast({
        type: "error",
        message: "Credenciales incorrectas.\nVerifica tu correo y contraseña.",
      });
      return;
    }

    setToast({
      type: "success",
      message: "Bienvenido 👋🏼\nRedirigiendo...",
    });

    setTimeout(() => {
      window.location.href = "/listar";
    }, 800);
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center 
                    bg-gradient-to-br from-gray-100 to-gray-300 px-4">

      {/* TOAST */}
      {toast && (
        <Toast
          type={toast.type}
          message={toast.message}
          onClose={() => setToast(null)}
        />
      )}

      {/* 🔵 BANNER SUPERIOR (versión login) */}
      <div className="mb-8">
        <img
          src="https://i.ibb.co/5X21Zx9k/Amsodent.png"
          alt="Amsodent Logo"
          className="h-24 object-contain drop-shadow-xl"
        />
      </div>

      {/* TARJETA DE LOGIN */}
      <div className="w-full max-w-sm bg-white p-8 rounded-xl shadow-lg border border-gray-200">

        <h1 className="text-2xl font-semibold text-center text-gray-800 mb-6">
          Iniciar Sesión
        </h1>

        <form onSubmit={handleLogin} className="space-y-5">

          {/* CORREO */}
          <div>
            <label className="text-sm text-gray-700 font-medium">
              Correo Electrónico
            </label>
            <input
              type="email"
              className="w-full mt-1 border border-gray-300 rounded-lg px-3 py-2
                       focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="correo@ejemplo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          {/* CONTRASEÑA */}
          <div>
            <label className="text-sm text-gray-700 font-medium">
              Contraseña
            </label>
            <input
              type="password"
              className="w-full mt-1 border border-gray-300 rounded-lg px-3 py-2
                       focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {/* BOTÓN */}
          <button
            type="submit"
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium 
                     hover:bg-blue-700 transition cursor-pointer"
          >
            Ingresar
          </button>
        </form>
      </div>
    </div>
  );
}
