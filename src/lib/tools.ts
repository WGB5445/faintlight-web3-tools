export type ToolLink = {
  slug: string;
  labelKey: string;
  descriptionKey: string;
};

export type ToolGroup = {
  id: string;
  titleKey: string;
  hintKey?: string;
  items: ToolLink[];
};

export const TOOL_GROUPS: ToolGroup[] = [
  {
    id: 'overview',
    titleKey: 'navigation.groups.overview.title',
    hintKey: 'navigation.groups.overview.hint',
    items: [
      {
        slug: '',
        labelKey: 'navigation.tools.overview.label',
        descriptionKey: 'navigation.tools.overview.description'
      }
    ]
  },
  {
    id: 'aptos',
    titleKey: 'navigation.groups.aptos.title',
    hintKey: 'navigation.groups.aptos.hint',
    items: [
      {
        slug: 'aptos/contract-interaction',
        labelKey: 'navigation.tools.aptosInteraction.label',
        descriptionKey: 'navigation.tools.aptosInteraction.description'
      },
      {
        slug: 'aptos/bcs-tools',
        labelKey: 'navigation.tools.aptosBcs.label',
        descriptionKey: 'navigation.tools.aptosBcs.description'
      }
    ]
  }
];

export function findToolBySlug(slug: string) {
  for (const group of TOOL_GROUPS) {
    const item = group.items.find((entry) => entry.slug === slug);
    if (item) {
      return { group, item };
    }
  }
  return null;
}
