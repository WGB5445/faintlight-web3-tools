export type ToolLink = {
  path: string;
  label: string;
  description: string;
};

export type ToolGroup = {
  id: string;
  label: string;
  hint?: string;
  items: ToolLink[];
};

export const TOOL_GROUPS: ToolGroup[] = [
  {
    id: 'overview',
    label: '控制台',
    hint: '整体介绍与使用说明',
    items: [
      {
        path: '/',
        label: '工作台概览',
        description: '总览当前所有可用工具与未来扩展方向。'
      }
    ]
  },
  {
    id: 'aptos',
    label: 'Aptos',
    hint: 'Aptos 链相关调试工具',
    items: [
      {
        path: '/aptos',
        label: '合约交互',
        description: '动态 ABI 表单与交易提交。'
      }
    ]
  },
  {
    id: 'general',
    label: '通用工具',
    hint: '跨链通用的实用工具',
    items: [
      {
        path: '/bcs',
        label: 'BCS 编/解码',
        description: '快速处理常见原语和字节数组。'
      }
    ]
  }
];

export function findToolByPath(pathname: string) {
  for (const group of TOOL_GROUPS) {
    const item = group.items.find((entry) => pathname === entry.path);
    if (item) {
      return { group, item };
    }
  }
  return null;
}
