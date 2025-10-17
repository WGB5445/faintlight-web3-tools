import { ReactNode, useMemo } from 'react';
import { AptosWalletAdapterProvider } from '@aptos-labs/wallet-adapter-react';

import { useAptosSettings } from './AptosSettingsContext';

interface WalletProviderProps {
  children: ReactNode;
}

export default function WalletProvider({ children }: WalletProviderProps) {
  const { walletNetwork } = useAptosSettings();

  const dappConfig = useMemo(() => ({ network: walletNetwork }), [walletNetwork]);

  return (
    <AptosWalletAdapterProvider key={walletNetwork} autoConnect dappConfig={dappConfig}>
      {children}
    </AptosWalletAdapterProvider>
  );
}
