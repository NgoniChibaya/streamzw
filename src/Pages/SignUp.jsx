import React from "react";
import { useState, useContext } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Fade } from "react-reveal";
import {
  getAuth,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
} from "firebase/auth";
import { setDoc, doc } from "firebase/firestore";
import { db } from "../Firebase/FirebaseConfig";
import { AuthContext } from "../Context/UserContext";
import { ClipLoader } from "react-spinners";
import WelcomePageBanner from "../images/WelcomBannerNew.png";
import axios from "axios"; // Import axios for making HTTP requests

function SignUp() {
  const { User, setUser } = useContext(AuthContext);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [ErrorMessage, setErrorMessage] = useState("");
  const [loader, setLoader] = useState(false);
  const [captchaToken, setCaptchaToken] = useState("");
  const captchaRendered = React.useRef(false);

  React.useEffect(() => {
    window.onCaptchaSuccess = (token) => {
      setCaptchaToken(token);
    };
    
    // Render reCAPTCHA only once
    if (window.grecaptcha && !captchaRendered.current) {
      const interval = setInterval(() => {
        if (window.grecaptcha.render && document.getElementById('recaptcha-signup')) {
          window.grecaptcha.render('recaptcha-signup', {
            'sitekey': '6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI',
            'callback': (token) => setCaptchaToken(token)
          });
          captchaRendered.current = true;
          clearInterval(interval);
        }
      }, 100);
    }
  }, []);

  const navigate = useNavigate();

  const handleSubmit = async (e) => { // Made handleSubmit async
    e.preventDefault();
    
    if (!captchaToken) {
      setErrorMessage("Please complete the captcha");
      return;
    }
    
    setLoader(true);
    setErrorMessage(""); // Clear previous errors

    if (password !== confirmPassword) {
      setErrorMessage("Passwords do not match");
      setLoader(false);
      return;
    }

    if (password.length < 7) {
      setErrorMessage("Password must be at least 7 characters");
      setLoader(false);
      return;
    }

    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
      setErrorMessage("Password must contain uppercase, lowercase, and number");
      setLoader(false);
      return;
    }

    const auth = getAuth();
    try {
      // 1. Create user with Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const firebaseUser = userCredential.user;

      // 2. Get Firebase ID Token
      const idToken = await firebaseUser.getIdToken();

      onAuthStateChanged(auth, (user) => {
          const EmptyArray = [];
          setDoc(doc(db, "Users", user.uid), {
            email: email,
            Uid: user.uid,
          }).then(() => {
            setDoc(
              doc(db, "MyList", user.uid),
              {
                movies: EmptyArray,
              },
              { merge: true }
            ).then(() => {
              setDoc(
                doc(db, "WatchedMovies", user.uid),
                {
                  movies: EmptyArray,
                },
                { merge: true }
              );
              setDoc(
                doc(db, "LikedMovies", user.uid),
                {
                  movies: EmptyArray,
                },
                { merge: true }
              );



              
            });
          });
        });

      // 3. Send Firebase ID Token to Django backend for registration/login
      const djangoRegisterResponse = await axios.post(
        "http://localhost:8000/api/firebase-register/", // **CHANGE THIS URL**
        {
          id_token: idToken,
          password: password, // Optionally send password if needed
          email: firebaseUser.email, // Optionally send email again for convenience
        }
      );

      console.log("Django registration successful:", djangoRegisterResponse.data);

      // Store Django token and user data securely
      localStorage.setItem('django_token', djangoRegisterResponse.data.token);
      localStorage.setItem('django_user_id', djangoRegisterResponse.data.user_id);

      // 4. Continue with Firebase Firestore operations (your existing code)
      //    Note: onAuthStateChanged here might be redundant if userCredential.user is already available
      //    and it's generally better to set user context/data after ALL operations are complete.

      // 5. Update user context and navigate
      setUser(firebaseUser); // Assuming your UserContext needs the Firebase user object
      navigate("/");

    } catch (error) {
      setLoader(false);
      if (error.code) {
        setErrorMessage(error.message); // Firebase errors
      } else if (error.response && error.response.data) {
        setErrorMessage(error.response.data.detail || "Django registration failed."); // Django errors
      } else {
        setErrorMessage("An unexpected error occurred.");
      }
      console.error("Signup error:", error);
    } finally {
      setLoader(false);
    }
  };

  return (
    <section
      className="h-[100vh] bg-gray-500"
      style={{
        background: `linear-gradient(0deg, hsl(0deg 0% 0% / 73%) 0%, hsl(0deg 0% 0% / 73%) 35%),url(${WelcomePageBanner})`,
      }}
    >
      <div className="h-[100vh] flex flex-col items-center justify-center px-6 py-8 mx-auto md:h-screen lg:py-0">
        <div className="w-full bg-[#000000a2] rounded-lg shadow sm:my-0 md:mt-0 sm:max-w-lg xl:p-0 border-2 border-stone-800 lg:border-0">
          <Fade>
            <div>
              <div className="p-6 space-y-4 md:space-y-6 sm:p-12">
                <h1 className="text-xl font-bold leading-tight tracking-tight text-white md:text-2xl dark:text-white">
                  Create a new account
                </h1>
                <form
                  onSubmit={handleSubmit}
                  className="space-y-4 md:space-y-6"
                >
                  <div>
                    <label
                      htmlFor="email" // Changed 'for' to 'htmlFor' for React
                      className="block mb-2 text-sm font-medium text-white dark:text-white"
                    >
                      Your email
                    </label>
                    <input
                      onChange={(e) => setEmail(e.target.value)}
                      type="email"
                      name="email"
                      id="email"
                      className={
                        ErrorMessage
                          ? "bg-stone-700 text-white sm:text-sm rounded-sm border-2 border-red-700 focus:ring-primary-600 focus:border-primary-600 block w-full p-2.5 dark:text-white "
                          : "bg-stone-700 text-white sm:text-sm rounded-sm focus:ring-primary-600 focus:border-primary-600 block w-full p-2.5 dark:text-white "
                      }
                      placeholder="name@email.com" // Corrected typo
                      required
                    ></input>
                  </div>
                  <div>
                    <label
                      htmlFor="password" // Changed 'for' to 'htmlFor' for React
                      className="block mb-2 text-sm font-medium text-white dark:text-white"
                    >
                      Password
                    </label>
                    <input
                      onChange={(e) => setPassword(e.target.value)}
                      type="password"
                      name="password"
                      id="password"
                      placeholder="••••••••"
                      className={
                        ErrorMessage
                          ? "bg-stone-700 text-white sm:text-sm rounded-sm border-2 border-red-700 focus:ring-primary-600 focus:border-primary-600 block w-full p-2.5"
                          : "bg-stone-700 text-white sm:text-sm rounded-sm focus:ring-primary-600 focus:border-primary-600 block w-full p-2.5 dark:text-white"
                      }
                      required
                    ></input>
                  </div>
                  <div>
                    <label
                      htmlFor="confirmPassword"
                      className="block mb-2 text-sm font-medium text-white dark:text-white"
                    >
                      Confirm Password
                    </label>
                    <input
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      type="password"
                      name="confirmPassword"
                      id="confirmPassword"
                      placeholder="••••••••"
                      className={
                        ErrorMessage
                          ? "bg-stone-700 text-white sm:text-sm rounded-sm border-2 border-red-700 focus:ring-primary-600 focus:border-primary-600 block w-full p-2.5"
                          : "bg-stone-700 text-white sm:text-sm rounded-sm focus:ring-primary-600 focus:border-primary-600 block w-full p-2.5 dark:text-white"
                      }
                      required
                    ></input>
                  </div>
                  <div id="recaptcha-signup"></div>
                  <div>
                    {ErrorMessage && (
                      <h1 className="flex text-white font-bold p-4 bg-red-700 rounded text-center">
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
                        {ErrorMessage}
                      </h1>
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-start">
                      <div className="flex items-center h-5">
                        <input
                          id="remember"
                          aria-describedby="remember"
                          type="checkbox"
                          className="w-4 h-4 border border-gray-300 rounded bg-gray-50 focus:ring-3 focus:ring-primary-300 "
                          // removed 'required=""' here as remember me checkbox usually isn't strictly required for signup
                        ></input>
                      </div>
                      <div className="ml-3 text-sm">
                        <label htmlFor="remember" className="text-gray-500">
                          Remember me
                        </label>
                      </div>
                    </div>
                  </div>
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
                    disabled={loader} // Disable button when loading
                  >
                    {loader ? <ClipLoader color="#5b7ea4" /> : "Create now"}
                  </button>
                  <p className="text-sm font-light text-gray-500">
                    Already have one?{" "}
                    <Link
                      className="font-medium text-white hover:underline"
                      to={"/signin"}
                    >
                      Sign in
                    </Link>
                  </p>
                </form>
              </div>
            </div>
          </Fade>
        </div>
      </div>
    </section>
  );
}

export default SignUp;