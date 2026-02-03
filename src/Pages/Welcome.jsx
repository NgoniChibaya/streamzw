import React from "react";
import { useEffect } from "react";

import Footer from "../componets/Footer/Footer";

import WelcomePageImage1 from "../images/WelcomePageImage1.png";
import WelcomePageImage2 from "../images/WelcomePageImage2.png";
import WelcomePageImage3 from "../images/WelcomePageImage3.png";
import WelcomePageImage4 from "../images/WelcomePageImage4.png";


import WelcomePageBanner from "../images/WelcomBannerNew.png";

import { Fade } from "react-reveal";
import { Link } from "react-router-dom";

function Welcome() {
  useEffect(() => {
    //alert("This is NOT REAL NETFLIX so don't Enter your REAL CREDENTIALS")
    const image1 = WelcomePageBanner;
  }, []);

  return (
    <div>
      {/*Hero Section*/}
      <div
        style={{
          background: `linear-gradient(0deg, hsl(0deg 0% 0% / 73%) 0%, hsl(0deg 0% 0% / 73%) 35%),url(${WelcomePageBanner})`,
        }}
        className="h-[32rem] w-full sm:h-[65vh] xl:h-[80vh] bg-slate-800 relative"
      >
        <div className="grid content-center justify-center h-full justify-items-center">
          <div className="w-10/12 text-center sm:w-11/12 md:w-40rem">
            <Fade duration={2000}>
              <h1 className="mb-3 text-3xl font-semibold text-center text-white sm:text-4xl md:text-6xl">
               Your Stories, Our Home.
              </h1>
              <h1 className="mb-4 text-xl text-center text-stone-400 font-light sm:text-2xl">
                Experience Zimbabwe's spirit, whenever, wherever.
              </h1>
              <h1 className="mb-2 text-center text-stone-400 font-light sm:text-xl sm:mb-8">
                  Ready for the journey? Enter your email to unlock StreamZW!"
              </h1>
              <div>
                <input
                  placeholder="Email Address"
                  className="w-full p-2 py-3 rounded-sm sm:py-4 md:py-5 md:w-3/4"
                />
                <Link to={"/signup"}>
                  <button className="px-4 py-2 mt-3 font-medium text-white rounded-sm sm:py-4 md:mt-0 md:pb-5 md:text-xl md:w-1/4" style={{ backgroundColor: "#5b7ea4" }}>
                    Get Started
                  </button>
                </Link>
              </div>
            </Fade>
          </div>
        </div>
        <div
          style={{
            backgroundImage:
              "linear-gradient(hsl(0deg 0% 0% / 0%), hsl(0deg 0% 0% / 38%), hsl(0deg 0% 7%))",
          }}
        ></div>
      </div>

      {/* Section 2 */}


      {/* Section 3 */}
      {/* Section 4 */}


      {/* Section 5 */}


      {/* Section 6 */}
      <section></section>

      {/* Footer */}
      <Footer></Footer>
    </div>
  );
}

export default Welcome;
