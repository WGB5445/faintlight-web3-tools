import { ReactNode, useMemo } from 'react';
import { AptosWalletAdapterProvider } from '@aptos-labs/wallet-adapter-react';

interface WalletProviderProps {
  children: ReactNode;
}

export default function WalletProvider({ children }: WalletProviderProps) {
  return (
    <AptosWalletAdapterProvider autoConnect>
      {children}
    </AptosWalletAdapterProvider>
  );
}
