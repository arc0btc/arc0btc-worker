import { useState, useEffect, useMemo } from "react";
import { Layout } from "./components/Layout";
import { Home } from "./components/Home";
import { Services } from "./components/Services";
import { WalletProvider, type WalletState } from "./components/WalletConnect";

type Route = "home" | "services";

function getRoute(): Route {
  // Support both path-based (/services/) and hash-based (#services) routing
  const path = window.location.pathname;
  if (path === "/services" || path === "/services/") return "services";
  const hash = window.location.hash.replace("#", "");
  if (hash === "services") return "services";
  return "home";
}

export function App() {
  const [route, setRoute] = useState<Route>(getRoute);
  const [wallet, setWallet] = useState<WalletState>({ connected: false });

  useEffect(() => {
    const onHashChange = () => setRoute(getRoute());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const page = useMemo(() => {
    switch (route) {
      case "services":
        return <Services wallet={wallet} />;
      case "home":
        return <Home wallet={wallet} />;
    }
  }, [route, wallet]);

  return (
    <WalletProvider wallet={wallet} setWallet={setWallet}>
      <Layout wallet={wallet} setWallet={setWallet} route={route}>
        {page}
      </Layout>
    </WalletProvider>
  );
}
