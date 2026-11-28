export const SUPPORT_EMAIL = "MODERNNOVAAI@gmail.com";

export type Faq = { slug: string; q: string; short: string; steps: string[]; note?: string };

export const FAQS: Faq[] = [
  {
    slug: "how-credits-work",
    q: "How do credits work?",
    short: "Every generation uses credits. Failed generations are refunded automatically.",
    steps: [
      "Each tool uses credits: Script Studio 20 credits for 1 minute (+15 per extra minute), Voice Studio 1,000 credits per minute (voice previews are free), Image 1,500 credits, Thumbnail 2,000 credits, Video 1,000 credits per second.",
      "The cost is shown on the Generate button before you start.",
      "Credits are taken when the generation starts.",
      "If the generation fails, the same credits are returned to your account automatically.",
      "Open ⋮ menu → My Credits to see your balance and every credit in or out.",
    ],
  },
  {
    slug: "why-generation-stopped",
    q: "Why did my generation stop?",
    short: "Usually low credits or a voice from a higher plan.",
    steps: [
      "Read the message on screen — it tells you the exact reason.",
      "\"Not enough credits\": add credits or upgrade your plan from ⋮ → Upgrade Plan.",
      "\"Voice locked\": the voice belongs to a higher plan. Pick another voice or upgrade.",
      "\"Service temporarily unavailable\": your credits were not charged. Try again after a few minutes.",
      "If it keeps happening, send us a message from the Contact support form.",
    ],
  },
  {
    slug: "change-language",
    q: "How do I change the language?",
    short: "Choose English, English + Hindi or हिंदी in Settings.",
    steps: [
      "Log in to your account.",
      "Tap the ⋮ (three-dot) button at the top right.",
      "Tap Settings.",
      "Find the Language section.",
      "Choose English, English + Hindi or हिंदी. The website changes right away.",
    ],
  },
  {
    slug: "where-are-my-files",
    q: "Where are my files?",
    short: "All your stories, voices, images and thumbnails are in Generation History.",
    steps: [
      "Tap the ⋮ (three-dot) button at the top right.",
      "Tap Generation History.",
      "Open any story, voice over, image or thumbnail you made.",
      "Use the Download button to save it to your phone or computer.",
    ],
  },
  {
    slug: "upgrade-plan",
    q: "How do I buy or upgrade a plan?",
    short: "Pay with UPI and your plan starts after verification.",
    steps: [
      "Open Pricing and choose Pro or Premium.",
      "Log in if asked.",
      "Add a promo code if you have one and tap Apply.",
      "Tap the pay button and pay the shown amount in your UPI app.",
      "Enter the 12-digit UTR number from your UPI app and submit.",
      "Your plan and credits start once the payment is verified.",
    ],
  },
  {
    slug: "forgot-password",
    q: "I forgot my password. What should I do?",
    short: "Reset it from the login page.",
    steps: [
      "Open the Login page.",
      "Tap \"Forgot password\".",
      "Enter your email and send the reset link.",
      "Open the email and set a new password.",
      "If you signed up with Google, just use \"Continue with Google\".",
    ],
  },
];
