export type Cuisine = {
  name: string;
  icon: string;
};

/** Canonical cuisine tags, each with an icon, used across both sides. */
export const CUISINES: Cuisine[] = [
  { name: "Italian", icon: "🍝" },
  { name: "French", icon: "🥐" },
  { name: "Japanese", icon: "🍣" },
  { name: "Sushi", icon: "🍣" },
  { name: "Ramen", icon: "🍜" },
  { name: "Noodles", icon: "🥡" },
  { name: "Chinese", icon: "🥡" },
  { name: "Korean", icon: "🍲" },
  { name: "Vietnamese", icon: "🍜" },
  { name: "Thai", icon: "🍜" },
  { name: "Uyghur", icon: "🥟" },
  { name: "Indian", icon: "🍛" },
  { name: "Mexican", icon: "🌮" },
  { name: "Mediterranean", icon: "🫒" },
  { name: "Middle Eastern", icon: "🥙" },
  { name: "Turkish", icon: "🥙" },
  { name: "African", icon: "🍲" },
  { name: "Caribbean", icon: "🍗" },
  { name: "American", icon: "🍔" },
  { name: "Burger", icon: "🍔" },
  { name: "Pizza", icon: "🍕" },
  { name: "Seafood", icon: "🦐" },
  { name: "Bakery", icon: "🥐" },
  { name: "Dessert", icon: "🍰" },
  { name: "Cafe", icon: "☕" },
  { name: "Ice Cream", icon: "🍦" },
  { name: "Vegetarian", icon: "🥗" },
  { name: "Vegan", icon: "🌱" },
];

const ICONS = new Map(CUISINES.map((c) => [c.name, c.icon]));

export const CUISINE_NAMES: string[] = CUISINES.map((c) => c.name);

/** Icon for a cuisine tag, falling back to a generic plate. */
export const cuisineIcon = (name: string): string => ICONS.get(name) ?? "🍽️";
