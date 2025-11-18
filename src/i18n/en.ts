const en = {
  common: {
    languageLabel: 'Language',
    languageNames: {
      en: 'English',
      zh: '中文'
    },
    actions: {
      loadAbi: 'Load ABI',
      loading: 'Loading…',
      submit: 'Submit Transaction',
      submitting: 'Submitting…',
      connect: 'Connect',
      disconnect: 'Disconnect',
      viewOnExplorer: 'View on Aptos Explorer'
    },
    messages: {
      parameterValidationFailed: 'Argument validation failed. Please review your inputs.'
    },
    errors: {
      unknown: 'Something went wrong. Please try again.'
    }
  },
  layout: {
    badge: 'Faintlight Toolkit',
    title: 'Web3 Multi-Network Lab',
    subtitle:
      'Tools are organized by blockchain so you can quickly expand beyond Aptos while keeping each workflow discoverable.',
    status: {
      chain: 'Chain',
      tool: 'Tool'
    },
    footer:
      'Need another chain? Extend the catalog inside src/lib/tools.ts and plug new routes into the current layout.'
  },
  navigation: {
    groups: {
      overview: {
        title: 'Control Desk',
        hint: 'High-level introduction and quick links.'
      },
      aptos: {
        title: 'Aptos',
        hint: 'Utilities tailored for the Aptos ecosystem.'
      }
    },
    tools: {
      overview: {
        label: 'Workspace Overview',
        description: 'Summary of available tools and future expansion ideas.'
      },
      aptosInteraction: {
        label: 'Contract Interaction',
        description: 'Fetch ABI, craft payloads, and submit transactions.'
      },
      aptosBcs: {
        label: 'BCS Encoder / Decoder',
        description: 'Convert values to and from Aptos BCS primitives.'
      },
      aptosAbi: {
        label: 'ABI Viewer',
        description: 'View and explore module ABI definitions and bytecode.'
      },
      aptosGasSchedule: {
        label: 'Gas Schedule Lookup',
        description: 'Browse and search Aptos gas schedule entries with filtering and sorting.'
      }
    }
  },
  home: {
    title: 'Web3 Tooling Workbench',
    description:
      'Pick a chain and tool from the left sidebar to build, inspect, and submit Aptos transactions or experiment with BCS payloads.',
    support: {
      title: 'Currently available',
      items: [
        'Network presets plus custom endpoints for retrieving module ABI definitions.',
        'Dynamic parameter inputs that adapt to Move function signatures and support raw, hex, or BCS modes.',
        'BCS utility page for encoding, decoding, and cross-checking primitive values and byte vectors.'
      ]
    }
  },
  aptos: {
    title: 'Aptos Contract Interaction',
    description:
      'Connect an Aptos wallet or provide a private key, auto-load module ABI metadata, and submit transactions with type-aware inputs.',
    network: {
      label: 'Network',
      customOption: 'Custom',
      customLabel: 'Fullnode URL',
      customPlaceholder: 'https://your-fullnode/v1',
      restLabel: 'REST Endpoint'
    },
    module: {
      label: 'Module ID',
      placeholder: '0x1::coin',
      load: 'Load ABI',
      loading: 'Loading…',
      errors: {
        missingEndpoint: 'Please configure a valid fullnode endpoint first.',
        invalidFormat: 'Module ID must follow address::module format.'
      }
    },
    functions: {
      title: 'Entry Function',
      empty: 'This module does not expose entry functions.',
      optionLabel: '{name} ({count} params)'
    },
    typeArgs: {
      title: 'Type Arguments',
      label: 'T{index}',
      placeholder: 'e.g. 0x1::coin::CoinInfo',
      hint: 'Type arguments must use fully qualified names such as 0x1::coin::CoinInfo<0x1::aptos_coin::AptosCoin>.'
    },
    arguments: {
      title: 'Arguments',
      none: 'The selected function does not require extra arguments.',
      label: 'Argument {index}',
      type: 'Type: {type}',
      modes: {
        raw: 'Raw Value',
        hex: 'Hex Vector',
        bcs: 'BCS Hex'
      },
      placeholders: {
        rawString: 'Enter plain text.',
        rawGeneric: 'Enter a value that matches the parameter type.',
        hex: '0x…',
        bcs: 'BCS-serialized hex data.'
      },
      hints: {
        rawVector: 'Raw mode encodes the supplied text as UTF-8 bytes.',
        hex: 'Hex input is converted into bytes or strings before submission.',
        bcs: 'Provide BCS hex. Known primitives decode automatically; other types send the serialized bytes as-is.'
      }
    },
    signing: {
      title: 'Signing Method',
      wallet: 'Aptos Wallet',
      privateKey: 'Private Key',
      statusSectionTitle: 'Wallet Status',
      connectedSummary: 'Connected with {wallet}.',
      notConnectedSummary: 'Connect an Aptos wallet to enable one-click signing on this page.',
      reminderConnectAbove: 'Use the wallet button above to connect your wallet before submitting.',
      walletConnectedTitle: 'Connected Wallet',
      walletAddress: 'Address',
      walletNetwork: 'Wallet network',
      disconnect: 'Disconnect',
      connectPrompt: 'Choose an installed wallet to connect (powered by Aptos Wallet Adapter React).',
      notDetected: 'No compatible wallet detected. Install Petra or another Aptos wallet extension.',
      networkMismatch: 'Your wallet network is {walletNetwork}, which differs from the selected {selectedNetwork}. Submission may fail.',
      statusLabel: 'Status: {status}',
      unknownNetwork: 'unknown'
    },
    walletButton: {
      connect: 'Connect Aptos Wallet',
      modalTitle: 'Aptos Wallet',
      walletName: 'Wallet',
      address: 'Address',
      network: 'Network',
      balance: 'APT Balance',
      balanceLoading: 'Fetching balance…',
      balanceError: 'Unable to load balance',
      copyAddress: 'Copy address',
      copied: 'Copied!',
      disconnect: 'Disconnect wallet',
      availableWallets: 'Available wallets',
      noWallets: 'No compatible wallets detected.',
      statusLabel: 'Status: {status}',
      connectAction: 'Connect',
      currentWallet: 'Connected',
      close: 'Close'
    },
    privateKey: {
      label: 'Sender private key (hex)',
      placeholder: '0x…',
      hint: 'Keys are used locally for signing only. Ensure you are operating in a trusted environment.'
    },
    submission: {
      hashLabel: 'Transaction hash',
      success: 'Transaction submitted successfully.',
      walletRequired: 'Please connect a supported Aptos wallet first.',
      walletHashMissing: 'The wallet did not return a valid transaction hash.',
      typeArgMismatch: 'The number of type arguments does not match the ABI.',
      typeArgMissing: 'Please complete every type argument.',
      privateKeyMissing: 'Enter a sender private key (hex) before submitting.'
    },
    errors: {
      bool: 'Boolean values accept only true/false or 1/0.',
      numeric: 'Enter a valid unsigned integer.',
      vectorUnsupported: 'This vector type does not support raw input yet.',
      hexRequired: 'Provide a hex string.',
      hexUnsupported: 'Hex vector input is not available for this type.',
      bcsRequired: 'Provide BCS hex data.',
      bcsUnsupported: 'BCS decoding is not yet implemented for this type.',
      parameterEmpty: 'This value is required.',
      missingTypeInfo: 'Missing type information for argument {index}.',
      unknownMode: 'Unknown argument mode.'
    },
    messages: {
      abiLoadError: 'Failed to load module ABI: {message}'
    }
  },
  aptosAbi: {
    title: 'Aptos ABI Viewer',
    description: 'Explore module ABI definitions, view function signatures, struct definitions, and bytecode.',
    actions: {
      loadAbi: 'Load ABI',
      expandAll: 'Expand All',
      collapseAll: 'Collapse All'
    },
    moduleInfo: {
      title: 'Module Information',
      address: 'Address',
      name: 'Name',
      overview: 'Overview',
      entryFunctions: 'Entry Functions',
      viewFunctions: 'View Functions',
      structs: 'Structs'
    },
    entryFunctions: {
      title: 'Entry Functions',
      empty: 'No entry functions found in this module.'
    },
    viewFunctions: {
      title: 'View Functions',
      empty: 'No view functions found in this module.'
    },
    structs: {
      title: 'Structs',
      empty: 'No structs found in this module.'
    },
    bytecode: {
      title: 'Bytecode',
      hex: 'Hex Representation'
    },
    functionTabs: {
      details: 'Details',
      moveCode: 'Move Code',
      tsExample: 'TypeScript Example'
    },
    code: {
      copy: 'Copy',
      copied: 'Copied!'
    }
  },
  bcs: {
    title: 'BCS Encoding / Decoding',
    description: 'Encode and decode common Aptos primitives, addresses, and byte vectors to verify payloads quickly.',
    mode: {
      encode: 'BCS Encode',
      decode: 'BCS Decode'
    },
    actions: {
      runEncode: 'Encode to BCS hex',
      runDecode: 'Decode BCS hex'
    },
    typeSelect: {
      label: 'Select base type',
      hint: 'Pick a primitive type and optionally wrap it before encoding.',
      wrapperLabel: 'Wrappers',
      addVector: 'Add vector<>',
      addOption: 'Add Option<>',
      clearWrappers: 'Clear wrappers',
      wrapperEmpty: 'No wrappers applied.',
      wrapperHint: 'Wrappers apply outside-in. Combine vector<> and Option<> to compose complex types.',
      removeWrapper: 'Remove {wrapper}',
      wrapperNames: {
        vector: 'vector',
        option: 'option'
      },
      currentType: 'Effective type: {type}'
    },
    options: {
      bool: {
        label: 'bool',
        hint: 'Single byte 0/1.'
      },
      u8: {
        label: 'u8',
        hint: 'Unsigned 8-bit integer.'
      },
      u16: {
        label: 'u16',
        hint: 'Unsigned 16-bit integer.'
      },
      u32: {
        label: 'u32',
        hint: 'Unsigned 32-bit integer.'
      },
      u64: {
        label: 'u64',
        hint: 'Unsigned 64-bit integer (use strings for big values).'
      },
      u128: {
        label: 'u128',
        hint: 'Unsigned 128-bit integer (use strings).'
      },
      u256: {
        label: 'u256',
        hint: 'Unsigned 256-bit integer (use strings).'
      },
      address: {
        label: 'address',
        hint: '32-byte account address.'
      },
      string: {
        label: 'string',
        hint: 'UTF-8 string with length prefix.'
      },
      vectorU8: {
        label: 'vector<u8>',
        hint: 'Arbitrary byte array.'
      }
    },
    encode: {
      boolLabel: 'Boolean value',
      boolHint: 'Checked is true.',
      vectorModeText: 'Text input',
      vectorModeHex: 'Hex input',
      textPlaceholder: 'UTF-8 string',
      numberPlaceholder: 'Enter value',
      hexPlaceholder: '0x…',
      vectorTextPlaceholder: 'Any string will be encoded as UTF-8 bytes.',
      vectorHexPlaceholder: '0x…',
      jsonPlaceholder: 'JSON value, e.g. ["0x1", "0x2"] or {"foo":"bar"}',
      jsonHint: 'Use JSON to describe nested vectors or options. Use null for Option::None.',
      byteLength: 'Byte length: {length}B'
    },
    decode: {
      hexPlaceholder: 'BCS hex, e.g. 0x0a00'
    },
    results: {
      title: 'Result',
      extraTitle: 'Additional info',
      rawBytes: 'Raw bytes: {bytes}',
      vectorHex: 'Hex: {hex}',
      vectorText: 'Interpreted as text: {text}',
      optionSome: 'Some({value})',
      optionNone: 'None'
    },
    errors: {
      valueRequired: 'Please provide a value.',
      hexRequired: 'Please provide BCS hex data.',
      jsonRequired: 'Provide a JSON value.',
      invalidJson: 'Invalid JSON input.',
      vectorRequiresArray: '{type} expects a JSON array.',
      vectorBytesInput: 'vector<u8> requires hex, text, or an array of bytes.',
      vectorU8Array: 'vector<u8> arrays must contain byte values (0-255).',
      invalidNumber: 'Enter a valid {type} value.',
      invalidBoolean: 'Boolean values must be true or false.',
      unsupportedType: 'Unsupported type: {type}.',
      invalidOptionLength: 'Option encoding must contain 0 or 1 element.'
    }
  },
  gasSchedule: {
    title: 'Gas Schedule Lookup',
    description: 'Browse, search, and analyze Aptos gas schedule entries from the chain.',
    actions: {
      load: 'Load Gas Schedule',
      reload: 'Reload',
      loading: 'Loading…',
      copy: 'Copy',
      copied: 'Copied!',
      copyAllKeys: 'Copy All Keys'
    },
    errors: {
      missingEndpoint: 'Please configure a valid fullnode endpoint first.',
      loadError: 'Failed to load gas schedule: {message}'
    },
    statistics: {
      title: 'Statistics',
      featureVersion: 'Feature Version',
      scalingFactor: 'Scaling Factor',
      totalEntries: 'Total Entries',
      filteredEntries: 'Filtered Entries',
      byType: 'By Type',
      other: 'Other',
      valueRange: 'Value Range',
      min: 'Min',
      max: 'Max',
      avg: 'Average'
    },
    filters: {
      title: 'Filters & Sort',
      search: 'Search',
      searchPlaceholder: 'Search by key name...',
      type: 'Filter by Type',
      typeAll: 'All Types',
      typeInstr: 'Instructions (instr.*)',
      typeTxn: 'Transactions (txn.*)',
      typeOther: 'Other',
      sortBy: 'Sort By',
      sortKey: 'Key',
      sortValue: 'Value',
      sortOrder: 'Sort Order',
      sortAsc: 'Ascending',
      sortDesc: 'Descending',
      showExternalGas: 'Show External Gas Units'
    },
    entries: {
      title: 'Gas Schedule Entries',
      key: 'Key',
      value: 'Value',
      actions: 'Actions',
      empty: 'No entries match the current filters.'
    }
  },
  notFound: {
    title: 'Page not found',
    message: 'Select a tool from the sidebar to continue.'
  }
} as const;

export default en;
