import { useEffect } from "react";

export default function Toast({ type = "success", message, onClose }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className="fixed top-5 right-5 z-50 animate-fade-in">
      <div
        className={`px-5 py-3 rounded-lg shadow-lg text-white flex items-center gap-3
        ${type === "error" ? "bg-red-500" : "bg-green-600"}`}
      >
        {/* Ícono minimalista */}
        {type === "error" ? (
          <span className="text-xl">✖</span>
        ) : (
          <span className="text-xl">✓</span>
        )}

        <p className="whitespace-pre-line font-medium">{message}</p>
      </div>

      <style>
        {`
          .animate-fade-in {
            animation: fadeIn 0.2s ease-out forwards;
          }
          @keyframes fadeIn {
            from { opacity: 0; transform: translateX(10px); }
            to { opacity: 1; transform: translateX(0); }
          }
        `}
      </style>
    </div>
  );
}
