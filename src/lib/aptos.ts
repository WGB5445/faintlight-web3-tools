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

export function getExplorerTxUrl(networkId: SubmitEntryFunctionParams['networkId'], hash: string) {
  const normalizedHash = ensureHexPrefix(hash);
  switch (networkId) {
    case 'mainnet':
      return `https://explorer.aptoslabs.com/txn/${normalizedHash}?network=mainnet`;
    case 'testnet':
      return `https://explorer.aptoslabs.com/txn/${normalizedHash}?network=testnet`;
    case 'devnet':
      return `https://explorer.aptoslabs.com/txn/${normalizedHash}?network=devnet`;
    default:
      return null;
  }
}

export async function waitForTransaction(restUrl: string, hash: string) {
  const config = new AptosConfig({ fullnode: restUrl });
  const aptos = new Aptos(config);
  return aptos.waitForTransaction({ transactionHash: ensureHexPrefix(hash) });
}
