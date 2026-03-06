import React from "react";
import Footer from "../componets/Footer/Footer";

function About() {
  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-6xl mx-auto px-4 py-16">
        <h1 className="text-4xl font-bold mb-4">About StreamZW</h1>
        <p className="text-lg text-gray-200 mb-6">
          StreamZW is a US-based streaming platform dedicated to amplifying the voices of African creators.
          We make it easy for audiences worldwide to discover authentic stories, music, and film made by
          talented artists across the continent.
        </p>

        <h2 className="text-2xl font-semibold mb-3">Our Mission</h2>
        <p className="text-gray-200 mb-6">
          We believe in bringing Africa’s creativity to a global stage. Our platform is built to support
          creators by providing a home for their content and helping them reach new audiences.
        </p>

        <h2 className="text-2xl font-semibold mb-3">How We Work</h2>
        <p className="text-gray-200 mb-4">
          StreamZW works with a network of marketing agents based in Zimbabwe who are responsible for
          discovering new content, working with artists, and managing payments. This local presence
          ensures creators get the support they need while keeping the platform closely connected to
          the communities it serves.
        </p>

        <h2 className="text-2xl font-semibold mb-3">Our Vision</h2>
        <p className="text-gray-200">
          Your Stories, Our Home. Experience Zimbabwe’s spirit, whenever, wherever.
        </p>
      </div>

      <Footer />
    </div>
  );
}

export default About;
