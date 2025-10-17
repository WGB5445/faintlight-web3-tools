import { ReactNode, createContext, useContext, useMemo, useState } from 'react';
import { Network } from '@aptos-labs/ts-sdk';

import { resolveRestEndpoint } from '../lib/networks';

export type AptosNetworkId = 'mainnet' | 'testnet' | 'devnet' | 'custom';

interface AptosSettingsContextValue {
  networkId: AptosNetworkId;
  setNetworkId: (id: AptosNetworkId) => void;
  customEndpoint: string;
  setCustomEndpoint: (endpoint: string) => void;
  restEndpoint: string;
  walletNetwork: Network;
}

const AptosSettingsContext = createContext<AptosSettingsContextValue | undefined>(undefined);

export function AptosSettingsProvider({ children }: { children: ReactNode }) {
  const [networkId, setNetworkId] = useState<AptosNetworkId>('testnet');
  const [customEndpoint, setCustomEndpoint] = useState('');

  const restEndpoint = useMemo(() => resolveRestEndpoint(networkId, customEndpoint), [networkId, customEndpoint]);

  const walletNetwork = useMemo(() => {
    switch (networkId) {
      case 'mainnet':
        return Network.MAINNET;
      case 'devnet':
        return Network.DEVNET;
      case 'testnet':
        return Network.TESTNET;
      default:
        return Network.CUSTOM;
    }
  }, [networkId]);

  const value = useMemo(
    () => ({
      networkId,
      setNetworkId,
      customEndpoint,
      setCustomEndpoint,
      restEndpoint,
      walletNetwork
    }),
    [networkId, customEndpoint, restEndpoint, walletNetwork]
  );

  return <AptosSettingsContext.Provider value={value}>{children}</AptosSettingsContext.Provider>;
}

export function useAptosSettings() {
  const context = useContext(AptosSettingsContext);
  if (!context) {
    throw new Error('useAptosSettings must be used within an AptosSettingsProvider');
  }
  return context;
}
