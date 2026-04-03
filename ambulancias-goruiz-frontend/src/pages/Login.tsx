import { useState } from "react";
import axios from "../api/axios";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useTranslation } from "react-i18next";
import { getApiErrorMessage } from "../utils/toast";
import PublicLayout from "../layouts/PublicLayout";

const Login = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setError("");
    setIsSubmitting(true);

    try {
      const response = await axios.post("/users/login", { email, password });
      const { token, user } = response.data;

      login(token, user._id, user.role, user);

      if (user.role === "superadmin") {
        navigate("/superadmin");
      } else if (user.role === "admin") {
        navigate("/admin");
      } else {
        navigate("/worker");
      }
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, t("pages.login.genericError")));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <PublicLayout backTo="/" backLabel={t("pages.login.back")}>
      {/* 🔹 Caja principal */}
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md bg-slate-900/95 backdrop-blur rounded-2xl shadow-lg border border-slate-800 p-8"
      >
        <h2 className="text-2xl font-bold mb-6 text-center text-white">
          {t("pages.login.title")}
        </h2>

        {error && (
          <p className="text-red-400 mb-4 text-center font-medium">{error}</p>
        )}

        {/* Email */}
        <div className="mb-4">
          <label
            htmlFor="email"
            className="block text-sm font-medium text-slate-200 mb-1"
          >
            {t("pages.login.email")}
          </label>
          <input
            id="email"
            type="email"
            placeholder={t("pages.login.email")}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-slate-300
                       bg-slate-100 text-slate-900 placeholder-slate-500
                       focus:outline-none focus:ring-2 focus:ring-blue-400"
            required
          />
        </div>

        {/* Password */}
        <div className="mb-6">
          <label
            htmlFor="password"
            className="block text-sm font-medium text-slate-200 mb-1"
          >
            {t("pages.login.password")}
          </label>
          <input
            id="password"
            type="password"
            placeholder={t("pages.login.password")}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-slate-300
                       bg-slate-100 text-slate-900 placeholder-slate-500
                       focus:outline-none focus:ring-2 focus:ring-blue-400"
            required
          />
        </div>

        {/* Botón */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-lg bg-blue-500 px-4 py-2 font-semibold text-white shadow-sm
                     hover:bg-blue-600 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-200
                     transition-all duration-200 ease-in-out disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isSubmitting ? t("pages.login.submitting") : t("pages.login.submit")}
        </button>
      </form>
    </PublicLayout>
  );
};

export default Login;
