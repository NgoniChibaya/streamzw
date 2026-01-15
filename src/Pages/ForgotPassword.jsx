import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Fade } from "react-reveal";
import { ClipLoader } from "react-spinners";
import { getAuth, sendPasswordResetEmail } from "firebase/auth";
import WelcomePageBanner from "../images/WelcomBannerNew.png";

function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loader, setLoader] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoader(true);
    setError("");
    setMessage("");

    const auth = getAuth();
    try {
      await sendPasswordResetEmail(auth, email);
      setMessage("Password reset email sent! Check your inbox.");
      setEmail("");
    } catch (error) {
      if (error.code === "auth/user-not-found") {
        setError("No account found with this email");
      } else if (error.code === "auth/invalid-email") {
        setError("Invalid email address");
      } else {
        setError(error.message);
      }
    } finally {
      setLoader(false);
    }
  };

  return (
    <section
      className="h-[100vh] bg-gray-50 dark:bg-gray-900"
      style={{
        background: `linear-gradient(0deg, hsl(0deg 0% 0% / 73%) 0%, hsl(0deg 0% 0% / 73%) 35%),url(${WelcomePageBanner})`,
      }}
    >
      <div className="h-[100vh] flex flex-col items-center justify-center px-6 py-8 mx-auto md:h-screen lg:py-0">
        <div className="w-full bg-[#000000a2] rounded-lg shadow sm:my-0 md:mt-0 sm:max-w-md xl:p-0 sm:p-8 border-2 border-stone-800 lg:border-0">
          <Fade>
            <div className="p-4 space-y-4 md:space-y-6 sm:p-8">
              <h1 className="text-lg font-bold leading-tight tracking-tight text-white md:text-xl">
                Reset your password
              </h1>
              <p className="text-sm text-gray-400">
                Enter your email address and we'll send you a link to reset your password.
              </p>
              
              <form onSubmit={handleSubmit} className="space-y-4 md:space-y-6">
                <div>
                  <label
                    htmlFor="email"
                    className="block mb-2 text-sm font-medium text-white"
                  >
                    Your email
                  </label>
                  <input
                    type="email"
                    name="email"
                    id="email"
                    value={email}
                    className="bg-stone-700 text-white sm:text-sm rounded-sm focus:ring-transparent focus:border-transparent block w-full p-2.5 placeholder:text-white"
                    placeholder="name@email.com"
                    required
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>

                {message && (
                  <div className="flex text-white font-bold p-4 bg-green-700 rounded text-center">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                      stroke="currentColor"
                      className="w-6 h-6 mr-2"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    {message}
                  </div>
                )}

                {error && (
                  <div className="flex text-white font-bold p-4 bg-transparent border border-stone-700 rounded text-center">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                      stroke="currentColor"
                      className="w-6 h-6 mr-1"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
                      />
                    </svg>
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  className={`w-full text-white ${
                    loader
                      ? `bg-stone-700`
                      : `focus:ring-0 focus:outline-none transition ease-in-out font-medium rounded-sm text-sm px-5 py-2.5 text-center`
                  }`}
                  style={{
                    backgroundColor: loader ? undefined : "#5b7ea4",
                  }}
                  disabled={loader}
                >
                  {loader ? <ClipLoader color="#5b7ea4" /> : `Send Reset Link`}
                </button>

                <p className="text-sm font-light text-gray-500 dark:text-gray-400">
                  Remember your password?{" "}
                  <Link
                    className="font-medium text-white hover:underline"
                    to={"/signin"}
                  >
                    Sign in
                  </Link>
                </p>
              </form>
            </div>
          </Fade>
        </div>
      </div>
    </section>
  );
}

export default ForgotPassword;
