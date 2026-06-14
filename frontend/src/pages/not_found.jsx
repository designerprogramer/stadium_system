import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-6">
      <div className="w-full max-w-lg rounded-2xl bg-white border border-gray-200 shadow-sm p-10 text-center">
        <p className="text-sm font-semibold tracking-wide text-gray-500">404</p>
        <h1 className="mt-2 text-3xl font-bold text-gray-900">Page not found</h1>
        <p className="mt-3 text-gray-600">
          The page you are trying to open does not exist.
        </p>
        <Link
          to="/register"
          className="inline-block mt-7 rounded-xl bg-[#3b71ca] px-5 py-3 text-white font-medium hover:opacity-95"
        >
          Go to homepage
        </Link>
      </div>
    </div>
  );
}
