import { useState, useMemo } from "react";
import { Layout } from "./components/Layout";
import { Home } from "./components/Home";
import { WalletProvider, type WalletState } from "./components/WalletConnect";

type Route = "home";

function getRoute(): Route {
  return "home";
}

export function App() {
  const [route] = useState<Route>(getRoute);
  const [wallet, setWallet] = useState<WalletState>({ connected: false });

  const page = useMemo(() => {
    switch (route) {
      case "home":
        return <Home wallet={wallet} />;
    }
  }, [route, wallet]);

  return (
    <WalletProvider wallet={wallet} setWallet={setWallet}>
      <Layout wallet={wallet} setWallet={setWallet}>
        {page}
      </Layout>
    </WalletProvider>
  );
}
