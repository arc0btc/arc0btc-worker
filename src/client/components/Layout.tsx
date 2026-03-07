import type { ReactNode } from "react";
import { WalletButton, type WalletState } from "./WalletConnect";

interface LayoutProps {
  wallet: WalletState;
  setWallet: (state: WalletState) => void;
  route: string;
  children: ReactNode;
}

export function Layout({ route, children }: LayoutProps) {
  return (
    <>
      <header className="site-header">
        <div className="header-left">
          <a href="#" className="header-brand">
            <img className="header-avatar" src="https://arc0.me/avatar.png" alt="Arc avatar" />
            <div>
              <h1 className="header-title">Arc</h1>
              <p className="header-tagline">arc0.btc</p>
            </div>
          </a>
          <nav className="header-nav">
            <a href="#" className={route === "home" ? "nav-active" : ""}>Home</a>
            <a href="#services" className={route === "services" ? "nav-active" : ""}>Services</a>
          </nav>
        </div>
        <div className="header-right">
          <WalletButton />
        </div>
      </header>

      <main className="container">
        {children}
      </main>

      <footer className="site-footer">
        <p>Arc &bull; arc0.btc &bull; Genesis Agent #1</p>
        <div className="footer-links">
          <a href="https://arc0.me" target="_blank" rel="noopener noreferrer">arc0.me</a>
          <a href="https://github.com/arc0btc/arc-starter" target="_blank" rel="noopener noreferrer">GitHub</a>
          <a href="https://aibtc.com" target="_blank" rel="noopener noreferrer">AIBTC</a>
          <a href="/health">Health</a>
        </div>
      </footer>

      <style>{layoutStyles}</style>
    </>
  );
}

const layoutStyles = `
  .site-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1.25rem 1.5rem;
    border-bottom: 1px solid var(--border);
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 1.5rem;
  }

  .header-brand {
    display: flex;
    align-items: center;
    gap: 1rem;
    text-decoration: none;
  }

  .header-brand:hover {
    text-decoration: none;
  }

  .header-nav {
    display: flex;
    gap: 0.25rem;
  }

  .header-nav a {
    color: var(--text);
    text-decoration: none;
    padding: 0.35rem 0.75rem;
    font-size: 0.9rem;
    opacity: 0.7;
    transition: opacity 0.15s;
  }

  .header-nav a:hover {
    opacity: 1;
    text-decoration: none;
  }

  .header-nav .nav-active {
    color: var(--gold);
    opacity: 1;
    border-bottom: 2px solid var(--gold);
  }

  .header-avatar {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    border: 2px solid var(--gold);
  }

  .header-title {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--text-white);
    line-height: 1.2;
  }

  .header-tagline {
    font-size: 0.85rem;
    color: var(--text);
    opacity: 0.7;
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .wallet-button {
    background: var(--gold);
    color: #000;
    border: none;
    padding: 0.5rem 1.25rem;
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.15s;
  }

  .wallet-button:hover {
    background: var(--gold-hover);
  }

  .wallet-connected {
    background: var(--surface);
    color: var(--gold);
    border: 1px solid var(--border);
    font-family: var(--font-mono);
    font-size: 0.8rem;
  }

  .wallet-connected:hover {
    background: var(--border);
  }

  .container {
    max-width: 900px;
    margin: 0 auto;
    padding: 2rem 1.5rem;
  }

  .site-footer {
    text-align: center;
    padding: 2rem 1.5rem;
    color: var(--text);
    opacity: 0.6;
    border-top: 1px solid var(--border);
    font-size: 0.9rem;
  }

  .footer-links {
    margin-top: 0.75rem;
  }

  .footer-links a {
    margin: 0 0.75rem;
    color: var(--gold);
    text-decoration: none;
  }

  .footer-links a:hover {
    text-decoration: underline;
  }

  @media (max-width: 640px) {
    .site-header {
      flex-direction: column;
      gap: 1rem;
      text-align: center;
    }

    .header-left {
      flex-direction: column;
      gap: 0.75rem;
    }

    .header-brand {
      flex-direction: column;
      gap: 0.5rem;
    }
  }
`;
