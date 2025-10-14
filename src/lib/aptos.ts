import { Account, Aptos, AptosConfig, Ed25519PrivateKey, InputEntryFunctionData, Network } from '@aptos-labs/ts-sdk';
import { parseModuleId } from './abi';

export interface SubmitEntryFunctionParams {
  senderPrivateKeyHex: string;
  restUrl: string;
  networkId: 'mainnet' | 'testnet' | 'devnet' | 'custom';
  data: InputEntryFunctionData;
}

export type MoveFunctionAbi = {
  name: string;
  visibility: string;
  is_entry: boolean;
  generic_type_params: unknown[];
  params: string[];
  return: string[];
};

export type MoveModuleAbi = {
  address: string;
  name: string;
  friends: string[];
  exposed_functions: MoveFunctionAbi[];
  structs: unknown[];
};

export async function fetchModuleAbi(restUrl: string, moduleId: string): Promise<MoveModuleAbi> {
  const parsed = parseModuleId(moduleId);
  if (!parsed) {
    throw new Error('Module ID must use address::module format');
  }

  const url = `${restUrl.replace(/\/$/, '')}/accounts/${parsed.address}/module/${parsed.moduleName}`;
  const response = await fetch(url);
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Failed to fetch module ABI: ${response.status} ${detail}`);
  }
  const json = await response.json();

  if (!json?.abi) {
    throw new Error('Response missing ABI data');
  }

  return json.abi as MoveModuleAbi;
}

function resolveNetworkConfig(networkId: SubmitEntryFunctionParams['networkId'], restUrl: string) {
  switch (networkId) {
    case 'mainnet':
      return new AptosConfig({ network: Network.MAINNET, fullnode: restUrl });
    case 'testnet':
      return new AptosConfig({ network: Network.TESTNET, fullnode: restUrl });
    case 'devnet':
      return new AptosConfig({ network: Network.DEVNET, fullnode: restUrl });
    case 'custom':
    default:
      return new AptosConfig({ fullnode: restUrl });
  }
}

export async function submitEntryFunction({ senderPrivateKeyHex, restUrl, networkId, data }: SubmitEntryFunctionParams) {
  const config = resolveNetworkConfig(networkId, restUrl);
  const aptos = new Aptos(config);

  const privateKey = new Ed25519PrivateKey(senderPrivateKeyHex);
  const account = Account.fromPrivateKey({ privateKey });

  const transaction = await aptos.transaction.build.simple({
    sender: account.accountAddress.toString(),
    data
  });

  const pendingTransaction = await aptos.signAndSubmitTransaction({ signer: account, transaction });
  const executed = await aptos.waitForTransaction({ transactionHash: pendingTransaction.hash });

  return executed;
}

function ensureHexPrefix(hash: string) {
  return hash.startsWith('0x') ? hash : `0x${hash}`;
}

const EXPLORER_BASE_BY_NETWORK: Record<string, string> = {
  mainnet: 'https://explorer.aptoslabs.com/txn/',
  testnet: 'https://explorer.aptoslabs.com/txn/',
  devnet: 'https://explorer.aptoslabs.com/txn/'
};

const EXPLORER_QUERY_BY_NETWORK: Record<string, string> = {
  mainnet: '?network=mainnet',
  testnet: '?network=testnet',
  devnet: '?network=devnet'
};

export function getExplorerTxUrl({
  preferredNetwork,
  fallbackNetwork,
  hash
}: {
  preferredNetwork?: string | null;
  fallbackNetwork: SubmitEntryFunctionParams['networkId'];
  hash: string;
}) {
  const normalizedHash = ensureHexPrefix(hash);

  const primary = preferredNetwork?.toLowerCase();
  const primaryBase = primary ? EXPLORER_BASE_BY_NETWORK[primary] : undefined;
  const primaryQuery = primary ? EXPLORER_QUERY_BY_NETWORK[primary] : undefined;

  if (primaryBase) {
    return `${primaryBase}${normalizedHash}${primaryQuery ?? ''}`;
  }

  const fallbackKey = fallbackNetwork !== 'custom' ? fallbackNetwork : 'mainnet';
  const fallbackBase = EXPLORER_BASE_BY_NETWORK[fallbackKey];
  const fallbackQuery = EXPLORER_QUERY_BY_NETWORK[fallbackKey];

  if (!fallbackBase) return null;
  return `${fallbackBase}${normalizedHash}${fallbackQuery ?? ''}`;
}

export async function waitForTransaction(restUrl: string, hash: string) {
  const config = new AptosConfig({ fullnode: restUrl });
  const aptos = new Aptos(config);
  return aptos.waitForTransaction({ transactionHash: ensureHexPrefix(hash) });
}
