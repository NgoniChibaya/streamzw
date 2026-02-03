import React from "react";
import styles from "./styles.module.scss";

function Footer2() {
  return (
    <div className="bg-black p-2">
      <footer className={styles.footer}>
        <div className={styles.containerFooter}>
          <div className={styles.icons}></div>
          <ul className={styles.details}>
            <li>Contact Us</li>
          </ul>
          <div className={styles.security}>
            <div>Engligh</div>
            <span>© NSoft</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default Footer2;
