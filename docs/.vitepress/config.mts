import { defineConfig } from 'vitepress';

export default defineConfig({
  title: 'avatrr',
  description: 'Real-time AI avatar chat with 3D expressions',

  base: '/avatrr/',

  themeConfig: {
    nav: [
      { text: 'Guide', link: '/guide/getting-started' },
      { text: 'API', link: '/guide/api' },
    ],

    sidebar: [
      {
        text: 'Guide',
        items: [
          { text: 'Getting Started', link: '/guide/getting-started' },
          { text: 'Configuration', link: '/guide/configuration' },
          { text: 'Docker', link: '/guide/docker' },
          { text: 'API Reference', link: '/guide/api' },
        ],
      },
    ],

    socialLinks: [
      { icon: 'github', link: 'https://github.com/KevinBonnoron/avatrr' },
    ],

    footer: {
      message: 'Released under the MIT License.',
    },
  },
});
