const zh = {
  common: {
    languageLabel: '语言',
    languageNames: {
      en: 'English',
      zh: '中文'
    },
    actions: {
      loadAbi: '加载 ABI',
      loading: '加载中…',
      submit: '提交交易',
      submitting: '提交中…',
      connect: '连接',
      disconnect: '断开连接',
      viewOnExplorer: '在 Aptos Explorer 查看'
    },
    messages: {
      parameterValidationFailed: '参数校验失败，请检查输入。'
    },
    errors: {
      unknown: '发生未知错误，请稍后再试。'
    }
  },
  layout: {
    badge: 'Faintlight 工具箱',
    title: 'Web3 多网络实验室',
    subtitle: '以链路为维度组织工具，轻松扩展到 Aptos 之外仍然保持清晰的工作流入口。',
    status: {
      chain: '链',
      tool: '工具'
    },
    footer: '想要支持更多链路？在 src/lib/tools.ts 中扩展配置即可无缝接入新的页面。'
  },
  navigation: {
    groups: {
      overview: {
        title: '控制台',
        hint: '整体介绍与快捷入口。'
      },
      aptos: {
        title: 'Aptos',
        hint: '针对 Aptos 生态打造的实用工具。'
      }
    },
    tools: {
      overview: {
        label: '工作台概览',
        description: '汇总当前可用工具与未来扩展方向。'
      },
      aptosInteraction: {
        label: '合约交互',
        description: '自动获取 ABI，构建交易并直接发起。'
      },
      aptosBcs: {
        label: 'BCS 编 / 解码',
        description: '快速在 BCS 与常见原始类型之间转换。'
      },
      aptosAbi: {
        label: 'ABI 查看器',
        description: '查看和探索模块 ABI 定义与字节码。'
      }
    }
  },
  home: {
    title: 'Web3 多工具工作台',
    description: '从左侧选择链路与工具，快速构建、检查并提交 Aptos 交易，或在 BCS 工具中实验参数。',
    support: {
      title: '当前支持',
      items: [
        '预置网络与自定义节点地址，自动检索模块 ABI 定义。',
        '根据 Move 函数参数动态生成输入表单，支持原始值 / Hex / BCS 三种模式。',
        'BCS 工具页可编码、解码并校验常见原语以及字节向量。'
      ]
    }
  },
  aptos: {
    title: 'Aptos 合约交互',
    description: '连接 Aptos 钱包或使用私钥，自动加载模块 ABI，通过类型感知的输入构建并提交交易。',
    network: {
      label: '网络选择',
      customOption: '自定义',
      customLabel: 'Fullnode URL',
      customPlaceholder: 'https://your-fullnode/v1',
      restLabel: '节点地址'
    },
    module: {
      label: '模块 ID',
      placeholder: '0x1::coin',
      load: '加载 ABI',
      loading: '检索中…',
      errors: {
        missingEndpoint: '请先配置有效的节点地址。',
        invalidFormat: '模块 ID 需要使用 address::module 格式。'
      }
    },
    functions: {
      title: '函数选择',
      empty: '该模块没有暴露 entry 函数。',
      optionLabel: '{name}（{count} 个参数）'
    },
    typeArgs: {
      title: '类型参数',
      label: 'T{index}',
      placeholder: '例如 0x1::coin::CoinInfo',
      hint: '类型参数需要完整的结构体描述，例如 0x1::coin::CoinInfo<0x1::aptos_coin::AptosCoin>。'
    },
    arguments: {
      title: '参数输入',
      none: '该函数不需要额外参数。',
      label: '参数 {index}',
      type: '类型：{type}',
      modes: {
        raw: '原始值',
        hex: 'Hex Vector',
        bcs: 'BCS Hex'
      },
      placeholders: {
        rawString: '输入原始字符串。',
        rawGeneric: '输入与类型匹配的值。',
        hex: '0x…',
        bcs: 'BCS 序列化后的 Hex。'
      },
      hints: {
        rawVector: '原始模式会按 UTF-8 编码文本为字节数组。',
        hex: 'Hex 输入会在提交前转换为字节或字符串。',
        bcs: '输入 BCS Hex。已支持的原语会自动解码，其余类型会直接使用序列化字节。'
      }
    },
    signing: {
      title: '签名方式',
      wallet: 'Aptos 钱包',
      privateKey: '私钥签名',
      statusSectionTitle: '钱包状态',
      connectedSummary: '已连接 {wallet}。',
      notConnectedSummary: '连接 Aptos 钱包后即可在本页直接发起签名。',
      reminderConnectAbove: '请先使用上方的钱包按钮完成连接，再提交交易。',
      walletConnectedTitle: '已连接钱包',
      walletAddress: '地址',
      walletNetwork: '钱包网络',
      disconnect: '断开连接',
      connectPrompt: '选择已安装的钱包进行连接（基于 Aptos Wallet Adapter React）。',
      notDetected: '未检测到兼容钱包，请先安装 Petra 等 Aptos 插件。',
      networkMismatch: '当前钱包网络为 {walletNetwork}，与选择的 {selectedNetwork} 不一致，提交可能失败。',
      statusLabel: '状态：{status}',
      unknownNetwork: '未知'
    },
    walletButton: {
      connect: '连接 Aptos 钱包',
      modalTitle: 'Aptos 钱包',
      walletName: '钱包',
      address: '地址',
      network: '网络',
      balance: 'APT 余额',
      balanceLoading: '正在获取余额…',
      balanceError: '暂时无法获取余额',
      copyAddress: '复制地址',
      copied: '已复制',
      disconnect: '断开钱包',
      availableWallets: '可连接的钱包',
      noWallets: '未检测到兼容钱包。',
      statusLabel: '状态：{status}',
      connectAction: '连接',
      currentWallet: '已连接',
      close: '关闭'
    },
    privateKey: {
      label: '发送者私钥（Hex）',
      placeholder: '0x…',
      hint: '私钥仅在本地用于签名，请确保环境安全。'
    },
    submission: {
      hashLabel: '交易哈希',
      success: '交易提交成功。',
      walletRequired: '请先连接支持的 Aptos 钱包。',
      walletHashMissing: '钱包未返回有效的交易哈希。',
      typeArgMismatch: '类型参数数量与 ABI 不匹配。',
      typeArgMissing: '请补全所有类型参数。',
      privateKeyMissing: '提交前请输入发送者私钥（Hex）。'
    },
    errors: {
      bool: '布尔值仅接受 true/false 或 1/0。',
      numeric: '请输入合法的无符号整数。',
      vectorUnsupported: '暂不支持该 vector 类型的原始输入。',
      hexRequired: '请填写 Hex 字符串。',
      hexUnsupported: '该类型不支持 Hex Vector 输入。',
      bcsRequired: '请填写 BCS Hex 数据。',
      bcsUnsupported: '暂未实现该类型的 BCS 解析。',
      parameterEmpty: '该字段不能为空。',
      missingTypeInfo: '缺少第 {index} 个参数的类型信息。',
      unknownMode: '未知的参数模式。'
    },
    messages: {
      abiLoadError: '无法获取模块 ABI：{message}'
    }
  },
  aptosAbi: {
    title: 'Aptos ABI 查看器',
    description: '探索模块 ABI 定义，查看函数签名、结构体定义和字节码。',
    actions: {
      loadAbi: '加载 ABI',
      expandAll: '全部展开',
      collapseAll: '全部折叠'
    },
    moduleInfo: {
      title: '模块信息',
      address: '地址',
      name: '名称',
      overview: '概览',
      entryFunctions: '入口函数',
      viewFunctions: '视图函数',
      structs: '结构体'
    },
    entryFunctions: {
      title: '入口函数',
      empty: '该模块中没有找到入口函数。'
    },
    viewFunctions: {
      title: '视图函数',
      empty: '该模块中没有找到视图函数。'
    },
    structs: {
      title: '结构体',
      empty: '该模块中没有找到结构体。'
    },
    bytecode: {
      title: '字节码',
      hex: '十六进制表示'
    },
    functionTabs: {
      details: '详情',
      moveCode: 'Move 代码',
      tsExample: 'TypeScript 示例'
    },
    code: {
      copy: '复制',
      copied: '已复制!'
    }
  },
  bcs: {
    title: 'BCS 编码 / 解码',
    description: '面向 Aptos 的常见原语、地址与字节向量，提供编码与解码能力，便于快速校验。',
    mode: {
      encode: 'BCS 编码',
      decode: 'BCS 解码'
    },
    actions: {
      runEncode: '编码为 BCS Hex',
      runDecode: '解码 BCS Hex'
    },
    typeSelect: {
      label: '选择基础类型',
      hint: '先选择一个基础类型，再按需包裹 vector<> 或 Option<>。',
      wrapperLabel: '类型封装',
      addVector: '添加 vector<>',
      addOption: '添加 Option<>',
      clearWrappers: '清除封装',
      wrapperEmpty: '当前未添加任何封装。',
      wrapperHint: '封装按添加顺序由内到外应用，可组合 vector<> 与 Option<>。',
      removeWrapper: '移除 {wrapper}',
      wrapperNames: {
        vector: 'vector',
        option: 'option'
      },
      currentType: '最终类型：{type}'
    },
    options: {
      bool: {
        label: 'bool',
        hint: '单字节 0 / 1。'
      },
      u8: {
        label: 'u8',
        hint: '8 位无符号整数。'
      },
      u16: {
        label: 'u16',
        hint: '16 位无符号整数。'
      },
      u32: {
        label: 'u32',
        hint: '32 位无符号整数。'
      },
      u64: {
        label: 'u64',
        hint: '64 位无符号整数（建议使用字符串输入）。'
      },
      u128: {
        label: 'u128',
        hint: '128 位无符号整数（建议使用字符串输入）。'
      },
      u256: {
        label: 'u256',
        hint: '256 位无符号整数（建议使用字符串输入）。'
      },
      address: {
        label: 'address',
        hint: '32 字节账户地址。'
      },
      string: {
        label: 'string',
        hint: '带长度前缀的 UTF-8 字符串。'
      },
      vectorU8: {
        label: 'vector<u8>',
        hint: '任意字节数组。'
      }
    },
    encode: {
      boolLabel: '布尔值',
      boolHint: '勾选代表 true。',
      vectorModeText: '文本输入',
      vectorModeHex: 'Hex 输入',
      textPlaceholder: 'UTF-8 字符串',
      numberPlaceholder: '输入数值',
      hexPlaceholder: '0x…',
      vectorTextPlaceholder: '任意字符串会按 UTF-8 编码为字节。',
      vectorHexPlaceholder: '0x…',
      jsonPlaceholder: 'JSON 值，例如 ["0x1","0x2"] 或 {"foo":"bar"}',
      jsonHint: '对嵌套的 vector 或 Option 使用 JSON 描述，Option::None 请填写 null。',
      byteLength: '字节长度：{length}B'
    },
    decode: {
      hexPlaceholder: 'BCS Hex，例如 0x0a00'
    },
    results: {
      title: '结果',
      extraTitle: '附加信息',
      rawBytes: '原始字节：{bytes}',
      vectorHex: 'Hex：{hex}',
      vectorText: '作为文本尝试解析：{text}',
      optionSome: 'Some({value})',
      optionNone: 'None'
    },
    errors: {
      valueRequired: '请输入数据。',
      hexRequired: '请输入 BCS Hex。',
      jsonRequired: '请输入 JSON 数据。',
      invalidJson: '无法解析 JSON。',
      vectorRequiresArray: '{type} 需要 JSON 数组。',
      vectorBytesInput: 'vector<u8> 仅支持文本、十六进制或字节数组形式。',
      vectorU8Array: 'vector<u8> 数组元素必须是 0-255 的字节值。',
      invalidNumber: '请输入合法的 {type} 数值。',
      invalidBoolean: '布尔值只能是 true 或 false。',
      unsupportedType: '暂不支持类型：{type}。',
      invalidOptionLength: 'Option 编码的元素数量必须为 0 或 1。'
    }
  },
  notFound: {
    title: '页面不存在',
    message: '请从侧边栏选择一个工具继续。'
  }
} as const;

export default zh;
