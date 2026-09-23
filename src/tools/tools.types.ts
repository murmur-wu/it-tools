import type { Component } from 'vue';

export interface Tool {
  name: string
  path: string
  description: string
  keywords: string[]
  component: () => Promise<Component>
  icon: Component
  redirectFrom?: string[]
  isNew: boolean
  createdAt?: Date
}

/** A category as declared in the tool registry, before translation. */
export interface ToolCategoryDefinition {
  name: string
  components: Tool[]
}

/** A category as displayed: `name` is translated, `key` is the stable registry name. */
export interface ToolCategory {
  name: string
  key: string
  components: ToolWithCategory[]
}

export type ToolWithCategory = Tool & { category: string; categoryKey: string };
