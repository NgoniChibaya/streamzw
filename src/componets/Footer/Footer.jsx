import React from "react";
import styles from "./styles.module.scss";

function Footer2() {
  return (
    <div className="bg-gradient-to-r from-gray-900 via-black to-gray-900 border-t border-gray-800">
      <footer className={styles.footer}>
        <div className={styles.containerFooter}>
          {/* Social Media Links */}
          <div className={styles.socialSection}>
            <h3 className={styles.sectionTitle}>Connect With Us</h3>
            <div className={styles.socialIcons}>
              <a 
                href="https://www.facebook.com/profile.php?id=61587389251294" 
                target="_blank" 
                rel="noopener noreferrer"
                className={styles.socialLink}
                title="Visit our Facebook Page"
              >
                <svg className={styles.icon} width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
              </a>
            </div>
          </div>

          {/* Contact Information */}
          <div className={styles.contactSection}>
            <h3 className={styles.sectionTitle}>Get In Touch</h3>
            <ul className={styles.contactDetails}>
              <li className={styles.contactItem}>
                <svg className={styles.contactIcon} width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M3 8l7.89 7.89c.03.03.09.03.12 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <a href="mailto:support@streamzw.com" className={styles.contactLink}>
                  support@streamzw.com
                </a>
              </li>
            </ul>
          </div>

          {/* Footer Bottom */}
          <div className={styles.footerBottom}>
            <div className={styles.languageSelector}>
              <button className={styles.languageBtn}>
                <svg className={styles.languageIcon} width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M3 5h18M3 12h18M3 19h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                English
              </button>
            </div>
            <div className={styles.copyright}>
              <span>© 2026 StreamZW. All rights reserved.</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default Footer2;
