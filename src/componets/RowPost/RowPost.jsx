import React from "react";
import { useEffect, useState } from "react";

import axios from "../../axios";
import { imageUrl, imageUrl2, API_KEY } from "../../Constants/Constance";
import useUpdateMylist from "../../CustomHooks/useUpdateMylist";
import { Fade } from "react-reveal";
import YouTube from "react-youtube";
import ReactStars from 'react-rating-stars-component';
import { PaystackButton } from 'react-paystack';

import usePlayMovie from "../../CustomHooks/usePlayMovie";
import useUpdateWatchedMovies from "../../CustomHooks/useUpdateWatchedMovies";
import useUpdateLikedMovies from "../../CustomHooks/useUpdateLikedMovies";
import useGenereConverter from "../../CustomHooks/useGenereConverter";

import { Swiper, SwiperSlide } from "swiper/react";
import { Navigation, Pagination } from "swiper";

import "swiper/css";
import "swiper/css/navigation";
import "swiper/css/pagination";
import "./RowPostStyles.scss";
import instance from "../../axios";

function RowPost(props) {
  const { addToMyList, PopupMessage } = useUpdateMylist();
  const { playMovie } = usePlayMovie();
  const { removeFromWatchedMovies, removePopupMessage } =
    useUpdateWatchedMovies();
  const { addToLikedMovies, LikedMoviePopupMessage } = useUpdateLikedMovies();
  const { convertGenere } = useGenereConverter();

  const [movies, setMovies] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [moviePopupInfo, setMoviePopupInfo] = useState({});
  const [shouldPop, setshouldPop] = useState(true);
  const [urlId, setUrlId] = useState("");
  const [previewVideoUrl, setPreviewVideoUrl] = useState("");
  const [selectedMovie, setSelectedMovie] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState(null);
  const [ecocashNumber, setEcocashNumber] = useState("");
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentError, setPaymentError] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [userEmail, setUserEmail] = useState("");

  const paystackConfig = {
    reference: new Date().getTime().toString(),
    email: userEmail || 'ngonichibaya@gmail.com',
    amount: 1800, // R18.00 in cents
    publicKey: 'pk_test_7db519ca57855dd44151675b7c4233b925016c6d',
    currency: 'ZAR',
  };

  useEffect(() => {
    console.log("props",props);
    const email = localStorage.getItem('django_user_email') || 'ngonichibaya@gmail.com';
    setUserEmail(email);
    if (props.movieData != null) {
      setMovies(props.movieData);
    } else {
      instance.get(props.url).then((response) => {
        console.log(response.data.results);
        setMovies(response.data.results);
      });
    }
  }, []);

  const customSettings = {
    breakpoints: {
      1800: { slidesPerView: 6.1, slidesPerGroup: 5 },
      1690: { slidesPerView: 5.5, slidesPerGroup: 5 },
      1536: { slidesPerView: 5, slidesPerGroup: 5 },
      1280: { slidesPerView: 4.3, slidesPerGroup: 4 },
      768: { slidesPerView: 3.3, slidesPerGroup: 3 },
      625: { slidesPerView: 3.1, slidesPerGroup: 3 },
      330: { slidesPerView: 2.1, slidesPerGroup: 2 },
      0: { slidesPerView: 2, slidesPerGroup: 2 },
    },
  };

  const opts = {
    width: "100%",
    height: "auto",
    playerVars: {
      autoplay: 1,
      controls: 0,
    },
    modestbranding: 1,
    rel: 0,
    autohide: 1,
    showinfo: 0,
  };

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
    if (shouldPop) {
      setMoviePopupInfo(movieInfo);
      setShowModal(true);
      // Removed video preview fetch to prevent undefined S3 URL error
      setPreviewVideoUrl("");
    }
  };

  return (
    <div
      className="ml-2 lg:ml-11 mb-11 lg:mb-4 RowContainer"
      style={{ marginTop: `${props.first ? "-8rem" : ""}` }}
    >
      {PopupMessage}
      {removePopupMessage}

      {movies[0] ? (
        <>
          <h1 className="text-white pb-4 xl:pb-0 font-normal text-base sm:text-2xl md:text-4xl">
            {props.title}
          </h1>

          <Swiper
            {...customSettings}
            modules={[Navigation, Pagination]}
            spaceBetween={8}
            slidesPerView={6.1}
            navigation
            pagination={{ clickable: true }}
            onSlideChange={() => console.log("slide change")}
            onSwiper={(swiper) => console.log(swiper)}
            className="SwiperStyle"
          >
            {movies.map((obj, index) => {
              const converted = convertGenere(obj.genre_ids);
              return (
                <SwiperSlide
                  className={props.islarge ? "large" : "bg-cover"}
                  onClick={() => handleMoviePopup(obj)}
                >
                  {props.islarge ? (
                    <>
                      <img
                        className="rounded-sm"
                        src={`${imageUrl}${obj.poster_path}`}
                      />
                    </>
                  ) : (
                    <>
                      <img
                        loading="lazy"
                        className={
                          props.movieData != null
                            ? "border-b-4 border-red-700 rounded-sm"
                            : "rounded-sm"
                        }
                        src={
                          obj.backdrop_path
                            ? `${imageUrl2}${obj.backdrop_path}`
                            : "https://i.ytimg.com/vi/Mwf--eGs05U/maxresdefault.jpg"
                        }
                        onClick={() => handleMoviePopup(obj)}
                      />
                      {props.showProgress && obj.progress && obj.duration && (
                        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-700">
                          <div
                            className="h-full bg-[#5b7ea4]"
                            style={{ width: `${(obj.progress / obj.duration) * 100}%` }}
                          />
                        </div>
                      )}
                    </>
                  )}
                  <div className="content pt-16">
                    <Fade bottom duration={300}>
                      <div className="flex transition ml-3 ease-in-out delay-150">
                        <div
                          onClick={() => handlePlayMovie(obj)}
                          onMouseEnter={() => setshouldPop(false)}
                          onMouseLeave={() => setshouldPop(true)}
                          className="text-white w-9 h-9 border-[2px] rounded-full p-2 mr-1 backdrop-blur-[2px] shadow-md ease-linear transition-all duration-150 hover:text-black hover:bg-white"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                            strokeWidth={1.5}
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z"
                            />
                          </svg>
                        </div>

                        {props.movieData != null ? (
                          <>
                            <div
                              onClick={() => removeFromWatchedMovies(obj)}
                              onMouseEnter={() => setshouldPop(false)}
                              onMouseLeave={() => setshouldPop(true)}
                              className="text-white w-9 h-9 border-[2px] rounded-full p-2 mr-1 backdrop-blur-[1px] shadow-md ease-linear transition-all duration-150 hover:text-black hover:bg-white"
                            >
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                fill="none"
                                viewBox="0 0 24 24"
                                strokeWidth={1.5}
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M19.5 12h-15"
                                />
                              </svg>
                            </div>
                          </>
                        ) : (
                          <>
                            <div
                              onClick={() => addToMyList(obj)}
                              onMouseEnter={() => setshouldPop(false)}
                              onMouseLeave={() => setshouldPop(true)}
                              className="text-white w-9 h-9 border-[2px] rounded-full p-2 mr-1 backdrop-blur-[1px] shadow-md ease-linear transition-all duration-150 hover:text-black hover:bg-white"
                            >
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                fill="none"
                                viewBox="0 0 24 24"
                                strokeWidth={1.5}
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M12 4.5v15m7.5-7.5h-15"
                                />
                              </svg>
                            </div>
                          </>
                        )}

                        <div
                          onClick={() => addToLikedMovies(obj)}
                          onMouseEnter={() => setshouldPop(false)}
                          onMouseLeave={() => setshouldPop(true)}
                          className="text-white w-9 h-9 border-[2px] rounded-full p-2 mr-1 backdrop-blur-[1px] shadow-md ease-linear transition-all duration-150 hover:text-black hover:bg-white"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                            strokeWidth={1.5}
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M6.633 10.5c.806 0 1.533-.446 2.031-1.08a9.041 9.041 0 012.861-2.4c.723-.384 1.35-.956 1.653-1.715a4.498 4.498 0 00.322-1.672V3a.75.75 0 01.75-.75A2.25 2.25 0 0116.5 4.5c0 1.152-.26 2.243-.723 3.218-.266.558.107 1.282.725 1.282h3.126c1.026 0 1.945.694 2.054 1.715.045.422.068.85.068 1.285a11.95 11.95 0 01-2.649 7.521c-.388.482-.987.729-1.605.729H13.48c-.483 0-.964-.078-1.423-.23l-3.114-1.04a4.501 4.501 0 00-1.423-.23H5.904M14.25 9h2.25M5.904 18.75c.083.205.173.405.27.602.197.4-.078.898-.523.898h-.908c-.889 0-1.713-.518-1.972-1.368a12 12 0 01-.521-3.507c0-1.553.295-3.036.831-4.398C3.387 10.203 4.167 9.75 5 9.75h1.053c.472 0 .745.556.5.96a8.958 8.958 0 00-1.302 4.665c0 1.194.232 2.333.654 3.375z"
                            />
                          </svg>
                        </div>

                        <div
                          onClick={() => handleMoviePopup(obj)}
                          className="text-white w-9 h-9 border-[2px] rounded-full p-2 mr-1 backdrop-blur-[1px] shadow-md ease-linear transition-all duration-150 hover:text-black hover:bg-white"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                            strokeWidth={1.5}
                            stroke="currentColor"
                            className="text-shadow-xl"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M19.5 8.25l-7.5 7.5-7.5-7.5"
                            />
                          </svg>
                        </div>
                      </div>

                      <h1 className="text-white ml-4 font-medium w-4/5 xl:line-clamp-1">
                        {obj.name || obj.title}
                      </h1>

                      <h1 className="text-white text-xs font-semibold ml-4 w-11/12">
                        {obj.release_date ||
                          (obj.first_air_date && obj.release_date) ||
                          obj.first_air_date}
                      </h1>

                      <div className="ml-4">
                        {obj.vote_average && (
                          <ReactStars
                            count={5}
                            value={obj.vote_average / 2}
                            size={16}
                            activeColor="#5b7ea4"
                            color="#374151"
                            edit={false}
                          />
                        )}
                      </div>

                      {converted &&
                        converted.map((genre, index) => {
                          return (
                            <span key={index} className="hidden text-white ml-4 font-thin text-xs lg:inline">
                              {genre}
                            </span>
                          );
                        })}
                    </Fade>
                  </div>
                </SwiperSlide>
              );
            })}
          </Swiper>
        </>
      ) : (
        <>
          <div className="animate-pulse">
            <div className="w-72 ml-1 mt-2 sm:ml-0 sm:w-96 py-5 mb-5 xl:py-4 2xl:py-6 xl:w-45rem bg-neutral-900 rounded-md"></div>
            <div className="w-91% md:w-98% ml-1 mb-14 sm:ml-0 py-16 md:py-24  bg-neutral-900 rounded-md"></div>
          </div>
        </>
      )}

<>
        {/* Movie Pop Up section */}
        {showModal && (
          <>
            <div className="opacity-40 fixed inset-0 z-40 bg-black pointer-events-none"></div>
            <div className="flex justify-center items-center min-h-screen overflow-x-hidden overflow-y-auto fixed inset-0 z-50 outline-none focus:outline-none pointer-events-auto">
              <div className="relative w-auto my-6 mx-4 max-w-3xl">
                {/*content*/}
                <Fade bottom duration={500}>
                  <div className="border-0 rounded-xl shadow-2xl relative flex flex-col w-full bg-neutral-900 outline-none focus:outline-none overflow-hidden">
                    
                    {/* Header Close Button (The X) */}
                    <button
                      className="group p-2 absolute top-4 right-4 backdrop-blur-md bg-black/40 border border-white/20 hover:bg-white hover:text-black rounded-full cursor-pointer z-20 transition-all duration-200"
                      onClick={() => setShowModal(false)}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>

                    {/* Top Action Row (Play, Add, Like) */}
                    <div className="flex items-center gap-3 px-6 pt-10 pb-2">
                      <button
                        className="flex items-center justify-center bg-white text-black font-bold uppercase text-sm px-6 py-2.5 rounded hover:bg-neutral-300 transition-all duration-200"
                        type="button"
                        onClick={() => handlePlayMovie(moviePopupInfo)}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 mr-2">
                          <path fillRule="evenodd" d="M4.5 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" clipRule="evenodd" />
                        </svg>
                        Play
                      </button>

                      <button
                        onClick={() => addToMyList(moviePopupInfo)}
                        className="flex items-center justify-center text-white w-10 h-10 border-2 border-neutral-500 rounded-full hover:border-white hover:bg-white/10 transition-all"
                        title="Add to List"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                        </svg>
                      </button>

                      <button
                        onClick={() => addToLikedMovies(moviePopupInfo)}
                        className="flex items-center justify-center text-white w-10 h-10 border-2 border-neutral-500 rounded-full hover:border-white hover:bg-white/10 transition-all"
                        title="Like"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6.633 10.5c.806 0 1.533-.446 2.031-1.08a9.041 9.041 0 012.861-2.4c.723-.384 1.35-.956 1.653-1.715a4.498 4.498 0 00.322-1.672V3a.75.75 0 01.75-.75A2.25 2.25 0 0116.5 4.5c0 1.152-.26 2.243-.723 3.218-.266.558.107 1.282.725 1.282h3.126c1.026 0 1.945.694 2.054 1.715.045.422.068.85.068 1.285a11.95 11.95 0 01-2.649 7.521c-.388.482-.987.729-1.605.729H13.48c-.483 0-.964-.078-1.423-.23l-3.114-1.04a4.501 4.501 0 00-1.423-.23H5.904M14.25 9h2.25M5.904 18.75c.083.205.173.405.27.602.197.4-.078.898-.523.898h-.908c-.889 0-1.713-.518-1.972-1.368a12 12 0 01-.521-3.507c0-1.553.295-3.036.831-4.398C3.387 10.203 4.167 9.75 5 9.75h1.053c.472 0 .745.556.5.96a8.958 8.958 0 00-1.302 4.665c0 1.194.232 2.333.654 3.375z" />
                        </svg>
                      </button>
                    </div>

                    {/* Title & Date */}
                    <div className="px-6 py-2">
                      <h3 className="text-2xl sm:text-3xl font-bold text-white">
                        {moviePopupInfo.title || moviePopupInfo.name}
                      </h3>
                      <div className="flex items-center gap-3 mt-2">
                        <span className="text-green-500 font-bold text-sm">
                          {moviePopupInfo.release_date?.split('-')[0] || '2024'}
                        </span>
                        <span className="border border-neutral-600 px-1.5 text-[10px] text-neutral-400 rounded">HD</span>
                      </div>
                    </div>

                    {/* Description */}
                    <div className="px-6 py-4 flex-auto">
                      <p className="text-neutral-300 text-sm md:text-base leading-relaxed line-clamp-4">
                        {moviePopupInfo.overview}
                      </p>
                    </div>

                    {/* Metadata (Rating, Genre, etc) */}
                    <div className="px-6 py-4 bg-black/20 space-y-1">
                        <div className="flex items-center text-xs sm:text-sm">
                          <span className="text-neutral-500 w-24">Rating:</span>
                          <ReactStars
                            count={5}
                            value={moviePopupInfo.vote_average / 2}
                            size={14}
                            activeColor="#5b7ea4"
                            color="#374151"
                            edit={false}
                          />
                        </div>
                        <div className="flex items-center text-xs sm:text-sm">
                          <span className="text-neutral-500 w-24">Genres:</span>
                          <span className="text-neutral-200">
                             {convertGenere(moviePopupInfo.genre_ids).slice(0,3).join(', ')}
                          </span>
                        </div>
                        <div className="flex items-center text-xs sm:text-sm">
                          <span className="text-neutral-500 w-24">Language:</span>
                          <span className="text-neutral-200 uppercase">{moviePopupInfo.original_language}</span>
                        </div>
                    </div>

                    {/* Footer Buttons */}
                    <div className="flex items-center justify-between p-6 bg-neutral-900 border-t border-neutral-800">
                      <button
                        className="flex items-center gap-2 bg-neutral-800 border border-neutral-700 text-white font-semibold text-xs px-5 py-3 rounded hover:bg-neutral-700 transition-all"
                        type="button"
                        onClick={() => addToMyList(moviePopupInfo)}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 text-[#5b7ea4]">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Add to MyList
                      </button>

                      <button
                        className="flex items-center gap-1 text-neutral-400 hover:text-white font-bold uppercase text-xs transition-colors"
                        type="button"
                        onClick={() => setShowModal(false)}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        Close
                      </button>
                    </div>
                  </div>
                </Fade>
              </div>
            </div>
          </>
        )}
      </>

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
    </div>
  );
}

export default RowPost;
