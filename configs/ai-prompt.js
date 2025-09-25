const viralPrompts = [{
  name: "Realistic Figurine",
  text: "Using the nano-banana model, a commercial 1/7 scale figurine of the character was created, depicting a realistic style and a realistic environment. The figurine is placed on a computer desk with a round transparent acrylic base. There is no text on the base. The computer screen shows the Zbrush modeling process of the figurine. Next to the computer screen is a BANDAI-style toy box with the original painting printed on it."
}, {
  name: "Epic Cinematic",
  text: "Epic cinematic still from a blockbuster film. A lone hero stands on a cliff overlooking a futuristic city at dusk. Shot on Panavision anamorphic lenses, creating beautiful lens flares and a wide aspect ratio. Moody, dramatic lighting with deep shadows and vibrant neon highlights reflecting on wet pavement. Ultra-realistic, hyperdetailed, 8K, color graded with teal and orange tones."
}, {
  name: "Authentic 80s Photo",
  text: "An authentic photograph from the 1980s. A group of friends laughing in a vintage arcade. The image has a soft focus, noticeable film grain, and light leaks in the corners. Colors are slightly faded with a warm, nostalgic yellow tint, reminiscent of a disposable camera photo. Shot on Kodak Portra 400 film."
}, {
  name: "Gritty Cyberpunk",
  text: "A gritty, rain-slicked alley in a cyberpunk metropolis, inspired by Blade Runner. A mysterious figure in a high-tech trench coat is illuminated by holographic advertisements and the glow of neon signs. Volumetric lighting cuts through the dense fog. Intricate details on cybernetic enhancements and weathered surfaces. Rendered in Unreal Engine 5, hyper-realistic, ray tracing reflections."
}, {
  name: "Studio Ghibli Style",
  text: "A serene and beautiful landscape in the signature style of Studio Ghibli. Lush, rolling green hills, a crystal-clear stream, and whimsical, cloud-filled skies. Soft, painterly textures and a warm, inviting color palette. Hand-drawn aesthetic with clean lines and incredible attention to natural detail."
}, {
  name: "90s Retro Anime",
  text: "A dynamic action scene in the style of a 90s mecha anime like Evangelion or Akira. Cel-shaded characters with sharp, angular designs and expressive faces. Gritty, detailed backgrounds with a slightly muted color palette. Visible film grain and a 4:3 aspect ratio to complete the retro aesthetic."
}, {
  name: "Baroque Oil Painting",
  text: "An oil painting of a royal feast in the opulent Baroque style of Caravaggio. Dramatic chiaroscuro lighting creates intense contrast between light and shadow. Rich, deep colors, lavish details on fabrics and food, and dynamic, emotional figures. Hyper-realistic, painterly, masterpiece."
}, {
  name: "Extreme Macro Photo",
  text: "Extreme macro photograph of a dewdrop on a spiderweb. Intricate details of the web's silk threads are visible, with the background beautifully blurred with bokeh. The dewdrop refracts a miniature version of a sunrise. Hyper-realistic, tack-sharp focus, shot with a 100mm macro lens."
}, {
  name: "Claymation Diorama",
  text: "A charming diorama of a whimsical animal bakery, created in the style of Aardman Animations (Wallace and Gromit). Every character and object is meticulously crafted from clay, showing visible fingerprints and textures. Warm, gentle lighting from miniature lamps. Stop-motion animation aesthetic, cozy and detailed."
}, {
  name: "Artistic Double Exposure",
  text: "A stunning double exposure portrait. The silhouette of a wolf's head is seamlessly blended with a dense, misty pine forest at night, with a full moon shining through the trees. A creative and artistic blend of nature and wildlife, monochromatic with high contrast."
}, {
  name: "Isometric RPG Room",
  text: "An isometric, low-poly 3D render of a cozy fantasy tavern room. A crackling fireplace, a wooden table with potion bottles and a map, and a treasure chest in the corner. Pixel art textures, vibrant colors, and a clean, stylized look reminiscent of a classic RPG video game like Diablo or Baldur's Gate."
}, {
  name: "Technical Blueprint",
  text: "A detailed technical blueprint schematic of a complex steampunk clockwork dragon. White lines and annotations on a deep blue background. Shows internal gears, steam pipes, and mechanical joints with precise measurements and callouts. Clean, technical, and highly detailed."
}, {
  name: "Fantasy Storybook Illustration",
  text: "A whimsical fantasy storybook illustration. A glowing, enchanted forest where oversized, bioluminescent mushrooms light up a path for a small, brave adventurer. Soft, textured brush strokes, a rich and magical color palette. In the style of classic fairy tale art, highly detailed and charming."
}, {
  name: "Vintage Comic Book Art",
  text: "A panel from a 1960s vintage comic book. A superhero with a determined expression, rendered in the classic style with Ben-Day dots for shading. Bold black outlines, limited but vibrant color palette (reds, yellows, blues). The caption box contains dramatic, exclamatory text. Papery texture."
}];
const randomIndex = Math.floor(Math.random() * viralPrompts.length);
const randomPromptObject = viralPrompts[randomIndex];
export default randomPromptObject;