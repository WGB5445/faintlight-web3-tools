# Faintlight Web3 Tools

使用最新的 Vite + React + Tailwind 技术栈打造的 Web3 多工具工作台，当前专注 Aptos 生态：

- **Aptos 合约交互工具**：选择网络、自动拉取模块 ABI、动态生成函数输入表单，并支持原始值 / Hex Vector / BCS Hex 三种参数输入模式，最终在页面内签名并提交交易。
- **BCS 编/解码工具**：针对常见原语、地址与 `vector<u8>` 字节数组提供一键编码/解码，协助调试链上数据。

## 快速开始

```bash
npm install
npm run dev
```

- 默认开发服务器运行在 `http://localhost:5173`。
- 所有依赖均已配置为最新稳定版本，可按需升级。

## 功能详情

### Aptos 合约交互

1. 选择预置网络（Mainnet/Testnet/Devnet）或自定义 Fullnode URL。
2. 输入模块 ID（`<address>::<module>` 格式），点击“加载 ABI”自动检索合约 ABI。
3. 从下拉框中选择目标 entry 函数。
4. 对于每个函数参数，可自由切换：
   - **原始值**：根据参数类型输入字符串、数值或布尔值。
   - **Hex Vector**：以字节数组形式输入，适用于 `vector<u8>` 或字符串。
   - **BCS Hex**：直接贴入 BCS 序列化之后的十六进制数据，由工具自动反解析。
5. 提供发送者私钥（Hex 格式），点击“提交交易”即可完成签名与发送，并返回交易哈希与 Explorer 链接。

> ⚠️ 请务必在安全环境下使用真实私钥，并注意不要在不可信终端上粘贴机密信息。

### BCS 编码 / 解码

- 支持 `bool`, `u8`, `u16`, `u32`, `u64`, `u128`, `u256`, `address`, `string`, `vector<u8>`。
- 编码模式：输入原始值，输出 BCS Hex 与字节长度。
- 解码模式：输入 BCS Hex，输出反序列化的可读结果，并在适当场景下附带辅助信息（例如字符串对应的原始字节、`vector<u8>` 的文本尝试等）。

## 目录结构

- `src/pages/AptosTool.tsx`：Aptos 交易构建与提交主界面。
- `src/pages/BcsTool.tsx`：BCS 工具页面。
- `src/lib/aptos.ts`：Aptos 网络访问和交易提交封装。
- `src/lib/abi.ts`：ABI 解析与类型简化工具。
- `src/lib/bcs.ts`：BCS 编/解码基础实现。
- `src/lib/networks.ts`：网络配置与工具函数。

## 后续扩展建议

- 将账户管理抽象为浏览器内的多密钥托管，支持 Aptos 钱包适配器。
- 为复杂结构体/向量类型提供更智能的表单生成与模板。
- 接入更多公链（如 Sui、EVM）并复用统一的表单渲染体系。

欢迎根据业务需求继续扩展！
