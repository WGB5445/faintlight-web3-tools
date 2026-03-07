import { useCallback, useMemo, useState } from "react";
import { useLanguage } from "../context/LanguageContext";
import { useAptosSettings } from "../context/AptosSettingsContext";
import { getModule, resolveNetworkConfig } from "../lib/aptos";
import { APTOS_NETWORKS } from "../lib/networks";
import { AccountAddress } from "@aptos-labs/ts-sdk";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";

type TabType = "details" | "moveCode" | "tsExample";
type StructTabType = "details" | "moveCode";

export default function AptosAbiViewerPage() {
  const { t } = useLanguage();
  const {
    networkId,
    setNetworkId,
    customEndpoint,
    setCustomEndpoint,
    restEndpoint,
  } = useAptosSettings();
  const [moduleId, setModuleId] = useState("");
  const [moduleLoading, setModuleLoading] = useState(false);
  const [moduleError, setModuleError] = useState<string | null>(null);
  const [moduleBytecode, setModuleBytecode] = useState<any>(null);
  const [expandedSections, setExpandedSections] = useState({
    entryFunctions: false,
    viewFunctions: false,
    structs: false,
    bytecode: false,
  });
  const [activeTabs, setActiveTabs] = useState<Record<string, TabType>>({});
  const [activeStructTabs, setActiveStructTabs] = useState<
    Record<string, StructTabType>
  >({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const loadModule = useCallback(async () => {
    if (!restEndpoint) {
      setModuleError(t("aptos.module.errors.missingEndpoint"));
      return;
    }
    if (!moduleId.includes("::")) {
      setModuleError(t("aptos.module.errors.invalidFormat"));
      return;
    }
    setModuleLoading(true);
    setModuleError(null);

    const accountAddress = AccountAddress.fromString(moduleId.split("::")[0]);
    const moduleName = moduleId.split("::")[1];

    try {
      const moduleBytecode = await getModule({
        aptosConfig: resolveNetworkConfig(networkId, restEndpoint),
        accountAddress: accountAddress,
        moduleName: moduleName,
      });
      setModuleBytecode(moduleBytecode);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setModuleError(t("aptos.messages.abiLoadError", { message }));
      setModuleBytecode(null);
    } finally {
      setModuleLoading(false);
    }
  }, [moduleId, restEndpoint, networkId, t]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !moduleLoading) {
      loadModule();
    }
  };

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const toggleAllSections = () => {
    const allExpanded = Object.values(expandedSections).every(Boolean);
    setExpandedSections({
      entryFunctions: !allExpanded,
      viewFunctions: !allExpanded,
      structs: !allExpanded,
      bytecode: !allExpanded,
    });
  };

  const setActiveTab = (fnId: string, tab: TabType) => {
    setActiveTabs((prev) => ({ ...prev, [fnId]: tab }));
  };

  const setActiveStructTab = (structId: string, tab: StructTabType) => {
    setActiveStructTabs((prev) => ({ ...prev, [structId]: tab }));
  };

  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  // Try Move first, fallback to Rust if not supported
  // Note: Prism may not support Move, so we use Rust as fallback
  const getMoveLanguage = useMemo(() => {
    // Prism doesn't natively support Move, so we use Rust which has similar syntax
    // If Move support is added to Prism in the future, change this to 'move'
    return "rust";
  }, []);

  const moduleAbi = useMemo(() => {
    if (!moduleBytecode) return null;
    return moduleBytecode.abi;
  }, [moduleBytecode]);

  const entryFunctions = useMemo(() => {
    if (!moduleAbi) return [];
    return moduleAbi.exposed_functions.filter((fn: any) => fn.is_entry);
  }, [moduleAbi]);

  const viewFunctions = useMemo(() => {
    if (!moduleAbi) return [];
    return moduleAbi.exposed_functions.filter((fn: any) => fn.is_view);
  }, [moduleAbi]);

  const structs = useMemo(() => {
    if (!moduleAbi) return [];
    return moduleAbi.structs || [];
  }, [moduleAbi]);

  const generateMoveCode = (fn: any, moduleAbi: any) => {
    const isEntry = fn.is_entry;
    const visibility = isEntry ? "entry" : "public";

    let code = `${visibility} fun ${fn.name}`;

    // Generic type parameters
    if (fn.generic_type_params && fn.generic_type_params.length > 0) {
      const generics = fn.generic_type_params.map((_: any, i: number) => {
        const constraints = fn.generic_type_params[i].constraints;
        if (constraints && constraints.length > 0) {
          return `T${i}: ${constraints.join(" + ")}`;
        }
        return `T${i}`;
      });
      code += `<${generics.join(", ")}>`;
    }

    // Parameters
    code += "(";
    if (fn.params && fn.params.length > 0) {
      const params = fn.params.map((param: string, index: number) => {
        // Remove &signer, &mut from display for cleaner code
        const cleanParam = param.replace(/^&(mut\s+)?/, "");
        return `arg${index}: ${cleanParam}`;
      });
      code += params.join(", ");
    }
    code += ")";

    // Return types
    if (fn.return && fn.return.length > 0) {
      code += `: ${fn.return.join(", ")}`;
    }

    code += " {";
    code += "\n    // TODO: Implement function body";
    code += "\n}";

    return code;
  };

  const generateTsExample = (
    fn: any,
    moduleAbi: any,
    type: "entry" | "view",
  ) => {
    const moduleAddress = moduleAbi.address;
    const moduleName = moduleAbi.name;
    const functionName = fn.name;

    if (type === "entry") {
      // Generate entry function example
      let code = `import { Aptos, AptosConfig, Network, Account, Ed25519PrivateKey } from '@aptos-labs/ts-sdk';\n\n`;
      code += `// Initialize Aptos client\n`;
      code += `const config = new AptosConfig({ network: Network.TESTNET });\n`;
      code += `const aptos = new Aptos(config);\n\n`;
      code += `// Load your account\n`;
      code += `const privateKey = new Ed25519PrivateKey('YOUR_PRIVATE_KEY_HEX');\n`;
      code += `const account = Account.fromPrivateKey({ privateKey });\n\n`;
      code += `// Prepare transaction data\n`;
      code += `const data = {\n`;
      code += `  function: '${moduleAddress}::${moduleName}::${functionName}'`;

      // Type arguments
      if (fn.generic_type_params && fn.generic_type_params.length > 0) {
        code += `,\n  typeArguments: [`;
        const typeArgs = fn.generic_type_params.map((_: any, i: number) => {
          return `\n    '0x1::aptos_coin::AptosCoin' // Replace with actual type for T${i}`;
        });
        code += typeArgs.join(",");
        code += `\n  ]`;
      }

      // Function arguments (filter out signer and &signer)
      // Always include functionArguments, even if empty
      const nonSignerParams = (fn.params || []).filter((param: string) => {
        const cleanParam = param.replace(/^&(mut\s+)?/, "").trim();
        return cleanParam !== "signer";
      });

      code += `,\n  functionArguments: [`;
      if (nonSignerParams.length > 0) {
        const args = nonSignerParams.map((param: string) => {
          const cleanParam = param.replace(/^&(mut\s+)?/, "");
          if (cleanParam === "address") {
            return `\n    '0x1' // address`;
          } else if (cleanParam.startsWith("u")) {
            return `\n    1000000 // ${cleanParam}`;
          } else if (cleanParam === "bool") {
            return `\n    true // bool`;
          } else if (cleanParam === "vector<u8>") {
            return `\n    '0x00' // vector<u8>`;
          } else if (cleanParam.includes("String") || cleanParam === "string") {
            return `\n    'hello' // string`;
          }
          return `\n    'YOUR_VALUE' // ${cleanParam}`;
        });
        code += args.join(",");
      }
      code += `\n  ]`;

      code += `\n};\n\n`;
      code += `// Build and submit transaction\n`;
      code += `const transaction = await aptos.transaction.build.simple({\n`;
      code += `  sender: account.accountAddress.toString(),\n`;
      code += `  data\n`;
      code += `});\n\n`;
      code += `const pendingTransaction = await aptos.signAndSubmitTransaction({ \n`;
      code += `  signer: account, \n`;
      code += `  transaction \n`;
      code += `});\n\n`;
      code += `const executed = await aptos.waitForTransaction({ \n`;
      code += `  transactionHash: pendingTransaction.hash \n`;
      code += `});\n\n`;
      code += `console.log('Transaction hash:', executed.hash);`;

      return code;
    } else {
      // Generate view function example
      let code = `import { Aptos, AptosConfig, Network } from '@aptos-labs/ts-sdk';\n\n`;
      code += `// Initialize Aptos client\n`;
      code += `const config = new AptosConfig({ network: Network.TESTNET });\n`;
      code += `const aptos = new Aptos(config);\n\n`;
      code += `// Call view function\n`;
      code += `const result = await aptos.view({\n`;
      code += `  payload: {\n`;
      code += `    function: '${moduleAddress}::${moduleName}::${functionName}'`;

      // Type arguments - always include, even if empty
      code += `,\n    typeArguments: [`;
      if (fn.generic_type_params && fn.generic_type_params.length > 0) {
        const typeArgs = fn.generic_type_params.map((_: any, i: number) => {
          return `\n      '0x1::aptos_coin::AptosCoin' // Replace with actual type for T${i}`;
        });
        code += typeArgs.join(",");
      }
      code += `\n    ]`;

      // Function arguments (filter out signer and &signer)
      // Always include functionArguments, even if empty
      const nonSignerParams = (fn.params || []).filter((param: string) => {
        const cleanParam = param.replace(/^&(mut\s+)?/, "").trim();
        return cleanParam !== "signer";
      });

      code += `,\n    functionArguments: [`;
      if (nonSignerParams.length > 0) {
        const args = nonSignerParams.map((param: string) => {
          const cleanParam = param.replace(/^&(mut\s+)?/, "");
          if (cleanParam === "address") {
            return `\n      '0x1' // address`;
          } else if (cleanParam.startsWith("u")) {
            return `\n      1000000 // ${cleanParam}`;
          } else if (cleanParam === "bool") {
            return `\n      true // bool`;
          } else if (cleanParam === "vector<u8>") {
            return `\n      '0x00' // vector<u8>`;
          } else if (cleanParam.includes("String") || cleanParam === "string") {
            return `\n      'hello' // string`;
          }
          return `\n      'YOUR_VALUE' // ${cleanParam}`;
        });
        code += args.join(",");
      }
      code += `\n    ]`;
      code += `\n  }\n`;
      code += `});\n\n`;
      code += `console.log('Result:', result);`;

      return code;
    }
  };

  const generateStructMoveCode = (struct: any) => {
    let code = "struct ";

    // Struct name
    code += struct.name;

    // Generic type parameters
    if (struct.generic_type_params && struct.generic_type_params.length > 0) {
      const generics = struct.generic_type_params.map((_: any, i: number) => {
        const constraints = struct.generic_type_params[i].constraints;
        if (constraints && constraints.length > 0) {
          return `T${i}: ${constraints.join(" + ")}`;
        }
        return `T${i}`;
      });
      code += `<${generics.join(", ")}>`;
    }

    // Abilities
    if (struct.abilities && struct.abilities.length > 0) {
      code += ` has ${struct.abilities.join(", ")}`;
    }

    code += " {";

    // Fields
    if (struct.fields && struct.fields.length > 0) {
      code += "\n";
      struct.fields.forEach((field: any) => {
        code += `    ${field.name}: ${field.type},\n`;
      });
      // Remove trailing comma and newline
      code = code.slice(0, -2) + "\n";
    }

    code += "}";

    return code;
  };

  const AccordionSection = ({
    title,
    count,
    countLabel,
    color,
    sectionKey,
    children,
  }: {
    title: string;
    count: number;
    countLabel: string;
    color: string;
    sectionKey: keyof typeof expandedSections;
    children: React.ReactNode;
  }) => {
    const isExpanded = expandedSections[sectionKey];

    return (
      <div className="space-y-4">
        <button
          onClick={() => toggleSection(sectionKey)}
          className="flex items-center justify-between w-full p-4 rounded-lg border border-slate-700 bg-slate-900/60 hover:bg-slate-900/80 transition-colors"
        >
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-semibold text-slate-100">{title}</h2>
            <span
              className={`px-2 py-1 rounded-full text-xs font-medium ${color}`}
            >
              {count} {countLabel}
            </span>
          </div>
          <span className="text-slate-400 text-lg">
            {isExpanded ? "▼" : "▶"}
          </span>
        </button>

        {isExpanded && <div className="space-y-4">{children}</div>}
      </div>
    );
  };

  const renderFunction = (fn: any, type: "entry" | "view") => {
    const fnId = `${type}-${fn.name}`;
    const activeTab = activeTabs[fnId] || "details";
    const moveCode = moduleAbi ? generateMoveCode(fn, moduleAbi) : "";
    const tsExample = moduleAbi ? generateTsExample(fn, moduleAbi, type) : "";
    const copyId = `${fnId}-${activeTab}`;

    return (
      <div
        key={fnId}
        className="rounded-lg border border-slate-700 bg-slate-900/60 overflow-hidden"
      >
        {/* Header */}
        <div className="p-4 border-b border-slate-700">
          <div className="flex items-center gap-2 mb-3">
            <span
              className={`px-2 py-1 rounded text-xs font-medium ${
                type === "entry"
                  ? "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                  : "bg-green-500/20 text-green-300 border border-green-500/30"
              }`}
            >
              {type === "entry" ? "Entry" : "View"}
            </span>
            <h3 className="text-lg font-semibold text-slate-100 font-mono">
              {fn.name}
            </h3>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 border-b border-slate-700 -mb-4">
            <button
              onClick={() => setActiveTab(fnId, "details")}
              className={`px-3 py-2 text-sm font-medium transition-colors ${
                activeTab === "details"
                  ? "text-sky-400 border-b-2 border-sky-400"
                  : "text-slate-400 hover:text-slate-300"
              }`}
            >
              {t("aptosAbi.functionTabs.details")}
            </button>
            <button
              onClick={() => setActiveTab(fnId, "moveCode")}
              className={`px-3 py-2 text-sm font-medium transition-colors ${
                activeTab === "moveCode"
                  ? "text-sky-400 border-b-2 border-sky-400"
                  : "text-slate-400 hover:text-slate-300"
              }`}
            >
              {t("aptosAbi.functionTabs.moveCode")}
            </button>
            <button
              onClick={() => setActiveTab(fnId, "tsExample")}
              className={`px-3 py-2 text-sm font-medium transition-colors ${
                activeTab === "tsExample"
                  ? "text-sky-400 border-b-2 border-sky-400"
                  : "text-slate-400 hover:text-slate-300"
              }`}
            >
              {t("aptosAbi.functionTabs.tsExample")}
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-4">
          {activeTab === "details" && (
            <div className="space-y-4">
              {fn.generic_type_params && fn.generic_type_params.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-slate-300 mb-2">
                    Generic Type Parameters
                  </h4>
                  <div className="space-y-1">
                    {fn.generic_type_params.map((param: any, index: number) => (
                      <div
                        key={index}
                        className="text-sm text-slate-400 font-mono bg-slate-800/50 px-3 py-2 rounded"
                      >
                        <span className="text-slate-300">T{index}</span>
                        {param.constraints && param.constraints.length > 0 ? (
                          <span className="text-slate-500">
                            : {param.constraints.join(", ")}
                          </span>
                        ) : (
                          <span className="text-slate-500">
                            : No constraints
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <h4 className="text-sm font-medium text-slate-300 mb-2">
                  Parameters
                </h4>
                {fn.params && fn.params.length > 0 ? (
                  <div className="space-y-1">
                    {fn.params.map((param: string, index: number) => (
                      <div
                        key={index}
                        className="text-sm text-slate-400 font-mono bg-slate-800/50 px-3 py-2 rounded"
                      >
                        <span className="text-slate-300">arg{index}</span>
                        <span className="text-slate-500">: {param}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-slate-500">No parameters</div>
                )}
              </div>

              {fn.return && fn.return.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-slate-300 mb-2">
                    Return Types
                  </h4>
                  <div className="space-y-1">
                    {fn.return.map((ret: string, index: number) => (
                      <div
                        key={index}
                        className="text-sm text-slate-400 font-mono bg-slate-800/50 px-3 py-2 rounded"
                      >
                        {ret}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === "moveCode" && (
            <div className="relative">
              <button
                onClick={() => copyToClipboard(moveCode, copyId)}
                className="absolute top-2 right-2 px-3 py-1 text-xs font-medium bg-slate-700 hover:bg-slate-600 text-slate-300 rounded transition-colors z-10"
              >
                {copiedId === copyId
                  ? t("aptosAbi.code.copied")
                  : t("aptosAbi.code.copy")}
              </button>
              <div className="rounded-lg overflow-hidden">
                <SyntaxHighlighter
                  language={getMoveLanguage}
                  style={vscDarkPlus}
                  customStyle={{
                    margin: 0,
                    borderRadius: "0.5rem",
                    fontSize: "0.875rem",
                    lineHeight: "1.5",
                  }}
                  showLineNumbers={false}
                  PreTag="div"
                >
                  {moveCode}
                </SyntaxHighlighter>
              </div>
            </div>
          )}

          {activeTab === "tsExample" && (
            <div className="relative">
              <button
                onClick={() => copyToClipboard(tsExample, copyId)}
                className="absolute top-2 right-2 px-3 py-1 text-xs font-medium bg-slate-700 hover:bg-slate-600 text-slate-300 rounded transition-colors z-10"
              >
                {copiedId === copyId
                  ? t("aptosAbi.code.copied")
                  : t("aptosAbi.code.copy")}
              </button>
              <div className="rounded-lg overflow-hidden">
                <SyntaxHighlighter
                  language="typescript"
                  style={vscDarkPlus}
                  customStyle={{
                    margin: 0,
                    borderRadius: "0.5rem",
                    fontSize: "0.875rem",
                    lineHeight: "1.5",
                  }}
                  showLineNumbers={false}
                >
                  {tsExample}
                </SyntaxHighlighter>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderStruct = (struct: any) => {
    const structId = `struct-${struct.name}`;
    const activeTab = activeStructTabs[structId] || "details";
    const moveCode = generateStructMoveCode(struct);
    const copyId = `${structId}-${activeTab}`;

    return (
      <div
        key={structId}
        className="rounded-lg border border-slate-700 bg-slate-900/60 overflow-hidden"
      >
        {/* Header */}
        <div className="p-4 border-b border-slate-700">
          <div className="flex items-center gap-2 mb-3">
            <span className="px-2 py-1 rounded text-xs font-medium bg-purple-500/20 text-purple-300 border border-purple-500/30">
              Struct
            </span>
            <h3 className="text-lg font-semibold text-slate-100 font-mono">
              {struct.name}
            </h3>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 border-b border-slate-700 -mb-4">
            <button
              onClick={() => setActiveStructTab(structId, "details")}
              className={`px-3 py-2 text-sm font-medium transition-colors ${
                activeTab === "details"
                  ? "text-sky-400 border-b-2 border-sky-400"
                  : "text-slate-400 hover:text-slate-300"
              }`}
            >
              {t("aptosAbi.functionTabs.details")}
            </button>
            <button
              onClick={() => setActiveStructTab(structId, "moveCode")}
              className={`px-3 py-2 text-sm font-medium transition-colors ${
                activeTab === "moveCode"
                  ? "text-sky-400 border-b-2 border-sky-400"
                  : "text-slate-400 hover:text-slate-300"
              }`}
            >
              {t("aptosAbi.functionTabs.moveCode")}
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-4">
          {activeTab === "details" && (
            <div className="space-y-4">
              {struct.generic_type_params &&
                struct.generic_type_params.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-slate-300 mb-2">
                      Generic Type Parameters
                    </h4>
                    <div className="space-y-1">
                      {struct.generic_type_params.map(
                        (param: any, index: number) => (
                          <div
                            key={index}
                            className="text-sm text-slate-400 font-mono bg-slate-800/50 px-3 py-2 rounded"
                          >
                            <span className="text-slate-300">T{index}</span>
                            {param.constraints &&
                            param.constraints.length > 0 ? (
                              <span className="text-slate-500">
                                : {param.constraints.join(", ")}
                              </span>
                            ) : (
                              <span className="text-slate-500">
                                : No constraints
                              </span>
                            )}
                          </div>
                        ),
                      )}
                    </div>
                  </div>
                )}

              {struct.fields && struct.fields.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-slate-300 mb-2">
                    Fields
                  </h4>
                  <div className="space-y-1">
                    {struct.fields.map((field: any, index: number) => (
                      <div
                        key={index}
                        className="text-sm text-slate-400 font-mono bg-slate-800/50 px-3 py-2 rounded"
                      >
                        <span className="text-slate-300">{field.name}</span>
                        <span className="text-slate-500">: {field.type}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {struct.abilities && struct.abilities.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-slate-300 mb-2">
                    Abilities
                  </h4>
                  <div className="flex flex-wrap gap-1">
                    {struct.abilities.map((ability: string, index: number) => (
                      <span
                        key={index}
                        className="px-2 py-1 rounded text-xs bg-slate-700 text-slate-300"
                      >
                        {ability}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === "moveCode" && (
            <div className="relative">
              <button
                onClick={() => copyToClipboard(moveCode, copyId)}
                className="absolute top-2 right-2 px-3 py-1 text-xs font-medium bg-slate-700 hover:bg-slate-600 text-slate-300 rounded transition-colors z-10"
              >
                {copiedId === copyId
                  ? t("aptosAbi.code.copied")
                  : t("aptosAbi.code.copy")}
              </button>
              <div className="rounded-lg overflow-hidden">
                <SyntaxHighlighter
                  language={getMoveLanguage}
                  style={vscDarkPlus}
                  customStyle={{
                    margin: 0,
                    borderRadius: "0.5rem",
                    fontSize: "0.875rem",
                    lineHeight: "1.5",
                  }}
                  showLineNumbers={false}
                  PreTag="div"
                >
                  {moveCode}
                </SyntaxHighlighter>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">
          {t("aptosAbi.title")}
        </h1>
        <p className="text-slate-300">{t("aptosAbi.description")}</p>
      </header>

      <section className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="flex flex-col gap-2 text-sm font-medium text-slate-200">
            {t("aptos.network.label")}
            <select
              className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
              value={networkId}
              onChange={(event) => {
                const nextNetwork = event.target.value as
                  | "mainnet"
                  | "testnet"
                  | "devnet"
                  | "custom";
                setNetworkId(nextNetwork);
              }}
            >
              {APTOS_NETWORKS.map((network) => (
                <option key={network.id} value={network.id}>
                  {network.label}
                </option>
              ))}
              <option value="custom">{t("aptos.network.customOption")}</option>
            </select>
          </label>

          {networkId === "custom" ? (
            <label className="flex flex-col gap-2 text-sm font-medium text-slate-200">
              {t("aptos.network.customLabel")}
              <input
                className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
                placeholder={t("aptos.network.customPlaceholder")}
                value={customEndpoint}
                onChange={(event) => setCustomEndpoint(event.target.value)}
              />
            </label>
          ) : (
            <div className="flex flex-col gap-2 text-sm text-slate-400">
              <span className="font-medium text-slate-300">
                {t("aptos.network.restLabel")}
              </span>
              <span className="truncate rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-xs">
                {restEndpoint}
              </span>
            </div>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="flex flex-col gap-2 text-sm font-medium text-slate-200">
            {t("aptos.module.label")}
            <input
              className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
              placeholder={t("aptos.module.placeholder")}
              value={moduleId}
              onChange={(event) => setModuleId(event.target.value)}
              onKeyDown={handleKeyDown}
            />
          </label>
          <button
            type="button"
            onClick={loadModule}
            className="self-end rounded-lg bg-sky-500 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
            disabled={moduleLoading}
          >
            {moduleLoading
              ? t("aptos.module.loading")
              : t("aptosAbi.actions.loadAbi")}
          </button>
        </div>
        {moduleError ? (
          <p className="text-sm text-rose-400">{moduleError}</p>
        ) : null}
      </section>

      {moduleAbi && (
        <section className="space-y-8">
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6">
            <h2 className="text-xl font-semibold text-slate-100 mb-4">
              {t("aptosAbi.moduleInfo.title")}
            </h2>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <h3 className="text-sm font-medium text-slate-300 mb-2">
                  {t("aptosAbi.moduleInfo.address")}
                </h3>
                <p className="text-sm text-slate-400 font-mono">
                  {moduleAbi.address}
                </p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-slate-300 mb-2">
                  {t("aptosAbi.moduleInfo.name")}
                </h3>
                <p className="text-sm text-slate-400 font-mono">
                  {moduleAbi.name}
                </p>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-700">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-slate-300">
                  {t("aptosAbi.moduleInfo.overview")}
                </h3>
                <button
                  onClick={toggleAllSections}
                  className="px-3 py-1 rounded text-xs font-medium bg-slate-700 text-slate-300 hover:bg-slate-600 transition-colors"
                >
                  {Object.values(expandedSections).every(Boolean)
                    ? t("aptosAbi.actions.collapseAll")
                    : t("aptosAbi.actions.expandAll")}
                </button>
              </div>
              <div className="flex flex-wrap gap-3">
                <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 text-sm">
                  <span className="w-2 h-2 rounded-full bg-blue-400"></span>
                  {entryFunctions.length}{" "}
                  {t("aptosAbi.moduleInfo.entryFunctions")}
                </div>
                <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-green-500/20 text-green-300 text-sm">
                  <span className="w-2 h-2 rounded-full bg-green-400"></span>
                  {viewFunctions.length}{" "}
                  {t("aptosAbi.moduleInfo.viewFunctions")}
                </div>
                <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/20 text-purple-300 text-sm">
                  <span className="w-2 h-2 rounded-full bg-purple-400"></span>
                  {structs.length} {t("aptosAbi.moduleInfo.structs")}
                </div>
              </div>
            </div>
          </div>

          <AccordionSection
            title={t("aptosAbi.entryFunctions.title")}
            count={entryFunctions.length}
            countLabel={entryFunctions.length === 1 ? "function" : "functions"}
            color="bg-blue-500/20 text-blue-300"
            sectionKey="entryFunctions"
          >
            {entryFunctions.length > 0 ? (
              <div className="space-y-4">
                {entryFunctions.map((fn: any) => renderFunction(fn, "entry"))}
              </div>
            ) : (
              <div className="rounded-lg border border-slate-700 bg-slate-900/30 p-6 text-center">
                <p className="text-slate-400">
                  {t("aptosAbi.entryFunctions.empty")}
                </p>
              </div>
            )}
          </AccordionSection>

          <AccordionSection
            title={t("aptosAbi.viewFunctions.title")}
            count={viewFunctions.length}
            countLabel={viewFunctions.length === 1 ? "function" : "functions"}
            color="bg-green-500/20 text-green-300"
            sectionKey="viewFunctions"
          >
            {viewFunctions.length > 0 ? (
              <div className="space-y-4">
                {viewFunctions.map((fn: any) => renderFunction(fn, "view"))}
              </div>
            ) : (
              <div className="rounded-lg border border-slate-700 bg-slate-900/30 p-6 text-center">
                <p className="text-slate-400">
                  {t("aptosAbi.viewFunctions.empty")}
                </p>
              </div>
            )}
          </AccordionSection>

          <AccordionSection
            title={t("aptosAbi.structs.title")}
            count={structs.length}
            countLabel={structs.length === 1 ? "struct" : "structs"}
            color="bg-purple-500/20 text-purple-300"
            sectionKey="structs"
          >
            {structs.length > 0 ? (
              <div className="space-y-4">
                {structs.map((struct: any) => renderStruct(struct))}
              </div>
            ) : (
              <div className="rounded-lg border border-slate-700 bg-slate-900/30 p-6 text-center">
                <p className="text-slate-400">{t("aptosAbi.structs.empty")}</p>
              </div>
            )}
          </AccordionSection>

          {moduleBytecode.bytecode && (
            <AccordionSection
              title={t("aptosAbi.bytecode.title")}
              count={1}
              countLabel="bytecode"
              color="bg-orange-500/20 text-orange-300"
              sectionKey="bytecode"
            >
              <div className="rounded-lg border border-slate-700 bg-slate-950/70 p-4 relative">
                <button
                  onClick={() =>
                    copyToClipboard(moduleBytecode.bytecode, "bytecode")
                  }
                  className="absolute top-2 right-2 px-3 py-1 text-xs font-medium bg-slate-700 hover:bg-slate-600 text-slate-300 rounded transition-colors z-10"
                >
                  {copiedId === "bytecode"
                    ? t("aptosAbi.code.copied")
                    : t("aptosAbi.code.copy")}
                </button>
                <div className="mb-3">
                  <h3 className="text-sm font-medium text-slate-300 mb-2">
                    {t("aptosAbi.bytecode.hex")}
                  </h3>
                  <div className="text-xs text-slate-400 font-mono break-all pr-20">
                    {moduleBytecode.bytecode}
                  </div>
                </div>
              </div>
            </AccordionSection>
          )}
        </section>
      )}
    </div>
  );
}
