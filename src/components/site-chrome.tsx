import { Link } from "@tanstack/react-router";
import { Mail, Menu, Send, X } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import btc from "@/assets/coins/btc.png.asset.json";
import usdt from "@/assets/coins/usdt.png.asset.json";
import usdtb from "@/assets/coins/usdtb.png.asset.json";
import usdttr from "@/assets/coins/usdttr.png.asset.json";
import ltc from "@/assets/coins/ltc.png.asset.json";
import eth from "@/assets/coins/eth.png.asset.json";
import bnb from "@/assets/coins/bnb.png.asset.json";
import doge from "@/assets/uploads/doge.png.asset.json";
import dash from "@/assets/uploads/dash.png.asset.json";
import xrp from "@/assets/uploads/xrp.png.asset.json";
import xlm from "@/assets/uploads/xlm.png.asset.json";
import trx from "@/assets/uploads/trx.png.asset.json";

const coinIcons = [btc, usdt, usdtb, usdttr, ltc, eth, bnb, trx, doge, dash, xrp, xlm];

function Mark() {
  return <span className="brand-mark" aria-hidden="true"><span className="brand-bar brand-bar-one" /><span className="brand-bar brand-bar-two" /><span className="brand-cut" /></span>;
}

export function Logo() {
  return <Link to="/" className="brand" aria-label="Legacy Pro Alliance home"><Mark /><span>LEGACY PRO <b>ALLIANCE</b></span></Link>;
}

export function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = () => setMenuOpen(false);
  return (
    <>
      <div className="utility-bar">
        <div className="site-width utility-inner">
          <div className="utility-group"><span>SELECT LANGUAGE</span><span className="flag" aria-label="English">🇬🇧</span><strong>LEGACYPROALLIANCE.ORG CRYPTO MANAGEMENT GROUP</strong></div>
          <div className="utility-group"><Send aria-hidden="true" /><a href="mailto:support@legacyproalliance.org"><Mail aria-hidden="true" /> SUPPORT@LEGACYPROALLIANCE.ORG</a></div>
        </div>
      </div>
      <header className="site-header">
        <div className="site-width header-inner">
          <Logo />
          <nav className={menuOpen ? "main-nav is-open" : "main-nav"} aria-label="Main navigation">
            <Link to="/" onClick={closeMenu}>Home</Link>
            <Link to="/about" onClick={closeMenu}>About Us</Link>
            <Link to="/" hash="packages" onClick={closeMenu}>Our Packages</Link>
            <Link to="/" hash="faq" onClick={closeMenu}>FAQ</Link>
            <Link to="/" hash="contact" onClick={closeMenu}>Contact Us</Link>
          </nav>
          <div className="header-actions">
            <Button asChild className="header-signup"><Link to="/" hash="signup">Sign Up</Link></Button>
            <Button asChild variant="outline" className="header-login"><Link to="/" hash="contact">Log In</Link></Button>
          </div>
          <Button type="button" variant="ghost" size="icon" className="menu-toggle" aria-label={menuOpen ? "Close menu" : "Open menu"} onClick={() => setMenuOpen((open) => !open)}>{menuOpen ? <X /> : <Menu />}</Button>
        </div>
      </header>
    </>
  );
}

export function SiteFooter() {
  return (
    <footer id="contact">
      <div className="site-width footer-grid">
        <div className="contact-links"><a href="mailto:support@legacyproalliance.org" className="email-link"><Mail /> Email Us</a><a href="#contact"><Send /> Support</a><a href="#contact"><Send /> Telegram Group</a></div>
        <div><h3>Company</h3><Link to="/about">About us</Link><a href="#contact">Terms</a></div>
        <div><h3>Features</h3><Link to="/" hash="packages">Our Packages</Link><Link to="/" hash="signup">Registration</Link></div>
        <div><h3>Support</h3><Link to="/" hash="faq">FAQ</Link><a href="#contact">Contact Us</a><a href="#contact">Login</a></div>
        <address>Legacyproalliance.Org<br />CRYPTO MANAGEMENT GROUP<br />The Mount, 47 Castle Bank,<br />Stafford, United Kingdom,<br />ST16 1DP</address>
      </div>
      <div className="footer-bottom"><div className="site-width footer-bottom-inner"><p>Copyright © 2026. All Right Reserved.</p><div className="coin-strip" aria-label="Supported cryptocurrencies">{coinIcons.map((coin, index) => <img key={`${coin.asset_id}-${index}`} src={coin.url} alt="" />)}</div></div></div>
    </footer>
  );
}