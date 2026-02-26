import React, { useState, useEffect, useContext } from "react";
import { API_KEY, imageUrl } from "../../Constants/Constance";
import axios from "../../axios";
import { PopUpContext } from "../../Context/moviePopUpContext";
import { Fade } from "react-reveal";
import ReactStars from 'react-rating-stars-component';
import MoviePopUp from "../PopUp/MoviePopUp";
import usePlayMovie from "../../CustomHooks/usePlayMovie";
import useUpdateWatchedMovies from "../../CustomHooks/useUpdateWatchedMovies";
import useUpdateMylist from "../../CustomHooks/useUpdateMylist";
import useUpdateLikedMovies from "../../CustomHooks/useUpdateLikedMovies";
import { PaystackButton } from 'react-paystack';
import instance from "../../axios";

function Banner(props) {

  const { showModal, setShowModal } = useContext(PopUpContext);
  const { playMovie } = usePlayMovie();
  const { addToMyList } = useUpdateMylist();
  const { addToLikedMovies } = useUpdateLikedMovies();
  const { removeFromWatchedMovies } = useUpdateWatchedMovies();

  // Payment state
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedMovie, setSelectedMovie] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState(null);
  const [ecocashNumber, setEcocashNumber] = useState("");
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentError, setPaymentError] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [userEmail, setUserEmail] = useState("");

  const [movie, setMovie] = useState([]);
  const [moviePopupInfo, setMoviePopupInfo] = useState({});
  const [urlId, setUrlId] = useState("");

  const paystackConfig = {
    reference: new Date().getTime().toString(),
    email: userEmail || 'ngonichibaya@gmail.com',
    amount: 1800, // R18.00 in cents
    publicKey: 'pk_test_7db519ca57855dd44151675b7c4233b925016c6d',
    currency: 'ZAR',
  };

  function getWindowSize() {
    const {innerWidth:width } = window;
    return {
      width
    }
  }

  const [windowSeize, setWindowSeize] = useState(getWindowSize())

  useEffect(() => {
    const email = localStorage.getItem('django_user_email') || 'ngonichibaya@gmail.com';
    setUserEmail(email);

    instance.get(props.url).then((response) => {
      setMovie(
        response.data.results.sort(function (a, b) {
          return 0.5 - Math.random();
        })[0]
      );
      console.log(movie);
    });

    function handleWindowResize() {
      setWindowSeize(getWindowSize())
    }

    window.addEventListener('resize', handleWindowResize)

  }, []);

  const handlePaystackSuccess = (reference) => {
    console.log('Paystack payment successful:', reference);
    setPaymentLoading(true);
    
    // Create payment record in Django backend
    instance.post('/payments/create-paystack/', {
      reference: reference.reference,
      movie_id: selectedMovie.id,
      amount: 18.00,
      currency: 'ZAR',
      payment_type: 'card',
      email: userEmail || 'ngonichibaya@gmail.com'
    })
    .then((response) => {
      const { payment_id } = response.data;
      window.paystackPaymentId = payment_id;
      pollPaystackPayment(payment_id);
    })
    .catch((error) => {
      setPaymentLoading(false);
      setPaymentError('Payment creation failed');
      console.error('Payment error:', error);
    });
  };

  const handlePaystackClose = () => {
    console.log('Paystack payment closed');
    setPaymentLoading(true);
    
    // Check if payment was created and verify status
    if (window.paystackPaymentId) {
      instance.post('/payments/verify-paystack/', {
        payment_id: window.paystackPaymentId
      })
      .then((response) => {
        const { status, paid } = response.data;
        
        if (status === 'paid' || paid === true) {
          setPaymentLoading(false);
          setShowPaymentModal(false);
          addToMyList(selectedMovie);
          playMovie(selectedMovie);
        } else {
          setPaymentLoading(false);
          setPaymentError('Payment failed or was cancelled.');
        }
      })
      .catch((error) => {
        setPaymentLoading(false);
        setPaymentError('Payment failed or was cancelled.');
      });
    } else {
      setPaymentLoading(false);
      setPaymentError('Payment was not created.');
    }
  };

  const pollPaystackPayment = async (paymentId) => {
    const maxAttempts = 20;
    let attempts = 0;

    const checkStatus = async () => {
      try {
        const response = await instance.post('/payments/verify-paystack/', {
          payment_id: paymentId
        });
        const { status, paid } = response.data;

        if (status === 'paid' || paid === true) {
          setPaymentLoading(false);
          setShowPaymentModal(false);
          addToMyList(selectedMovie);
          playMovie(selectedMovie);
        } else if (status === 'failed' || status === 'cancelled') {
          setPaymentLoading(false);
          setPaymentError('Payment failed. Please try again.');
        } else if (attempts < maxAttempts) {
          attempts++;
          setTimeout(checkStatus, 3000);
        } else {
          setPaymentLoading(false);
          setPaymentError('Payment timeout. Please check your payment status.');
        }
      } catch (error) {
        setPaymentLoading(false);
        setPaymentError('Error checking payment status');
      }
    };

    checkStatus();
  };

  const handlePayment = async () => {
    if (currency === 'ZAR') {
      return;
    }
    
    setPaymentLoading(true);
    setPaymentError("");

    try {
      const userEmail = localStorage.getItem('django_user_email') || 'ngonichibaya@gmail.com';
      const amount = currency === "USD" ? 1.00 : 32.00;
      
      const response = await instance.post('/payments/initiate/', {
        movie_id: selectedMovie.id,
        amount: amount,
        currency: currency,
        payment_type: paymentMethod === 'ecocash' ? 'mobile' : 'card',
        phone_number: paymentMethod === 'ecocash' ? ecocashNumber : null,
        email: userEmail
      });

      const { payment_id, poll_url, redirect_url, status } = response.data;

      if (paymentMethod === 'ecocash') {
        // Mobile payment - poll for status
        pollPaymentStatus(poll_url, payment_id);
      } else {
        // Card payment - redirect to payment page
        window.open(redirect_url, '_blank', 'width=600,height=700');
        // Poll for status after redirect
        pollPaymentStatus(poll_url, payment_id);
      }
    } catch (error) {
      setPaymentLoading(false);
      setPaymentError(error.response?.data?.detail || 'Payment initiation failed');
      console.error('Payment error:', error);
    }
  };

  const pollPaymentStatus = async (pollUrl, paymentId) => {
    const maxAttempts = 20;
    let attempts = 0;
    let shouldContinue = true;

    const checkStatus = async () => {
      if (!shouldContinue) return;

      try {
        const response = await instance.get(`/payments/${paymentId}/status`);
        const { status, paid } = response.data;
        console.log('Payment status:', response.data);

        if (status === 'paid' || paid === true) {
          shouldContinue = false;
          setPaymentLoading(false);
          setShowPaymentModal(false);
          addToMyList(selectedMovie);
          playMovie(selectedMovie);
        } else if (status === 'failed' || status === 'cancelled') {
          shouldContinue = false;
          setPaymentLoading(false);
          setPaymentError('Payment failed. Please try again.');
        } else if (attempts < maxAttempts) {
          attempts++;
          setTimeout(checkStatus, 5000);
        } else {
          shouldContinue = false;
          setPaymentLoading(false);
          setPaymentError('Payment timeout. Please check your payment status.');
        }
      } catch (error) {
        shouldContinue = false;
        setPaymentLoading(false);
        setPaymentError('Error checking payment status');
      }
    };

    checkStatus();
  };

  const handlePlayMovie = async (movie) => {
    try {
      const response = await instance.get(`/movies/${movie.id}/check-paid`);
      
      if (response.data.is_paid) {
        playMovie(movie);
      } else {
        // Reset payment modal state
        setPaymentMethod(null);
        setEcocashNumber("");
        setCurrency("USD");
        setPaymentError("");
        setPaymentLoading(false);
        
        setSelectedMovie(movie);
        setShowPaymentModal(true);
        setShowModal(false);
      }
    } catch (error) {
      console.error("Error checking payment status:", error);
      // Reset payment modal state
      setPaymentMethod(null);
      setEcocashNumber("");
      setCurrency("USD");
      setPaymentError("");
      setPaymentLoading(false);
      
      setSelectedMovie(movie);
      setShowPaymentModal(true);
      setShowModal(false);
    }
  };

  const handleMoviePopup = (movieInfo) => {
    setMoviePopupInfo(movieInfo);
    setShowModal(true);
    instance
      .get(`/movie/${movieInfo.id}/videos?api_key=${API_KEY}&language=en-US`)
      .then((responce) => {
        if (responce.data.results.length !== 0) {
          setUrlId(responce.data.results[0]);
        }
      });
  };

  return (
    <>
      <div
        style={{
          backgroundImage: `linear-gradient(90deg, hsl(0deg 0% 7% / 91%) 0%, hsl(0deg 0% 0% / 0%) 35%, hsl(220deg 26% 44% / 0%) 100%), url(${
            movie
              ? imageUrl + movie.backdrop_path
              : ""
          })`,
        }}
        className="h-[50rem] md:h-[55rem] 3xl:h-[63rem] bg-cover bg-center object-contain grid items-center"
      >
        <div className="ml-2  mr-2 sm:mr-0 sm:ml-12 mt-[75%] sm:mt-52">
          <Fade bottom>
            {movie.title || movie.name ? (
              <>
                <h1 className="text-white text-3xl font-semibold text-center mb-5 py-2 sm:text-left sm:text-5xl sm:border-l-8 pl-4 border-[#5b7ea4] md:text-6xl lg:w-2/3 xl:w-1/2 sm:font-bold drop-shadow-lg">
                  {movie.title || movie.name}
                </h1>
              </>
            ) : (
              <div className="grid justify-center sm:justify-start">
                <div className="animate-pulse w-72 ml-4 sm:ml-0 sm:w-96 py-5 mb-7 xl:py-7 xl:w-45rem bg-neutral-900 rounded-md"></div>
              </div>
            )}
            
            
            <div className="flex">
              <div className=" hidden sm:flex justify-center sm:justify-start ml-2">
                {movie.vote_average ? (
                  <h1 className="flex text-white text-xl drop-shadow-lg 2xl:text-lg">
                    <div className="-mt-1">
                      <ReactStars
                        count={5}
                        value={movie.vote_average / 2}
                        size={18}
                        activeColor="#5b7ea4"
                        color="#374151"
                        edit={false}
                      />
                    </div>
                  </h1>
                ) : null}
              </div>
              <div className="ml-2 hidden sm:flex justify-center sm:justify-start">
                {movie.release_date || movie.first_air_date ? (
                  <h1 className="flex text-white text-base font-bold drop-shadow-lg">
                    {movie.release_date || movie.first_air_date}
                  </h1>
                ) : null}
              </div>
              {movie.id && (
                <h1 className="hidden sm:flex text-white px-2 bg-[#1e1e1e89] border-2 border-stone-600 rounded ml-2">
                  HD
                </h1>
              )}
            </div>

            <div className="mt-3 mb-4">
              {movie.overview ? (
                <>
                  <h1 className="text-white text-xl drop-shadow-xl  text-center line-clamp-2 sm:line-clamp-3 sm:text-left w-full md:w-4/5 lg:w-8/12/2 lg:text-xl xl:w-5/12 2xl:text-2xl">
                    {movie.overview}
                  </h1>
                </>
              ) : (
                <>
                  <div className="grid justify-center md:justify-start">
                    <div className="animate-pulse w-80 sm:w-40rem md:w-45rem py-1 mb-3 xl:w-70rem xl:py-2 bg-neutral-900 rounded-md"></div>
                    <div className="animate-pulse w-80 sm:w-40rem md:w-45rem py-1 mb-3 xl:w-70rem xl:py-2 bg-neutral-900 rounded-md"></div>
                    <div className="animate-pulse w-80 sm:w-40rem md:w-45rem py-1 mb-7 xl:w-70rem xl:py-2 bg-neutral-900 rounded-md"></div>
                  </div>
                </>
              )}
            </div>

            <div className="flex justify-center sm:justify-start">
              {movie.id ? (
                <>
                  <button
                    onClick={() => handlePlayMovie(movie)}
                    className="bg-[#5b7ea4] hover:bg-[#4a6a8f] transition duration-500 ease-in-out shadow-2xl flex items-center mb-3 mr-3 text-base sm:text-xl font-semibold text-white py-2 sm:py-2 px-10 sm:px-14 rounded-md"
                    disabled={paymentLoading}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                      stroke="currentColor"
                      className="w-6 h-6 mr-2 "
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z"
                      />
                    </svg>
                    {paymentLoading ? "Processing..." : "Play"}
                  </button>
                  <button
                    onClick={() => handleMoviePopup(movie)}
                    className="bg-[#33333380] flex items-center shadow-2xl mb-3 text-base sm:text-xl font-semibold text-white hover:bg-white hover:text-black transition duration-500 ease-in-out py-2 px-8 rounded-md"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-6 w-6 items-center mr-2"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    More Info
                  </button>
                </>
              ) : (
                <>
                  <button className="animate-pulse bg-neutral-900 transition duration-500 ease-in-out shadow-2xl flex items-center mb-3 mr-3 text-base sm:text-xl font-semibold text-neutral-500 py-2 sm:py-2 px-10 sm:px-14 rounded-md">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-6 w-5 items-center mr-2"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    Play
                  </button>
                  <button className="animate-pulse bg-neutral-900 flex items-center shadow-2xl mb-3 text-base sm:text-xl font-semibold text-neutral-500 transition duration-500 ease-in-out py-2 px-8 rounded-md">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-6 w-6 items-center mr-2"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    More Info
                  </button>
                </>
              )}
            </div>
          </Fade>
        </div>
        <div
          style={{
            backgroundImage:
              "linear-gradient(hsl(0deg 0% 0% / 0%), hsl(0deg 0% 0% / 38%), hsl(0deg 0% 7%))",
          }}
          className="h-80 mt-auto "
        ></div>
      </div>

      {showModal ? <MoviePopUp data1={moviePopupInfo} data2={urlId} /> : null}

      {/* Payment Modal */}
      {showPaymentModal && selectedMovie && (
        <>
          <div className="opacity-60 fixed inset-0 z-40 bg-black pointer-events-none"></div>
          <div className="justify-center items-center flex overflow-x-hidden overflow-y-auto fixed inset-0 z-50 outline-none focus:outline-none pointer-events-auto">
            <div className="relative w-auto my-6 mx-4 max-w-md">
              <Fade bottom duration={500}>
                <div className="border-0 rounded-lg shadow-lg relative flex flex-col w-full bg-neutral-800 outline-none focus:outline-none">
                  {/* Close button */}
                  <button
                    className="absolute top-4 right-4 z-10 text-white hover:text-gray-300"
                    onClick={() => setShowPaymentModal(false)}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={2}
                      stroke="currentColor"
                      className="w-6 h-6"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>

                  {/* Header */}
                  <div className="p-6 pb-4">
                    <h3 className="text-2xl font-bold text-white mb-2">
                      Payment Required
                    </h3>
                    <p className="text-gray-400 text-sm">
                      {selectedMovie.title || selectedMovie.name}
                    </p>
                  </div>

                  {/* Body */}
                  <div className="px-6 pb-6">
                    <div className="bg-neutral-700 rounded-lg p-4 mb-4">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-gray-400">Movie Price:</span>
                        <span className="text-white font-bold text-xl">
                          {currency === "USD" ? "$1.00" : currency === "ZAR" ? "R18.00" : "ZWG 32.00"}
                        </span>
                      </div>
                      <div className="bg-neutral-600 h-[1px] mb-3"></div>
                      
                      {/* Currency Toggle */}
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-gray-400 text-sm">Currency:</span>
                        <div className="flex bg-neutral-600 rounded-lg p-1">
                          <button
                            onClick={() => setCurrency("USD")}
                            className={`px-4 py-1 rounded-md text-sm font-medium transition-all ${
                              currency === "USD"
                                ? "bg-[#5b7ea4] text-white"
                                : "text-gray-400 hover:text-white"
                            }`}
                          >
                            USD
                          </button>
                          <button
                            onClick={() => setCurrency("ZWG")}
                            className={`px-4 py-1 rounded-md text-sm font-medium transition-all ${
                              currency === "ZWG"
                                ? "bg-[#5b7ea4] text-white"
                                : "text-gray-400 hover:text-white"
                            }`}
                          >
                            ZWG
                          </button>
                          <button
                            onClick={() => setCurrency("ZAR")}
                            className={`px-4 py-1 rounded-md text-sm font-medium transition-all ${
                              currency === "ZAR"
                                ? "bg-[#5b7ea4] text-white"
                                : "text-gray-400 hover:text-white"
                            }`}
                          >
                            ZAR
                          </button>
                        </div>
                      </div>
                      
                      <p className="text-gray-400 text-xs">
                        One-time payment for unlimited access to this movie
                      </p>
                    </div>

                    {/* Payment Method */}
                    {currency !== 'ZAR' && (
                    <div className="mb-4">
                      <label className="text-white text-sm font-medium mb-2 block">
                        Payment Method
                      </label>
                      
                      {!paymentMethod ? (
                        <div className="space-y-2">
                          {/* Ecocash */}
                          <div
                            onClick={() => setPaymentMethod("ecocash")}
                            className="bg-neutral-700 rounded-lg p-4 flex items-center cursor-pointer hover:bg-neutral-600 transition-all"
                          >
                            <div className="bg-orange-600 rounded p-2 mr-3">
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                fill="none"
                                viewBox="0 0 24 24"
                                strokeWidth={2}
                                stroke="currentColor"
                                className="w-6 h-6 text-white"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3"
                                />
                              </svg>
                            </div>
                            <div>
                              <p className="text-white font-medium">Ecocash</p>
                              <p className="text-gray-400 text-xs">Mobile Money Payment</p>
                            </div>
                          </div>

                          {/* Card */}
                          <div
                            onClick={() => setPaymentMethod("card")}
                            className="bg-neutral-700 rounded-lg p-4 flex items-center cursor-pointer hover:bg-neutral-600 transition-all"
                          >
                            <div className="bg-blue-600 rounded p-2 mr-3">
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                fill="none"
                                viewBox="0 0 24 24"
                                strokeWidth={2}
                                stroke="currentColor"
                                className="w-6 h-6 text-white"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z"
                                />
                              </svg>
                            </div>
                            <div>
                              <p className="text-white font-medium">Card</p>
                              <p className="text-gray-400 text-xs">Credit/Debit Card</p>
                            </div>
                          </div>
                        </div>
                      ) : paymentMethod === "ecocash" ? (
                        <div>
                          <div className="bg-neutral-700 rounded-lg p-4 mb-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center">
                                <div className="bg-orange-600 rounded p-2 mr-3">
                                  <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    strokeWidth={2}
                                    stroke="currentColor"
                                    className="w-5 h-5 text-white"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3"
                                    />
                                  </svg>
                                </div>
                                <p className="text-white font-medium">Ecocash</p>
                              </div>
                              <button
                                onClick={() => setPaymentMethod(null)}
                                className="text-gray-400 hover:text-white text-xs"
                              >
                                Change
                              </button>
                            </div>
                          </div>
                          <input
                            type="tel"
                            placeholder="Enter Ecocash number (e.g. 0771234567)"
                            value={ecocashNumber}
                            onChange={(e) => setEcocashNumber(e.target.value)}
                            className="w-full bg-neutral-700 text-white rounded-lg p-3 focus:ring-2 focus:ring-red-600 outline-none"
                          />
                        </div>
                      ) : (
                        <div className="bg-neutral-700 rounded-lg p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center">
                              <div className="bg-blue-600 rounded p-2 mr-3">
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  strokeWidth={2}
                                  stroke="currentColor"
                                  className="w-5 h-5 text-white"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z"
                                  />
                                </svg>
                              </div>
                              <p className="text-white font-medium">Card</p>
                            </div>
                            <button
                              onClick={() => setPaymentMethod(null)}
                              className="text-gray-400 hover:text-white text-xs"
                            >
                              Change
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                    )}

                    {/* Error Message */}
                    {paymentError && (
                      <div className="mb-4 bg-red-900 bg-opacity-50 border border-red-600 rounded-lg p-3">
                        <p className="text-red-200 text-sm">{paymentError}</p>
                      </div>
                    )}

                    {/* Action Buttons */}
                    {currency === 'ZAR' ? (
                      <PaystackButton
                        {...paystackConfig}
                        text={paymentLoading ? 'Processing...' : `Pay R18.00 with Paystack`}
                        onSuccess={handlePaystackSuccess}
                        onClose={handlePaystackClose}
                        disabled={paymentLoading}
                        className="w-full bg-[#5b7ea4] text-white font-bold py-3 rounded-lg hover:bg-[#4a6a8f] transition-all duration-200 mb-2 disabled:opacity-50"
                      />
                    ) : (
                      <button
                        className="w-full bg-[#5b7ea4] text-white font-bold py-3 rounded-lg hover:bg-[#4a6a8f] transition-all duration-200 mb-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        onClick={handlePayment}
                        disabled={paymentLoading || (paymentMethod === 'ecocash' && !ecocashNumber)}
                      >
                        {paymentLoading ? (
                          <div className="flex items-center justify-center">
                            <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white mr-2"></div>
                            {paymentMethod === 'ecocash' ? 'Processing Payment...' : 'Waiting for Payment...'}
                          </div>
                        ) : (
                          `Pay Now - ${currency === "USD" ? "$1.00" : "ZWG 32.00"}`
                        )}
                      </button>
                    )}
                    <button
                      className="w-full bg-transparent border border-gray-600 text-gray-400 font-medium py-3 rounded-lg hover:bg-neutral-700 transition-all duration-200"
                      onClick={() => setShowPaymentModal(false)}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </Fade>
            </div>
          </div>
          <div className="opacity-60 fixed inset-0 z-40 bg-black pointer-events-none"></div>
        </>
      )}
    </>
  );
}

export default Banner;
