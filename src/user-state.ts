export const messages = {
  welcome: {
    EN: "Hello! 👋😊 Welcome to DeepGov! 🌟 I'm your AI representative, here to help explore good governance solutions! Feel free to tell or ask me anything, anytime!",
    BT: "བཀྲ་ཤིས་བདེ་ལེགས! 👋😊 DeepGov ལུ་དངོས་སུ་བསུ་འབོར་ཞུ་ནི! 🌟 ང་ཁྱེད་རང་གི་ AI ཚབ་འགོ་ཡིན། ཆ་འཇོག་ལེགས་ཤོམ་གྱི་ཐབས་ལམ་འཚོལ་ནིར་གྲོགས་རམ་འབད་ནི་ཨིན!",
  },
  languageSelect:
    "🇬🇧 English: Please choose your preferred language.\n🇧🇹 Dzongkha: ཁྱེད་རང་གི་འདོད་པའི་སྐད་ཡིག་འདེམས་རོགས།",
  help: {
    EN: "Available commands:\n/start - Choose language and get started\n/help - Show this help message\n/auth - Authenticate with Bhutan NDI\n\nYou can also just chat with me about governance topics!",
    BT: "ལག་ལེན་འཐབ་ཚུགས་པའི་བཀོད་ཡིག་ཚུ:\n/start - སྐད་ཡིག་འདེམས་ནི་དང་འགོ་བཙུགས་ནི\n/help - གྲོགས་རམ་གྱི་འདི་སྟོན་ནི\n/auth - བྷུ་ཊན་ NDI གཅིག་ཁར་བདེན་སྦྱོར་འབད་ནི\n\nགཞུང་འཛིན་གྱི་དོན་ཚན་ཚུ་གི་སྐོར་ལས་ང་དང་སྐད་ཆ་བཤད་ཆོགས!",
  },
  rateLimited: {
    EN: "You've reached the limit of 100 requests per hour. Please try again later.",
    BT: "ཁྱེད་རང་གིས་ཆུ་ཚོད་གཅིག་ལུ་འདྲི་བ་ ༡༠༠ གི་མཐའ་མཚམས་ལྷོདཔ་ཨིན། ཅུང་ཙམ་ཤུལ་ལས་ལོག་འབད་རོགས།",
  },
};

export function splitMessage(text: string, maxLength: number = 4096): string[] {
  if (text.length <= maxLength) return [text];

  const chunks: string[] = [];
  let currentChunk = "";
  const sentences = text.split(/(?<=[.!?])\s+/);

  for (const sentence of sentences) {
    if (currentChunk.length + sentence.length + 1 <= maxLength) {
      currentChunk += (currentChunk ? " " : "") + sentence;
    } else {
      if (currentChunk) chunks.push(currentChunk);
      currentChunk = sentence;
    }
  }

  if (currentChunk) chunks.push(currentChunk);
  return chunks;
}
