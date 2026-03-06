import React, { useState } from "react";
import { Link } from "react-router-dom";
import styles from "./styles.module.scss";

function Footer2() {
  const [email, setEmail] = useState("");
  const [subscribed, setSubscribed] = useState(false);

  const handleSubscribe = (e) => {
    e.preventDefault();
    if (email) {
      setSubscribed(true);
      setEmail("");
      setTimeout(() => setSubscribed(false), 3000);
    }
  };

  return (
    <footer className={styles.footerContainer}>
      {/* Main Footer Content */}
      <div className={styles.footerContent}>
        {/* Brand Section */}
        <div className={styles.brandSection}>
          <h2 className={styles.brandName}>StreamZW</h2>
          <p className={styles.brandDesc}>
            Your ultimate entertainment destination. Stream unlimited movies and shows anywhere, anytime.
          </p>
          
          {/* Social Media Links */}
          <div className={styles.socialLinks}>
            <a href="https://www.facebook.com/profile.php?id=61587389251294" target="_blank" rel="noopener noreferrer" className={styles.socialIcon} title="Facebook">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
              </svg>
            </a>
            <a href="#" className={styles.socialIcon} title="Twitter">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M23 3a10.9 10.9 0 01-3.14 1.53 4.48 4.48 0 00-7.86 3v1A10.66 10.66 0 013 4s-4 9 5 13a11.64 11.64 0 01-7 2s9 5 20 5a9.5 9.5 0 00-9-5.5c4.75 2.25 7-7 7-7a10.6 10.6 0 01-9.999 4z"/>
              </svg>
            </a>
            <a href="#" className={styles.socialIcon} title="Instagram">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <rect x="2" y="2" width="20" height="20" rx="5" ry="5" fill="none" stroke="currentColor" strokeWidth="2"/>
                <path d="M16 11.37A4 4 0 1112.63 8 4 4 0 0116 11.37z" fill="currentColor"/>
                <circle cx="17.5" cy="6.5" r="1.5" fill="currentColor"/>
              </svg>
            </a>
            <a href="#" className={styles.socialIcon} title="LinkedIn">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M16 8a6 6 0 016 6v7h-4v-7a2 2 0 00-2-2 2 2 0 00-2 2v7h-4v-7a6 6 0 016-6zM2 9h4v12H2z"/>
                <circle cx="4" cy="4" r="2"/>
              </svg>
            </a>
          </div>
        </div>

        {/* Links Sections */}
        <div className={styles.linksGrid}>
          {/* Product */}
          <div className={styles.linkSection}>
            <h3 className={styles.linkSectionTitle}>Product</h3>
            <ul className={styles.linkList}>
              <li><a href="#features" className={styles.link}>Features</a></li>
              <li><a href="#pricing" className={styles.link}>Pricing</a></li>
              <li><a href="#downloads" className={styles.link}>Downloads</a></li>
              <li><a href="#quality" className={styles.link}>Video Quality</a></li>
            </ul>
          </div>

          {/* Company */}
          <div className={styles.linkSection}>
            <h3 className={styles.linkSectionTitle}>Company</h3>
            <ul className={styles.linkList}>
              <li>
                <Link to="/about" className={styles.link}>
                  About Us
                </Link>
              </li>
              <li><a href="#careers" className={styles.link}>Careers</a></li>
              <li><a href="#press" className={styles.link}>Press</a></li>
              <li><a href="#blog" className={styles.link}>Blog</a></li>
            </ul>
          </div>

          {/* Support */}
          <div className={styles.linkSection}>
            <h3 className={styles.linkSectionTitle}>Support</h3>
            <ul className={styles.linkList}>
              <li><a href="#help" className={styles.link}>Help Center</a></li>
              <li><a href="#contact" className={styles.link}>Contact Us</a></li>
              <li><a href="#faq" className={styles.link}>FAQ</a></li>
              <li><a href="#status" className={styles.link}>Status</a></li>
            </ul>
          </div>

          {/* Newsletter */}
          <div className={styles.linkSection}>
            <h3 className={styles.linkSectionTitle}>Stay Updated</h3>
            <p className={styles.newsletterDesc}>Subscribe to get updates on new releases</p>
            <form className={styles.newsletterForm} onSubmit={handleSubscribe}>
              <input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={styles.emailInput}
                required
              />
              <button type="submit" className={styles.subscribeBtn}>
                {subscribed ? "✓ Subscribed" : "Subscribe"}
              </button>
            </form>
            {subscribed && (
              <p className={styles.successMsg}>Thank you for subscribing!</p>
            )}
          </div>
        </div>
      </div>

      {/* Footer Bottom */}
      <div className={styles.footerBottom}>
        <div className={styles.bottomLeft}>
          <p className={styles.copyright}>© 2026 StreamZW. All rights reserved.</p>
        </div>
        <div className={styles.bottomRight}>
          <a href="#privacy" className={styles.bottomLink}>Privacy Policy</a>
          <span className={styles.separator}>·</span>
          <a href="#terms" className={styles.bottomLink}>Terms of Service</a>
          <span className={styles.separator}>·</span>
          <a href="#cookies" className={styles.bottomLink}>Cookie Settings</a>
        </div>
      </div>
    </footer>
  );
}

export default Footer2;
