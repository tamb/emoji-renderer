import type { Preview } from "@storybook/html-vite";

const preview: Preview = {
  parameters: {
    layout: "centered",
    controls: {
      matchers: {
        color: /(background|color)$/i,
      },
    },
    docs: {
      description: {
        component: `
Convert emoji to Twemoji SVG markup or raster images with lazy-loaded CDN assets.

\`\`\`ts
import { emojiToSvg, emojiToImage } from "emoji-renderer";

const svg = await emojiToSvg("😀", { size: 48 });
const image = await emojiToImage("🎉", { size: 48 });
\`\`\`
        `.trim(),
      },
    },
  },
};

export default preview;
