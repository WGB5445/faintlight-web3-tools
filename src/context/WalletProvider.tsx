import { ReactNode, useMemo } from 'react';
import { AptosWalletAdapterProvider } from '@aptos-labs/wallet-adapter-react';
import { Network } from '@aptos-labs/ts-sdk';
interface WalletProviderProps {
  children: ReactNode;
}

export default function WalletProvider({ children }: WalletProviderProps) {
  return (
    <AptosWalletAdapterProvider autoConnect dappConfig={
      {
        network: Network.TESTNET
      }
    }>
      {children}
    </AptosWalletAdapterProvider>
  );
}
