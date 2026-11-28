CREATE TABLE public.telegram_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id text NOT NULL UNIQUE CHECK (chat_id ~ '^-[1-9][0-9]{0,15}$'),
  title text,
  username text,
  chat_type text,
  photo_small_file_id text,
  photo_big_file_id text,
  bot_status text NOT NULL DEFAULT 'unknown',
  can_send boolean,
  member_count integer,
  owner_user_id text,
  promotions_enabled boolean NOT NULL DEFAULT true,
  greetings_enabled boolean NOT NULL DEFAULT true,
  source text NOT NULL DEFAULT 'auto',
  last_error text,
  last_checked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.telegram_groups TO service_role;
ALTER TABLE public.telegram_groups ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.telegram_broadcast_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  greetings_enabled boolean NOT NULL DEFAULT true,
  promotions_enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.telegram_broadcast_settings TO service_role;
ALTER TABLE public.telegram_broadcast_settings ENABLE ROW LEVEL SECURITY;
INSERT INTO public.telegram_broadcast_settings (id) VALUES (true);

CREATE TABLE public.telegram_broadcast_slots (
  id text PRIMARY KEY,
  kind text NOT NULL CHECK (kind IN ('greeting','promotion')),
  label text NOT NULL,
  send_time text NOT NULL CHECK (send_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  enabled boolean NOT NULL DEFAULT true,
  messages text[] NOT NULL DEFAULT '{}',
  sort integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.telegram_broadcast_slots TO service_role;
ALTER TABLE public.telegram_broadcast_slots ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.telegram_broadcast_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id text NOT NULL,
  slot_id text,
  kind text NOT NULL,
  local_date date,
  variant integer,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'sending',
  error text,
  message_id bigint,
  sent_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (chat_id, slot_id, local_date)
);
CREATE INDEX telegram_broadcast_log_chat_idx ON public.telegram_broadcast_log (chat_id, created_at DESC);
GRANT ALL ON public.telegram_broadcast_log TO service_role;
ALTER TABLE public.telegram_broadcast_log ENABLE ROW LEVEL SECURITY;

INSERT INTO public.telegram_broadcast_slots (id, kind, label, send_time, sort, messages) VALUES
('greet_morning','greeting','Good Morning','09:00',1, ARRAY[
'Good Morning Everyone! ☕😊

Aap sabhi ka din khushiyon, positive energy aur naye opportunities se bhara rahe. Have a wonderful day! 🌸',
'Suprabhat dosto! ☀️😊

Nayi subah, nayi umeed — aaj ka din aapke liye kuch khaas lekar aaye. Smile karte rahiye! 🌼',
'Good Morning Friends! 🌞

Chai ki pehli chuski aur ek positive soch ke saath din shuru kijiye. Aapka din shaandaar rahe! ☕✨']),
('greet_afternoon','greeting','Good Afternoon','14:00',2, ARRAY[
'Good Afternoon Everyone! 😊

Umeed hai aap sabhi ka din achha aur productive ja raha hoga. Khush rahiye aur muskurate rahiye! ✨',
'Good Afternoon Dosto! 🌤️

Thoda break lijiye, paani pijiye aur fresh mood ke saath din ka baaki hissa enjoy kijiye! 💧😊',
'Namaste aur Good Afternoon! ☀️

Aadha din nikal gaya — baaki aadha bhi khushiyon aur kamyabi se bhara rahe. Keep going! 💪✨']),
('greet_evening','greeting','Good Evening','18:00',3, ARRAY[
'Good Evening Everyone! 🌇

Aap sabhi ki shaam sukoon, khushiyon aur positive vibes se bhari rahe. Enjoy your evening! ❤️',
'Shubh Sandhya dosto! 🌆

Din bhar ki thakaan bhool kar apno ke saath kuch pyare pal bitaiye. Have a lovely evening! 🌸',
'Good Evening Friends! 🌅

Chai, baatein aur thoda aaram — shaam ko khaas banaiye. Muskurate rahiye! 😊✨']),
('greet_night','greeting','Good Night','22:00',4, ARRAY[
'Good Night Everyone! 🌙😴

Aaj ka din achha raha ho, ab aaram kijiye aur kal ek nayi energy ke saath miliye. Sweet Dreams! ❤️',
'Shubh Ratri dosto! 🌌

Sab chintayein chhod kar sukoon ki neend lijiye. Kal phir milte hain nayi umeedon ke saath! 💫',
'Good Night Friends! 🌙

Aaj ke liye bas itna — achhi neend lijiye aur kal fresh start kijiye. Sweet Dreams! 😴✨']),
('promo_morning','promotion','Morning Promotion','09:00',5, ARRAY[
'🚀 Kuch Naya Create Karna Chahte Ho?

Ab apne creative ideas ko reality banaiye Modern Nova AI ke saath! ✨

🎙️ AI Voice Generator
🖼️ AI Image Generator
🎬 Thumbnail Generator
✍️ Script Generator
🎨 Story & Animation Tools

Ek hi platform par creative tools ka experience!

🌐 Website: https://modernnova.in

Aaj hi visit karein aur apni creativity ko ek nayi direction dein! ❤️',
'✨ Apni kahani ko awaaz dijiye!

Modern Nova AI par script likhiye, Hindi voiceover banaiye aur YouTube ke liye thumbnail taiyaar kijiye — sab ek jagah. 🎙️🎬

🎁 Free account par 5,000 credits

🌐 https://modernnova.in']),
('promo_afternoon','promotion','Afternoon Promotion','14:00',6, ARRAY[
'🎬 YouTube creators ke liye khaas!

✍️ Script Studio — kahani minutes mein
🎙️ Voice Studio — natural Hindi awaaz
🖼️ Thumbnail Generator — clickable designs

Sab kuch ek hi website par: 🌐 https://modernnova.in 🚀',
'🖼️ Ek idea, ek click, ek shaandaar image!

Modern Nova AI ke Image aur Thumbnail Generator se apne content ko premium look dijiye. ✨

👉 Try karein: https://modernnova.in']),
('promo_evening','promotion','Evening Promotion','20:00',7, ARRAY[
'🌙 Aaj raat kuch creative ho jaaye?

Modern Nova AI se apni story ko script, voice aur video mein badliye. 🎙️🎬✨

🌐 Website: https://modernnova.in

Shuru karein free mein! ❤️',
'🎙️ Horror, moral ya motivational — har kahani ke liye sahi awaaz!

Modern Nova AI Voice Studio mein characters aur emotions chuniye aur MP3 download kijiye. 🎧

🌐 https://modernnova.in 🚀']);