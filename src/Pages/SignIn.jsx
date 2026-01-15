import React from "react";
import { useState, useContext } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Fade } from "react-reveal";
import { ClipLoader } from "react-spinners";
import {
  getAuth,
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
} from "firebase/auth";
import { setDoc, doc, getDoc } from "firebase/firestore";
import { db } from "../Firebase/FirebaseConfig";
import { AuthContext } from "../Context/UserContext";
import axios from "axios";
import GoogleLogo from "../images/GoogleLogo.png";
import WelcomePageBanner from "../images/WelcomBannerNew.png";
import instance from "../axios";

function SignIn() {
  const { User, setUser } = useContext(AuthContext);
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
        if (window.grecaptcha.render && document.getElementById('recaptcha-signin')) {
          window.grecaptcha.render('recaptcha-signin', {
            'sitekey': '6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI',
            'callback': (token) => setCaptchaToken(token)
          });
          captchaRendered.current = true;
          clearInterval(interval);
        }
      }, 100);
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!captchaToken) {
      setErrorMessage("Please complete the captcha");
      return;
    }
    
    setLoader(true);

    const auth = getAuth();
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      console.log(user);
      
      if (user != null) {
        const djangoRegisterResponse = await instance.post(
          "/firebase-login",
          {
            id_token: user.uid,
            email: user.email,
          }
        );

        console.log("Django login successful:", djangoRegisterResponse.data);

        localStorage.setItem('django_token', djangoRegisterResponse.data.token);
        localStorage.setItem('django_user_id', djangoRegisterResponse.data.user_id);
        navigate("/");
      }
    } catch (error) {
      const errorCode = error.code;
      
      if (errorCode === 'auth/invalid-login-credentials' || errorCode === 'auth/wrong-password' || errorCode === 'auth/user-not-found') {
        setErrorMessage("Wrong email or password");
      } else {
        setErrorMessage(error.message);
      }
      
      setLoader(false);
      console.log(errorCode);
      console.log(error.message);
    }
  };

  const loginWithGoogle = async (e) => {
    e.preventDefault();
    const auth = getAuth();
    const provider = new GoogleAuthProvider();

    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      console.log("user------", user);
      const EmptyArray = [];

      await setDoc(
        doc(db, "Users", user.uid),
        {
          email: user.email,
          Uid: user.uid,
        },
        { merge: true }
      );

      const myListDoc = await getDoc(doc(db, "MyList", user.uid));
      if (!myListDoc.exists()) {
        await setDoc(
          doc(db, "MyList", user.uid),
          { movies: EmptyArray },
          { merge: true }
        );
        await setDoc(
          doc(db, "WatchedMovies", user.uid),
          { movies: EmptyArray },
          { merge: true }
        );
        await setDoc(
          doc(db, "LikedMovies", user.uid),
          { movies: EmptyArray },
          { merge: true }
        );
      }

      if (user != null) {
        const djangoRegisterResponse = await instance.post(
          "/firebase-register",
          {
            id_token: user.uid,
            email: user.email,
          }
        );

        console.log("Django login successful:", djangoRegisterResponse.data);

        localStorage.setItem('django_token', djangoRegisterResponse.data.token);
        localStorage.setItem('django_user_id', djangoRegisterResponse.data.user_id);
        navigate("/");
      }
    } catch (error) {
      const errorCode = error.code;
      const errorMessage = error.message;
      setErrorMessage(error.message);
      setLoader(false);
      console.error("Login error:", error);
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
            <div>
              <div className="p-4 space-y-4 md:space-y-6 sm:p-8">
                <h1 className="text-lg font-bold leading-tight tracking-tight text-white md:text-xl dark:text-white">
                  Sign in to your account
                </h1>
                <form
                  onSubmit={handleSubmit}
                  className="space-y-4 md:space-y-6"
                  action="#"
                >
                  <div>
                    <label
                      for="email"
                      className="block mb-2 text-sm font-medium text-white dark:text-white"
                    >
                      Your email
                    </label>
                    <input
                      type="email"
                      name="email"
                      id="email"
                      className={
                        ErrorMessage
                          ? "bg-stone-700 text-white sm:text-sm rounded-sm focus:ring-transparent focus:border-transparent block w-full p-2.5 border-2 border-transparent dark:placeholder-white dark:text-white dark:focus:ring-transparent dark:focus:border-transparent placeholder:text-white"
                          : "bg-stone-700 text-white sm:text-sm rounded-sm focus:ring-transparent focus:border-transparent block w-full p-2.5 dark:placeholder-white dark:text-white dark:focus:ring-transparent dark:focus:border-transparent placeholder:text-white"
                      }
                      placeholder="name@email.com"
                      required=""
                      onChange={(e) => setEmail(e.target.value)}
                    ></input>
                  </div>
                  <div>
                    <label
                      for="password"
                      className="block mb-2 text-sm font-medium text-white dark:text-white"
                    >
                      Password
                    </label>
                    <input
                      type="password"
                      name="password"
                      id="password"
                      placeholder="••••••••"
                      className={
                        ErrorMessage
                          ? "bg-stone-700 text-white sm:text-sm rounded-sm focus:ring-transparent focus:border-transparent block w-full p-2.5  border-2 border-transparent dark:bg-gray-700 dark:text-white dark:focus:ring-transparent dark:focus:border-transparent placeholder:text-white"
                          : "bg-stone-700 text-white sm:text-sm rounded-sm focus:ring-transparent focus:border-transparent block w-full p-2.5 dark:text-white dark:focus:ring-transparent dark:focus:border-transparent placeholder:text-white"
                      }
                      required=""
                      onChange={(e) => setPassword(e.target.value)}
                    ></input>
                  </div>
                  <div id="recaptcha-signin"></div>
                  <div>
                    {ErrorMessage && (
                      <h1 className="flex text-white font-bold p-4 bg-transparent border border-stone-700 rounded text-center">
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
                          className="w-4 h-4 border border-gray-300 rounded bg-gray-50 focus:ring-3 focus:ring-primary-300 dark:bg-gray-700 dark:border-gray-600 dark:focus:ring-primary-600 dark:ring-offset-gray-800"
                          required=""
                        ></input>
                      </div>
                      <div className="ml-3 text-sm">
                        <label
                          for="remember"
                          className="text-gray-500 dark:text-gray-300"
                        >
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
                  >
                    {loader ? <ClipLoader color="#5b7ea4" /> : `Sign in`}
                  </button>
                  <button
                    onClick={loginWithGoogle}
                    className={`flex justify-center items-center w-full ${
                      loader
                        ? `bg-stone-700`
                        : `bg-transparent hover:bg-stone-800 focus:ring-0 focus:outline-none`
                    } transition ease-in-out font-medium rounded-sm text-sm px-5 py-2.5 text-center`}
                  >
                    {loader ? (
                      <ClipLoader color="#ff0000" />
                    ) : (
                      <>
                        <span
                          className="flex items-center justify-center rounded-sm"
                          style={{
                            backgroundColor: "#F5E6CC", // Warm Beige
                            padding: 4,
                          }}
                        >
                          <img className="w-8" src={GoogleLogo} alt="Google logo" />
                        </span>
                        <p className="ml-3 text-blue-600">Sign in with Google</p>
                      </>
                    )}
                  </button>
                  <p className="text-sm font-light text-gray-500 dark:text-gray-400">
                    Don’t have an account yet?{" "}
                    <Link
                      className="font-medium text-white hover:underline dark:text-primary-500"
                      to={"/signup"}
                    >
                      Sign up
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

export default SignIn;
