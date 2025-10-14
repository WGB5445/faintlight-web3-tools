export default function HomePage() {
  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight">Web3 多工具工作台</h1>
        <p className="text-slate-300">
          选择左侧的工具来构建、检查并提交 Aptos 交易，或者使用 BCS 工具快速进行参数编码/解码。
        </p>
      </section>
      <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-6 shadow-inner">
        <h2 className="text-xl font-medium text-slate-100">当前支持</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-slate-300">
          <li>针对 Aptos 链的网络配置、模块 ABI 自动检索以及函数调用构建。</li>
          <li>根据 ABI 参数类型生成多种输入模式：原始字符串、Hex Vector、自定义 BCS 序列化。</li>
          <li>BCS 工具页面支持常见原语和结构的编码、解码与格式互换。</li>
        </ul>
      </section>
    </div>
  );
}
