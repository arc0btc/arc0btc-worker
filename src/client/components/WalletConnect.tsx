import { createContext, useContext, useCallback, type ReactNode } from "react";
import { showConnect } from "@stacks/connect";
import { STACKS_MAINNET } from "@stacks/network";

export interface WalletState {
  connected: boolean;
  address?: string;
}

interface WalletContextValue {
  wallet: WalletState;
  connect: () => void;
  disconnect: () => void;
}

const WalletContext = createContext<WalletContextValue | null>(null);

export function useWallet(): WalletContextValue {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used within WalletProvider");
  return ctx;
}

interface WalletProviderProps {
  wallet: WalletState;
  setWallet: (state: WalletState) => void;
  children: ReactNode;
}

export function WalletProvider({ wallet, setWallet, children }: WalletProviderProps) {
  const connect = useCallback(() => {
    showConnect({
      appDetails: {
        name: "Arc - arc0.btc",
        icon: "https://arc0.me/avatar.png",
      },
      network: STACKS_MAINNET,
      onFinish: (data) => {
        const address = data.authResponsePayload?.profile?.stxAddress?.mainnet;
        if (address) {
          setWallet({ connected: true, address });
        }
      },
      onCancel: () => {},
    });
  }, [setWallet]);

  const disconnect = useCallback(() => {
    setWallet({ connected: false });
  }, [setWallet]);

  return (
    <WalletContext.Provider value={{ wallet, connect, disconnect }}>
      {children}
    </WalletContext.Provider>
  );
}

export function WalletButton() {
  const { wallet, connect, disconnect } = useWallet();

  if (wallet.connected && wallet.address) {
    const short = `${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)}`;
    return (
      <button className="wallet-button wallet-connected" onClick={disconnect}>
        {short}
      </button>
    );
  }

  return (
    <button className="wallet-button" onClick={connect}>
      Connect Wallet
    </button>
  );
}
