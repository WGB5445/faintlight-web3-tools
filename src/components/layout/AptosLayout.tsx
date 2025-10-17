import { useEffect, useMemo } from 'react';
import { Outlet, useOutletContext } from 'react-router-dom';
import { useWallet, WalletReadyState } from '@aptos-labs/wallet-adapter-react';

import WalletProvider from '../../context/WalletProvider';
import { AptosSettingsProvider, useAptosSettings } from '../../context/AptosSettingsContext';
import { useLanguage } from '../../context/LanguageContext';
import { AppShellOutletContext } from './AppShell';
import { normalizeAddress } from '../../lib/address';
import { defaultRestUrlForWallet } from '../../lib/networks';
import AptosWalletButton from '../wallet/AptosWalletButton';

function isSelectableWallet(wallet: ReturnType<typeof useWallet>['wallets'][number]) {
  return wallet.readyState === WalletReadyState.Installed;
}

function AptosHeaderAccessory() {
  const { setHeaderAccessory } = useOutletContext<AppShellOutletContext>();
  const { t } = useLanguage();
  const { wallets, connect, disconnect, connected, account, wallet, network } = useWallet();
  const { restEndpoint } = useAptosSettings();

  const availableWallets = useMemo(
    () =>
      wallets
        .filter(isSelectableWallet)
        .map((item) => ({ name: item.name, readyState: item.readyState ?? 'NotDetected' })),
    [wallets]
  );

  const address = normalizeAddress(account?.address);
  const networkLabel = (network?.name as string) ?? t('aptos.signing.unknownNetwork');
  const fallbackRestUrl = defaultRestUrlForWallet(network?.name ?? null);
  const restUrl = restEndpoint || fallbackRestUrl;

  const accessory = useMemo(
    () => (
      <AptosWalletButton
        connected={connected}
        walletName={wallet?.name ?? null}
        address={address}
        networkLabel={networkLabel}
        restUrl={restUrl}
        availableWallets={availableWallets}
        onConnect={async (walletName: string) => {
          await connect(walletName);
        }}
        onDisconnect={async () => {
          await disconnect();
        }}
      />
    ),
    [connected, wallet?.name, address, networkLabel, restUrl, availableWallets, connect, disconnect]
  );

  useEffect(() => {
    setHeaderAccessory(accessory);
    return () => setHeaderAccessory(null);
  }, [accessory, setHeaderAccessory]);

  return null;
}

export default function AptosLayout() {
  return (
    <AptosSettingsProvider>
      <WalletProvider>
        <AptosHeaderAccessory />
        <Outlet />
      </WalletProvider>
    </AptosSettingsProvider>
  );
}
