export type AptosPredefinedNetwork = 'mainnet' | 'testnet' | 'devnet';

export type AptosNetworkOption = {
  id: AptosPredefinedNetwork | 'custom';
  label: string;
  restUrl: string;
  faucetUrl?: string;
};

export const APTOS_NETWORKS: AptosNetworkOption[] = [
  {
    id: 'mainnet',
    label: 'Mainnet',
    restUrl: 'https://fullnode.mainnet.aptoslabs.com/v1',
    faucetUrl: undefined
  },
  {
    id: 'testnet',
    label: 'Testnet',
    restUrl: 'https://fullnode.testnet.aptoslabs.com/v1',
    faucetUrl: 'https://faucet.testnet.aptoslabs.com/v1'
  },
  {
    id: 'devnet',
    label: 'Devnet',
    restUrl: 'https://fullnode.devnet.aptoslabs.com/v1',
    faucetUrl: 'https://faucet.devnet.aptoslabs.com/v1'
  }
];

export function resolveRestEndpoint(id: AptosNetworkOption['id'], customEndpoint?: string) {
  if (id === 'custom') {
    return customEndpoint?.trim() ?? '';
  }

  const found = APTOS_NETWORKS.find((item) => item.id === id);
  return found?.restUrl ?? '';
}
